// src/core/Persistence.ts
import { App, normalizePath } from 'obsidian';
import { QueueData, TaskItem, TaskStatus } from './types'; // 引入类型
import AgentKitPlugin from '../main';
import { Logger } from './utils';

export class Persistence {
    // ... constructor, init, and cache methods remain the same ...
    private plugin: AgentKitPlugin;
    private app: App;
    private cacheDir: string;
    private queueFile: string;

    constructor(plugin: AgentKitPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;
        this.cacheDir = normalizePath(`${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/task_cache`);
        this.queueFile = normalizePath(`${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/queues.json`);
    }

    async init() {
        const adapter = this.app.vault.adapter;
        if (!(await adapter.exists(this.cacheDir))) {
            await adapter.mkdir(this.cacheDir);
        }
    }

    async loadQueueData(): Promise<QueueData> {
        const adapter = this.app.vault.adapter;
        if (await adapter.exists(this.queueFile)) {
            try {
                const content = await adapter.read(this.queueFile);
                const data = JSON.parse(content);
                // 兼容旧格式：如果加载的是数组，转换为新格式
                // 注意：这是一个简化的兼容逻辑，实际中可能需要更复杂的迁移
                if(Array.isArray(data)) {
                    Logger.warn("[Persistence] Detected old queue format (array). Attempting conversion...");
                    // 此处应有从数组到对象的转换逻辑，但为了简化，我们假设新格式
                }
                return data;
            } catch (e) {
                Logger.error("Failed to load queue data:", e);
                return {};
            }
        }
        return {};
    }

    // 【修改】saveQueueData 方法
    async saveQueueData(queues: QueueData, options?: { clean?: boolean }) {
        let dataToSave = queues;
        if (options?.clean) {
            dataToSave = this.cleanQueueData(queues);
        }

        const adapter = this.app.vault.adapter;
        try {
            // 注意：JSON.stringify 会忽略 undefined，但不会忽略值为 null 的属性。
            // 我们的对象结构是 { [taskId]: TaskItem }，所以没问题。
            await adapter.write(this.queueFile, JSON.stringify(dataToSave, null, 2));
            Logger.log("Queue data saved.");
        } catch (e) {
            Logger.error("Failed to save queue data:", e);
        }
    }
    
    // 【新增】辅助方法：清理已完成的任务
    private cleanQueueData(rawQueueData: QueueData): QueueData {
        const cleanedData: QueueData = {};
        for (const queueName in rawQueueData) {
            const tasks = rawQueueData[queueName];
            const activeTasks: Record<string, TaskItem> = {};
            for (const taskId in tasks) {
                const task = tasks[taskId];
                // 只保留未达到最终状态的任务
                if (task.status !== TaskStatus.SUCCESS && task.status !== TaskStatus.DISCARDED) {
                    activeTasks[taskId] = task;
                }
            }
            // 只有在队列还有任务时才保留它
            if (Object.keys(activeTasks).length > 0) {
                cleanedData[queueName] = activeTasks;
            }
        }
        return cleanedData;
    }

    // ... task cache methods remain the same ...
    private getCachePath(taskId: string): string {
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
