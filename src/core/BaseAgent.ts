// src/core/BaseAgent.ts
import { LLMProvider } from "./LLMProvider";
import { App } from "obsidian";
import { PluginData } from "./types";

// --- 修改 ---: 接口更具体，并重命名以示清晰
export interface IAgentPluginContext {
    app: App;
    data: PluginData;
    saveData: () => Promise<void>;
    orchestrator: {
        addToQueue: (queueName: string, item: any) => Promise<void>;
    };
}

export abstract class BaseAgent<T> {
    // --- 修改 ---: 使用新的接口类型
    constructor(
        protected plugin: IAgentPluginContext,
        protected llm: LLMProvider
    ) {}

    // 访问器保持不变，但现在类型更安全
    get settings() { return this.plugin.data.settings; } 
    get app() { return this.plugin.app; }

    abstract get queueName(): string;
    abstract process(item: T): Promise<boolean>;
}
