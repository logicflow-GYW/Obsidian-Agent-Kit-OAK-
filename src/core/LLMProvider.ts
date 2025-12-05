// src/core/LLMProvider.ts
import { requestUrl, Notice, RequestUrlParam } from "obsidian";
import { OAKSettings } from "./types";
import { Logger } from "./utils";

export class AllModelsFailedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AllModelsFailedError";
    }
}

interface KeyUsageStatus {
    cooldown_until: number;
}

export class LLMProvider {
    private keyUsageOpenAI = new Map<string, KeyUsageStatus>();
    private keyUsageGoogle = new Map<string, KeyUsageStatus>();
    private readonly COOLDOWN_SECONDS = 300; 
    
    // 【新增】默认超时 90 秒
    private readonly REQUEST_TIMEOUT_MS = 90000;

    private openAIKeyIndex = 0;
    private googleKeyIndex = 0;

    constructor(private getSettings: () => OAKSettings) {}

    async chat(prompt: string): Promise<string> {
        const settings = this.getSettings();
        const provider = settings.llmProvider;

        try {
            if (provider === "openai") {
                return await this.tryOpenAIFirst(prompt);
            } else {
                return await this.tryGoogleFirst(prompt);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            Logger.error("[LLM Fatal Error]", error);
            
            if (error instanceof AllModelsFailedError) {
                throw error; 
            }
            
            new Notice(`AI 响应失败: ${msg}`);
            return ""; 
        }
    }

    // 【新增】带超时的请求包装器
    private async _requestWithTimeout(requestParams: RequestUrlParam): Promise<any> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`API Request timed out after ${this.REQUEST_TIMEOUT_MS / 1000}s`));
            }, this.REQUEST_TIMEOUT_MS);

            requestUrl(requestParams)
                .then(response => {
                    clearTimeout(timer);
                    resolve(response);
                })
                .catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    private async tryOpenAIFirst(prompt: string): Promise<string> {
        try {
            return await this.callOpenAI(prompt);
        } catch (e) {
            Logger.warn("OpenAI failed, attempting failover to Google...", e);
            if (this.getKeys(this.getSettings().googleApiKey).length > 0) {
                new Notice("OpenAI 暂时不可用，正在切换至 Google...");
                return await this.callGoogle(prompt);
            }
            throw new AllModelsFailedError("OpenAI failed and no Google keys available.");
        }
    }

    private async tryGoogleFirst(prompt: string): Promise<string> {
        try {
            return await this.callGoogle(prompt);
        } catch (e) {
            Logger.warn("Google failed, attempting failover to OpenAI...", e);
            if (this.getKeys(this.getSettings().openaiApiKey).length > 0) {
                new Notice("Google 暂时不可用，正在切换至 OpenAI...");
                return await this.callOpenAI(prompt);
            }
            throw new AllModelsFailedError("Google failed and no OpenAI keys available.");
        }
    }

    private async callOpenAI(prompt: string): Promise<string> {
        const settings = this.getSettings();
        const keys = this.getPrioritizedKeys(settings.openaiApiKey, "openai");
        
        if (keys.length === 0) throw new AllModelsFailedError("OpenAI API Keys exhausted or not configured.");

        let lastError: Error | null = null;

        for (const apiKey of keys) {
            try {
                Logger.log(`Trying OpenAI Key: ...${apiKey.slice(-4)}`);
                const result = await this._requestOpenAI(apiKey, settings, prompt);
                this.resetCooldown(apiKey, "openai");
                this.updateKeyIndexAfterSuccess(apiKey, settings.openaiApiKey, "openai");
                return result;
            } catch (error: any) {
                Logger.warn(`OpenAI Key ...${apiKey.slice(-4)} failed: ${error.message}`);
                lastError = error;
                if (this.isQuotaError(error)) {
                    this.applyCooldown(apiKey, "openai");
                }
            }
        }
        throw new AllModelsFailedError(`All OpenAI keys failed. Last error: ${lastError?.message}`);
    }

    private async callGoogle(prompt: string): Promise<string> {
        const settings = this.getSettings(); 
        const keys = this.getPrioritizedKeys(settings.googleApiKey, "google");

        if (keys.length === 0) throw new AllModelsFailedError("Google API Keys exhausted or not configured.");

        let lastError: Error | null = null;

        for (const apiKey of keys) {
            try {
                Logger.log(`Trying Google Key: ...${apiKey.slice(-4)}`);
                const result = await this._requestGoogle(apiKey, settings, prompt);
                this.resetCooldown(apiKey, "google");
                this.updateKeyIndexAfterSuccess(apiKey, settings.googleApiKey, "google");
                return result;
            } catch (error: any) {
                Logger.warn(`Google Key ...${apiKey.slice(-4)} failed: ${error.message}`);
                lastError = error;
                if (this.isQuotaError(error)) {
                    this.applyCooldown(apiKey, "google");
                }
            }
        }
        throw new AllModelsFailedError(`All Google keys failed. Last error: ${lastError?.message}`);
    }

    private async _requestOpenAI(apiKey: string, settings: OAKSettings, prompt: string): Promise<string> {
        const url = `${settings.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`;
        // 使用带超时的请求
        const response = await this._requestWithTimeout({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: settings.openaiModel,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            })
        });

        if (response.status >= 400) throw new Error(`OpenAI Status ${response.status}`);
        return response.json.choices[0].message.content.trim();
    }

    private async _requestGoogle(apiKey: string, settings: OAKSettings, prompt: string): Promise<string> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.googleModel}:generateContent?key=${apiKey}`;
        // 使用带超时的请求
        const response = await this._requestWithTimeout({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (response.status >= 400) throw new Error(`Google Status ${response.status}`);
        if (response.json.candidates && response.json.candidates.length > 0) {
             return response.json.candidates[0].content.parts[0].text.trim();
        }
        return "";
    }

    private getKeys(keyString: string): string[] {
        if (!keyString) return [];
        return keyString.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    }

    private getPrioritizedKeys(keyString: string, provider: 'openai' | 'google'): string[] {
        const allKeys = this.getKeys(keyString);
        if (allKeys.length === 0) return [];

        const strategy = this.getSettings().apiKeyStrategy;
        let orderedKeys = [...allKeys];

        if (strategy === 'round-robin') {
            const currentIndex = provider === 'openai' ? this.openAIKeyIndex : this.googleKeyIndex;
            const safeIndex = currentIndex % allKeys.length;
            orderedKeys = [
                ...allKeys.slice(safeIndex),
                ...allKeys.slice(0, safeIndex)
            ];
        }

        const map = provider === 'openai' ? this.keyUsageOpenAI : this.keyUsageGoogle;
        const now = Date.now() / 1000;
        
        return orderedKeys.filter(key => {
            const usage = map.get(key);
            if (!usage) return true;
            return now >= usage.cooldown_until;
        });
    }

    private updateKeyIndexAfterSuccess(usedKey: string, keyString: string, provider: 'openai' | 'google') {
        if (this.getSettings().apiKeyStrategy !== 'round-robin') return;

        const allKeys = this.getKeys(keyString);
        const index = allKeys.indexOf(usedKey);
        
        if (index !== -1) {
            const nextIndex = (index + 1) % allKeys.length;
            if (provider === 'openai') {
                this.openAIKeyIndex = nextIndex;
            } else {
                this.googleKeyIndex = nextIndex;
            }
            Logger.log(`[Round-Robin] Strategy rotated. Next start index for ${provider}: ${nextIndex}`);
        }
    }

    private isQuotaError(error: any): boolean {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("429") || msg.includes("401") || msg.includes("403")) return true;
        if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("insufficient")) return true;
        return false;
    }

    private applyCooldown(key: string, provider: 'openai' | 'google') {
        const map = provider === 'openai' ? this.keyUsageOpenAI : this.keyUsageGoogle;
        map.set(key, { cooldown_until: (Date.now() / 1000) + this.COOLDOWN_SECONDS });
        Logger.warn(`❄️ Key ...${key.slice(-4)} 冷却 5 分钟.`);
    }

    private resetCooldown(key: string, provider: 'openai' | 'google') {
        const map = provider === 'openai' ? this.keyUsageOpenAI : this.keyUsageGoogle;
        map.delete(key);
    }
}