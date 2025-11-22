// src/core/BaseAgent.ts
import { LLMProvider } from "./LLMProvider";
import { App } from "obsidian";
import { OAKSettings, AgentResult } from "./types"; // 引入 AgentResult
import { Logger } from "./utils";

export interface IAgentPluginContext {
    app: App;
    settings: OAKSettings;
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

    // --- 关键修改：允许返回复杂对象 AgentResult ---
    abstract process(item: T): Promise<boolean | AgentResult>;

    protected log(msg: string) {
        Logger.log(`[${this.constructor.name}] ${msg}`);
    }
    
    protected error(msg: string, ...args: any[]) {
        Logger.error(`[${this.constructor.name}] ${msg}`, ...args);
    }
}