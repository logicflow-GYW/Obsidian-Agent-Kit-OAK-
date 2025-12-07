// src/core/BaseAgent.ts
import { LLMProvider } from "./LLMProvider";
import { TaskItem, TaskStatus } from "./types";
import { Logger } from "./utils";

// 【重构】上下文接口，提供最小化的必要信息和方法
export interface IAgentContext {
    get settings(): { [key: string]: any }; // 使用通用类型，避免直接依赖 OAKSettings
    app: App; // Obsidian 的 App 实例通常是必须的
    persistence: {
        saveTaskCache: (taskId: string, content: string) => Promise<void>;
        loadTaskCache: (taskId: string) => Promise<string>;
        deleteTaskCache: (taskId: string) => Promise<void>;
    };
    orchestrator: {
        addToQueue: (queueName: string, item: Omit<TaskItem, 'id' | 'status' | 'retries'>) => Promise<string>;
    };
    // 可以通过这个上下文触发事件，而不是直接依赖 EventBus
    triggerEvent: (eventName: string, data?: any) => void;
}

export abstract class BaseAgent<T extends TaskItem> {
    constructor(
        protected context: IAgentContext,
        protected llm: LLMProvider
    ) {}

    // 通过 context 的 getter 访问设置，而不是直接访问 plugin.settings
    get settings() { return this.context.settings; } 
    get app() { return this.context.app; }

    abstract get queueName(): string;
    
    // 【修改】Agent 现在返回处理后的完整 TaskItem，Orchestrator 将用它更新状态
    abstract process(item: T): Promise<T>;

    // 提供便捷的日志方法
    protected log(msg: string) {
        Logger.log(`[${this.constructor.name}] ${msg}`);
    }
    
    protected error(msg: string, ...args: any[]) {
        Logger.error(`[${this.constructor.name}] ${msg}`, ...args);
    }

    // 提供便捷的事件触发方法
    protected emit(eventName: string, data: any) {
        this.context.triggerEvent(eventName, data);
    }

    // 提供便捷的缓存操作方法
    protected async saveTaskCache(taskId: string, content: string): Promise<void> {
        await this.context.persistence.saveTaskCache(taskId, content);
    }

    protected async loadTaskCache(taskId: string): Promise<string> {
        return await this.context.persistence.loadTaskCache(taskId);
    }
    
    protected async deleteTaskCache(taskId: string): Promise<void> {
        await this.context.persistence.deleteTaskCache(taskId);
    }
}
