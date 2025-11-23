// src/core/LLMProvider.ts
import { requestUrl, Notice } from "obsidian";
import { OAKSettings } from "./types";
import { Logger } from "./utils";

export class LLMProvider {
    constructor(private getSettings: () => OAKSettings) {}

    async chat(prompt: string): Promise<string> {
        const settings = this.getSettings();
        const provider = settings.llmProvider;

        try {
            if (provider === "openai") {
                return await this.callOpenAI(prompt);
            } else if (provider === "google") {
                return await this.callGoogle(prompt);
            } else {
                throw new Error(`未知的提供商: ${provider}`);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error("[LLM Error]", error);
            new Notice(`AI 调用全线失败: ${msg}`);
            return ""; 
        }
    }

    // 辅助：将多行文本解析为 Key 数组
    private getKeys(keyString: string): string[] {
        if (!keyString) return [];
        return keyString.split('\n')
            .map(k => k.trim())
            .filter(k => k.length > 0);
    }

    private async callOpenAI(prompt: string): Promise<string> {
        const settings = this.getSettings();
        const keys = this.getKeys(settings.openaiApiKey);
        
        if (keys.length === 0) throw new Error("OpenAI API Key 未配置");

        let lastError: Error | null = null;

        // 轮询尝试所有 Keys
        for (const apiKey of keys) {
            try {
                return await this._requestOpenAI(apiKey, settings, prompt);
            } catch (error: any) {
                Logger.warn(`OpenAI Key (...${apiKey.slice(-4)}) failed: ${error.message}. Trying next...`);
                lastError = error;
                // 继续下一次循环
            }
        }
        
        throw lastError || new Error("All OpenAI keys failed.");
    }

    private async _requestOpenAI(apiKey: string, settings: OAKSettings, prompt: string): Promise<string> {
        const url = `${settings.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`;
        
        const response = await requestUrl({
            url: url,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: settings.openaiModel,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            })
        });

        if (response.status >= 400) {
            throw new Error(`OpenAI API Error: ${response.status}`);
        }

        return response.json.choices[0].message.content.trim();
    }

    private async callGoogle(prompt: string): Promise<string> {
        const settings = this.getSettings(); 
        const keys = this.getKeys(settings.googleApiKey);

        if (keys.length === 0) throw new Error("Google API Key 未配置");

        let lastError: Error | null = null;

        // 轮询尝试所有 Keys
        for (const apiKey of keys) {
            try {
                return await this._requestGoogle(apiKey, settings, prompt);
            } catch (error: any) {
                Logger.warn(`Google Key (...${apiKey.slice(-4)}) failed: ${error.message}. Trying next...`);
                lastError = error;
                // 继续下一次循环
            }
        }

        throw lastError || new Error("All Google keys failed.");
    }

    private async _requestGoogle(apiKey: string, settings: OAKSettings, prompt: string): Promise<string> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.googleModel}:generateContent?key=${apiKey}`;

        const response = await requestUrl({
            url: url,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (response.status >= 400) {
            throw new Error(`Google API Error: ${response.status}`);
        }

        if (response.json.candidates && response.json.candidates.length > 0) {
             return response.json.candidates[0].content.parts[0].text.trim();
        }
        return "";
    }
}