import { LLMProvider } from "./LLMProvider";
import { App } from "obsidian";

interface IPluginContext {
    app: App;
    data: { settings: any }; // <--- 1. 确保接口里有 data
    orchestrator: {
        addToQueue: (queueName: string, item: any) => Promise<void>;
    };
}

export abstract class BaseAgent<T> {
    constructor(
        protected plugin: IPluginContext,
        protected llm: LLMProvider
    ) {}

    // <--- 2. 这里必须是 this.plugin.data.settings
    get settings() { return this.plugin.data.settings; } 
    
    get app() { return this.plugin.app; }

    abstract get queueName(): string;
    abstract process(item: T): Promise<boolean>;
}