// src/core/types.ts

export interface TaskItem {
    id?: string;
    retries?: number; // --- 修改 ---: 添加重试计数字段
    [key: string]: any; 
}

// 定义具体的设置接口
export interface OAKSettings {
    // --- LLM 配置 ---
    // 提供商选择：'openai' | 'google'
    llmProvider: string;

    // OpenAI 兼容设置 (包含 DeepSeek, Moonshot 等)
    openaiApiKey: string;
    openaiBaseUrl: string;
    openaiModel: string;

    // Google Gemini 设置
    googleApiKey: string;
    googleModel: string;
    
    // --- 业务配置 ---
    maxRetries: number; // --- 新增 ---: 可配置的最大重试次数
    prompt_generator: string;
    output_dir: string;
}

export interface PluginData {
    queues: { [queueName: string]: TaskItem[] }; // --- 修改 ---: 明确队列项类型
    settings: OAKSettings;
}
