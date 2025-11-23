// src/core/BaseAgent.ts
import { LLMProvider } from "./LLMProvider";
import { App } from "obsidian";
import { OAKSettings } from "./types";
import { Logger } from "./utils";

// 更新上下文接口
export interface IAgentPluginContext {
    app: App;
    settings: OAKSettings; // 现在直接访问 settings
    // 移除 data: PluginData，因为数据现在由 Persistence 管理
    orchestrator: {
        addToQueue: (queueName: string, item: any) => Promise<void>;
    };
}

export abstract class BaseAgent<T> {
    constructor(
        protected plugin: IAgentPluginContext,
        protected llm: LLMProvider
    ) {}

    get settings() { return this.plugin.settings; } 
    get app() { return this.plugin.app; }

    abstract get queueName(): string;
    abstract process(item: T): Promise<boolean>;

    // 提供便捷的日志方法
    protected log(msg: string) {
        Logger.log(`[${this.constructor.name}] ${msg}`);
    }
    
    protected error(msg: string, ...args: any[]) {
        Logger.error(`[${this.constructor.name}] ${msg}`, ...args);
    }
}