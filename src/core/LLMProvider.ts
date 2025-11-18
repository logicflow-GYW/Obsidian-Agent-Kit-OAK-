// src/core/LLMProvider.ts
import { requestUrl, Notice } from "obsidian";
import { OAKSettings } from "./types";

export class LLMProvider {
    constructor(private settings: OAKSettings) {}

    async chat(prompt: string): Promise<string> {
        const provider = this.settings.llmProvider;

        try {
            if (provider === "openai") {
                return await this.callOpenAI(prompt);
            } else if (provider === "google") {
                return await this.callGoogle(prompt);
            } else {
                throw new Error(`未知的提供商: ${provider}`);
            }
        } catch (error) {
            console.error("[LLM Error]", error);
            new Notice(`AI 调用失败: ${error.message}`);
            return ""; // 返回空字符串表示失败
        }
    }

    private async callOpenAI(prompt: string): Promise<string> {
        if (!this.settings.openaiApiKey) throw new Error("OpenAI API Key 未配置");

        const url = `${this.settings.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`;
        
        const response = await requestUrl({
            url: url,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.settings.openaiApiKey}`
            },
            body: JSON.stringify({
                model: this.settings.openaiModel,
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
        if (!this.settings.googleApiKey) throw new Error("Google API Key 未配置");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.settings.googleModel}:generateContent?key=${this.settings.googleApiKey}`;

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

        // 解析 Gemini 的奇怪返回结构
        if (response.json.candidates && response.json.candidates.length > 0) {
             return response.json.candidates[0].content.parts[0].text.trim();
        }
        return "";
    }
}