// src/core/types.ts

// 【新增】任务状态枚举
export enum TaskStatus {
    QUEUED = 'queued',
    RUNNING = 'running',
    SUCCESS = 'success',
    FAILED = 'failed',
    DISCARDED = 'discarded'
}

export interface TaskItem {
    id: string; // id现在是必需的
    status: TaskStatus; // 【新增】状态字段
    retries: number;
    sourcePluginId?: string; // 追踪任务来源
    // content?: string; // 保留此字段，可用于Agent间传递小数据或缓存路径
    [key: string]: any;
}

export interface OAKSettings {
    // --- LLM 配置 ---
    llmProvider: 'openai' | 'google';
    apiKeyStrategy: 'exhaustion' | 'round-robin';
    
    openaiApiKey: string;
    openaiBaseUrl: string;
    openaiModel: string;
    googleApiKey: string;
    googleModel: string;
    
    // --- 业务配置 ---
    maxRetries: number;
    concurrency: number;
    prompt_generator: string;
    output_dir: string;
    
    // --- 系统配置 ---
    debug_mode: boolean; 
}

// 【修改】运行时队列数据结构，现在将任务ID映射到任务对象
export type QueueData = Record<string, TaskItem>;

export type AgentResult = boolean;
