// src/core/LLMProvider.ts
import { requestUrl, Notice } from "obsidian";
import { OAKSettings } from "./types";

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
        } catch (error: unknown) { // --- 修改 ---: 使用 unknown 类型
            // --- 修改 ---: 安全地获取错误信息
            const msg = error instanceof Error ? error.message : String(error);
            console.error("[LLM Error]", error);
            new Notice(`AI 调用失败: ${msg}`);
            return ""; 
        }
    }

    private async callOpenAI(prompt: string): Promise<string> {
        const settings = this.getSettings();
        if (!settings.openaiApiKey) throw new Error("OpenAI API Key 未配置");

        const url = `${settings.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`;
        
        const response = await requestUrl({
            url: url,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.openaiApiKey}`
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
        if (!settings.googleApiKey) throw new Error("Google API Key 未配置");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.googleModel}:generateContent?key=${settings.googleApiKey}`;

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