// src/core/Orchestrator.ts
import { Notice } from "obsidian";
import { BaseAgent } from "./BaseAgent";
import { TaskItem } from "./types";
import AgentKitPlugin from "../main";
import { Logger } from "./utils";
import { AllModelsFailedError } from "./LLMProvider";

export class Orchestrator {
    private _isRunning = false;
    private agents: BaseAgent<any>[] = [];
    private plugin: AgentKitPlugin;

    // 【新增】并发控制：记录正在进行的任务 ID 和开始时间
    private activeTasks = new Map<string, number>(); 
    // 【新增】僵尸任务超时时间 (5分钟)
    private readonly TASK_TIMEOUT_MS = 5 * 60 * 1000; 

    public get isRunning(): boolean {
        return this._isRunning;
    }

    constructor(plugin: AgentKitPlugin) {
        this.plugin = plugin;
    }

    registerAgent(agent: BaseAgent<any>) {
        this.agents.push(agent);
        if (!this.plugin.queueData[agent.queueName]) {
            this.plugin.queueData[agent.queueName] = [];
        }
        Logger.log(`Registered Agent: ${agent.constructor.name} -> Queue: ${agent.queueName}`);
    }

    async addToQueue(queueName: string, item: TaskItem) {
        if (!this.plugin.queueData[queueName]) {
            this.plugin.queueData[queueName] = [];
        }
        item.retries = 0;
        if (!item.id) item.id = Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9);
        this.plugin.queueData[queueName].push(item);
        
        await this.plugin.persistence.saveQueueData(this.plugin.queueData);
        Logger.log(`Task added to ${queueName}: ${item.id}`);
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;
        new Notice("🚀 OAK 引擎已启动");
        Logger.log("Engine started");
        this.loop().catch(err => Logger.error("Loop error:", err));
    }

    stop() {
        this._isRunning = false;
        new Notice("🛑 OAK 引擎已停止");
        Logger.log("Engine stopped");
    }

    // 【新增】清理僵尸任务
    private cleanupZombieTasks() {
        const now = Date.now();
        for (const [taskId, startTime] of this.activeTasks.entries()) {
            if (now - startTime > this.TASK_TIMEOUT_MS) {
                Logger.warn(`🧹 [Zombie Sweeper] Removing stuck task '${taskId}' after ${this.TASK_TIMEOUT_MS/1000}s`);
                this.activeTasks.delete(taskId);
                // 这里我们仅释放槽位。
                // 因为任务还在 'activeTasks' 也就意味着它不在 'queueData' 里了，
                // 视为失败处理。如果需要重试，可以在这里补逻辑，但通常防止死循环更重要。
            }
        }
    }

    // 【重构】主循环：不再阻塞等待，而是负责调度
    private async loop() {
        if (!this._isRunning) return;

        // 1. 清理僵尸任务
        this.cleanupZombieTasks();

        // 2. 获取最大并发设置
        const maxConcurrency = this.plugin.settings.concurrency || 3;
        
        // 3. 填充并发槽位
        let slotsAvailable = maxConcurrency - this.activeTasks.size;

        if (slotsAvailable > 0) {
            // 遍历所有 Agents 寻找待处理任务
            for (const agent of this.agents) {
                if (slotsAvailable <= 0 || !this._isRunning) break;

                const queueName = agent.queueName;
                const queue = this.plugin.queueData[queueName];

                if (queue && queue.length > 0) {
                    // 取出任务 (Dequeue)
                    const item = queue.shift();
                    if (item && item.id) {
                        slotsAvailable--;
                        
                        // 标记为活跃
                        this.activeTasks.set(item.id, Date.now());
                        
                        // 保存队列状态 (防止崩溃丢失进度)
                        await this.plugin.persistence.saveQueueData(this.plugin.queueData);

                        // 【关键】异步执行，不 await
                        this.processTask(agent, item).catch(err => {
                            Logger.error(`Unhandled error in processTask for ${item.id}`, err);
                            this.activeTasks.delete(item.id!); // 确保兜底释放
                        });
                    }
                }
            }
        }

        // 4. 调度下一次循环
        // 由于是滑动窗口，我们可以设置较短的间隔来快速响应空槽
        const delay = this.activeTasks.size > 0 ? 500 : 2000;
        
        if (this._isRunning) {
            setTimeout(() => {
                this.loop().catch(err => Logger.error("Loop timeout error:", err));
            }, delay);
        }
    }

    // 【新增】独立的任务处理函数
    private async processTask(agent: BaseAgent<any>, item: TaskItem) {
        if (!item.id) return; // Should not happen

        try {
            Logger.log(`Processing task ${item.id} in ${agent.queueName}...`);
            const success = await agent.process(item);
            
            if (success) {
                // 成功：清理缓存
                await this.plugin.persistence.deleteTaskCache(item.id); 
                Logger.log(`✅ Task ${item.id} completed.`);
            } else {
                throw new Error("Agent process returned false.");
            }
        } catch (error) {
            // 致命错误检测
            if (error instanceof AllModelsFailedError) {
                 Logger.error(`🛑 Engine paused due to fatal error: ${error.message}`);
                 new Notice(`引擎紧急暂停: 所有 API Key 均不可用。`);
                 this.stop();
                 this.activeTasks.delete(item.id); // 释放当前任务
                 return;
            }

            Logger.error(`Agent ${agent.constructor.name} failed task ${item.id}:`, error);
            
            // 失败重试逻辑
            item.retries = (item.retries || 0) + 1;
            const maxRetries = this.plugin.settings.maxRetries || 3;
            
            if (item.retries < maxRetries) {
                Logger.warn(`Task ${item.id} retrying (${item.retries}/${maxRetries})`);
                // 放回队列末尾
                if (!this.plugin.queueData[agent.queueName]) {
                    this.plugin.queueData[agent.queueName] = [];
                }
                this.plugin.queueData[agent.queueName].push(item);
            } else {
                Logger.error(`Task ${item.id} max retries reached. Discarding.`);
                new Notice(`任务 ${item.id} 已达最大重试次数，已被丢弃。`);
                await this.plugin.persistence.deleteTaskCache(item.id);
            }
            
            // 保存队列变更
            await this.plugin.persistence.saveQueueData(this.plugin.queueData);

        } finally {
            // 【关键】无论成功失败，必须释放槽位
            this.activeTasks.delete(item.id);
        }
    }
}