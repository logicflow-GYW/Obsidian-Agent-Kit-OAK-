// src/core/Persistence.ts

import { App, normalizePath } from 'obsidian';
import { QueueData } from './types';
import AgentKitPlugin from '../main'; // 指向上一级的 main
import { Logger } from './utils';

export class Persistence {
    private plugin: AgentKitPlugin;
    private app: App;
    private cacheDir: string;
    private queueFile: string;

    constructor(plugin: AgentKitPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;
        // 缓存目录: .obsidian/plugins/obsidian-agent-kit/task_cache
        this.cacheDir = normalizePath(`${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/task_cache`);
        // 队列文件: .obsidian/plugins/obsidian-agent-kit/queues.json
        this.queueFile = normalizePath(`${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/queues.json`);
    }

    async init() {
        const adapter = this.app.vault.adapter;
        if (!(await adapter.exists(this.cacheDir))) {
            await adapter.mkdir(this.cacheDir);
        }
    }

    // --- 队列数据管理 ---

    async loadQueueData(): Promise<QueueData> {
        const adapter = this.app.vault.adapter;
        if (await adapter.exists(this.queueFile)) {
            try {
                const content = await adapter.read(this.queueFile);
                return JSON.parse(content);
            } catch (e) {
                Logger.error("Failed to load queue data:", e);
                return {};
            }
        }
        return {};
    }

    async saveQueueData(queues: QueueData) {
        // 深拷贝，移除可能存在的大文本字段（如果未来任务项变得很复杂）
        // 目前 TaskItem 结构简单，直接存即可。
        // 如果 TaskItem 里有 content 字段且内容很大，建议在这里剥离并存入文件缓存。
        
        const adapter = this.app.vault.adapter;
        try {
            await adapter.write(this.queueFile, JSON.stringify(queues, null, 2));
            Logger.log("Queue data saved.");
        } catch (e) {
            Logger.error("Failed to save queue data:", e);
        }
    }

    // --- 任务内容缓存 (用于 Agent 间传递大数据) ---

    private getCachePath(taskId: string): string {
        // 使用简单的文件名，避免特殊字符
        const safeName = taskId.replace(/[\\/*?:"<>|]/g, "").trim();
        return `${this.cacheDir}/${safeName}.md`;
    }

    async saveTaskCache(taskId: string, content: string) {
        const path = this.getCachePath(taskId);
        try {
            await this.app.vault.adapter.write(path, content);
            Logger.log(`Saved task cache: ${taskId}`);
        } catch (e) {
            Logger.error(`Failed to save task cache for ${taskId}:`, e);
        }
    }

    async loadTaskCache(taskId: string): Promise<string> {
        const path = this.getCachePath(taskId);
        try {
            if (await this.app.vault.adapter.exists(path)) {
                return await this.app.vault.adapter.read(path);
            }
        } catch (e) {
            Logger.error(`Failed to load task cache for ${taskId}:`, e);
        }
        return "";
    }

    async deleteTaskCache(taskId: string) {
        const path = this.getCachePath(taskId);
        try {
            if (await this.app.vault.adapter.exists(path)) {
                await this.app.vault.adapter.remove(path);
                Logger.log(`Deleted task cache: ${taskId}`);
            }
        } catch (e) {
            Logger.warn(`Failed to delete task cache for ${taskId}:`, e);
        }
    }
}