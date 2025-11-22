// src/core/types.ts

export interface TaskItem {
    id?: string;
    retries?: number;
    priority?: number; 
    sourcePluginId?: string;
    timestamp?: number; 
    content?: string; 
    // 允许任意额外字段
    [key: string]: any; 
}

// --- 新增：标准化 Agent 返回结果 ---
export interface AgentResult {
    status: 'success' | 'error' | 'retry';
    data?: any;        // 任务产出
    message?: string;  // 错误信息
    nextTasks?: {      // 任务链
        queueName: string;
        payload: any;
    }[];
}

export interface OAKSettings {
    llmProvider: string;
    openaiApiKey: string;
    openaiBaseUrl: string;
    openaiModel: string;
    googleApiKey: string;
    googleModel: string;
    maxRetries: number;
    prompt_generator: string;
    output_dir: string;
    debug_mode: boolean;
}

export interface QueueData {
    [queueName: string]: TaskItem[]; 
}