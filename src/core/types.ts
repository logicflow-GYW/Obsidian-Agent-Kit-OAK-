// src/core/types.ts

export interface TaskItem {
    id?: string;
    retries?: number;
    content?: string; // 允许任务携带内容缓存路径或简短内容
    sourcePluginId?: string; // 追踪任务来源
    [key: string]: any; 
}

export interface OAKSettings {
    // --- LLM 配置 ---
    llmProvider: string;
    apiKeyStrategy: 'exhaustion' | 'round-robin';
    
    openaiApiKey: string;
    openaiBaseUrl: string;
    openaiModel: string;
    googleApiKey: string;
    googleModel: string;
    
    // --- 业务配置 ---
    maxRetries: number;
    concurrency: number; // 【新增】最大并发数
    prompt_generator: string;
    output_dir: string;
    
    // --- 系统配置 ---
    debug_mode: boolean; 
}

// 运行时队列数据结构
export interface QueueData {
    [queueName: string]: TaskItem[]; 
}

export type AgentResult = boolean;