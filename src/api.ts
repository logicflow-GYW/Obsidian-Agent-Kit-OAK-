// src/api.ts
import { BaseAgent } from "./core/BaseAgent";
import { AgentResult } from "./core/types"; // 从 types 导入

// 重新导出，方便外部插件使用
export type { AgentResult };

export interface OakAPI {
    version: string;
    registerAgent(agent: BaseAgent<any>): void;
    dispatch(queueName: string, payload: any, sourcePluginId?: string): Promise<string>;
    on(event: string, callback: (...data: any) => void): void;
    off(event: string, callback: (...data: any) => void): void;
}