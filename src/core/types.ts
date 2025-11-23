// src/core/types.ts

export interface TaskItem {
    id?: string;
    retries?: number;
    content?: string; // 允许任务携带内容缓存路径或简短内容
    [key: string]: any; 
}

export interface OAKSettings {
    // --- LLM 配置 ---
    llmProvider: string;
    openaiApiKey: string;
    openaiBaseUrl: string;
    openaiModel: string;
    googleApiKey: string;
    googleModel: string;
    
    // --- 业务配置 ---
    maxRetries: number;
    prompt_generator: string;
    output_dir: string;
    
    // --- 系统配置 ---
    debug_mode: boolean; // 新增：调试模式开关
}

// 运行时队列数据结构
export interface QueueData {
    [queueName: string]: TaskItem[]; 
}