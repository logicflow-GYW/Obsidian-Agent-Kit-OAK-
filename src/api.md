// src/api.ts
import { BaseAgent } from "./core/BaseAgent";
import { AgentResult } from "./core/types"; // 从 types 导入

// 重新导出，方便外部插件使用
export type { AgentResult };

export interface OakAPI {
    version: string;
    
    /**
     * 注册一个新的 Agent 到 OAK 调度系统
     */
    registerAgent(agent: BaseAgent<any>): void;
    
    /**
     * 向指定队列派发异步任务
     */
    dispatch(queueName: string, payload: any, sourcePluginId?: string): Promise<string>;
    
    /**
     * [新增] 同步对话接口
     * 直接调用配置好的 LLM 提供商进行对话，不进入后台队列，适合即时聊天。
     */
    chat(prompt: string): Promise<string>;

    /**
     * 监听 OAK 系统事件
     */
    on(event: string, callback: (...data: any) => void): void;
    
    /**
     * 取消监听
     */
    off(event: string, callback: (...data: any) => void): void;
}