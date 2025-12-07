// src/core/Orchestrator.ts
import { Notice } from "obsidian";
import { BaseAgent } from "./BaseAgent";
import { TaskItem, TaskStatus, QueueData } from "./types";
import { Persistence } from "./Persistence";
import { EventBus, OakEvents } from "./EventBus"; // 引入事件定义
import { Logger } from "./utils";
import { AllModelsFailedError } from "./LLMProvider";

export interface OrchestratorDependencies {
    persistence: Persistence;
    eventBus: EventBus;
    getSettings: () => { concurrency: number; maxRetries: number; };
}

export class Orchestrator {
    private _isRunning = false;
    private agents: BaseAgent<any>[] = [];
    private dependencies: OrchestratorDependencies;
    private queueData: QueueData = {};

    private activeTasks = new Map<string, number>();
    private readonly TASK_TIMEOUT_MS = 5 * 60 * 1000;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    constructor(dependencies: OrchestratorDependencies) {
        this.dependencies = dependencies;
    }

    registerAgent(agent: BaseAgent<any>) {
        this.agents.push(agent);
        if (!this.queueData[agent.queueName]) {
            this.queueData[agent.queueName] = {};
        }
        Logger.log(`Registered Agent: ${agent.constructor.name} -> Queue: ${agent.queueName}`);
    }

    async loadInitialQueueData() {
        this.queueData = await this.dependencies.persistence.loadQueueData();
    }

    async addToQueue(queueName: string, item: Omit<TaskItem, 'id' | 'status' | 'retries'>): Promise<string> {
        const id = Date.now().toString() + "-" + Math.random().toString(36).substr(2, 9);
        const fullItem: TaskItem = {
            id,
            status: TaskStatus.QUEUED,
            retries: 0,
            ...item
        };

        if (!this.queueData[queueName]) {
            this.queueData[queueName] = {};
        }
        
        this.queueData[queueName][id] = fullItem;
        
        await this.dependencies.persistence.saveQueueData(this.queueData);
        // 【新增】触发任务添加事件
        this.dependencies.eventBus.emit(OakEvents.TASK_ADDED, { taskId: id, queueName, payload: item });
        
        Logger.log(`Task added to ${queueName}: ${id}`);
        return id;
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

    private cleanupZombieTasks() {
        const now = Date.now();
        for (const [taskId, startTime] of this.activeTasks.entries()) {
            if (now - startTime > this.TASK_TIMEOUT_MS) {
                Logger.warn(`🧹 [Zombie Sweeper] Task '${taskId}' timed out. Re-queuing.`);
                this.activeTasks.delete(taskId);
                const item = this.findTaskItemById(taskId);
                if(item) {
                    item.status = TaskStatus.FAILED; // 标记为失败，以便重试
                    item.retries++;
                }
            }
        }
    }
    
    // 辅助函数：根据ID查找任务项
    private findTaskItemById(taskId: string): { item: TaskItem; queueName: string } | null {
        for (const queueName in this.queueData) {
            if (this.queueData[queueName][taskId]) {
                return { item: this.queueData[queueName][taskId], queueName };
            }
        }
        return null;
    }

    private async loop() {
        if (!this._isRunning) return;

        this.cleanupZombieTasks();

        const maxConcurrency = this.dependencies.getSettings().concurrency || 3;
        // 【修复】将 const 改为 let，以便在循环中修改
        let slotsAvailable = maxConcurrency - this.activeTasks.size;

        if (slotsAvailable > 0) {
            for (const agent of this.agents) {
                if (slotsAvailable <= 0 || !this._isRunning) break;

                const queueName = agent.queueName;
                const queue = this.queueData[queueName];
                if (!queue) continue;

                const nextTaskId = Object.keys(queue).find(id => queue[id].status === TaskStatus.QUEUED);
                
                if (nextTaskId) {
                    const item = queue[nextTaskId];
                    item.status = TaskStatus.RUNNING;
                    this.activeTasks.set(nextTaskId, Date.now());
                    slotsAvailable--; // 现在可以安全地修改了
                    
                    await this.dependencies.persistence.saveQueueData(this.queueData);
                    // 【新增】触发任务开始事件
                    this.dependencies.eventBus.emit(OakEvents.TASK_STARTED, { taskId: nextTaskId, agent: agent.constructor.name, queueName });
                    
                    this.processTask(agent, item).catch(err => {
                        Logger.error(`Unhandled error in processTask for ${nextTaskId}`, err);
                        if(this.activeTasks.has(nextTaskId)) {
                             this.activeTasks.delete(nextTaskId);
                             const failedItem = this.findTaskItemById(nextTaskId);
                             if(failedItem) {
                                failedItem.item.status = TaskStatus.FAILED;
                                failedItem.item.retries++;
                             }
                        }
                    });
                }
            }
        }

        const delay = this.activeTasks.size > 0 ? 1000 : 3000;
        
        if (this._isRunning) {
            setTimeout(() => this.loop().catch(err => Logger.error("Loop timeout error:", err)), delay);
        }
    }

    private async processTask(agent: BaseAgent<any>, item: TaskItem) {
        const taskId = item.id!;
        const queueName = agent.queueName;
        let taskSucceeded = false;

        try {
            Logger.log(`Processing task ${taskId} in ${queueName}...`);
            
            const updatedItem = await agent.process(item);
            
            // 【修改】任务成功，更新状态
            this.queueData[queueName][taskId] = { ...updatedItem, status: TaskStatus.SUCCESS };
            taskSucceeded = true;

            // 清理缓存
            await this.dependencies.persistence.deleteTaskCache(taskId);
            
            Logger.log(`✅ Task ${taskId} completed.`);
            // 【新增】触发任务成功事件
            this.dependencies.eventBus.emit(OakEvents.TASK_COMPLETED, { taskId, queueName });
            
        } catch (error) {
            Logger.error(`Agent ${agent.constructor.name} failed task ${taskId}:`, error);
            
            if (error instanceof AllModelsFailedError) {
                 Logger.error(`🛑 Engine paused due to fatal error: ${error.message}`);
                 new Notice(`引擎紧急暂停: 所有 API Key 均不可用。`);
                 this.stop();
                 this.activeTasks.delete(taskId);
                 this.queueData[queueName][taskId].status = TaskStatus.FAILED;
                 await this.dependencies.persistence.saveQueueData(this.queueData);
                 return;
            }

            const itemToUpdate = this.queueData[queueName][taskId];
            itemToUpdate.retries++;
            const maxRetries = this.dependencies.getSettings().maxRetries || 3;
            
            if (itemToUpdate.retries < maxRetries) {
                Logger.warn(`Task ${taskId} retrying (${itemToUpdate.retries}/${maxRetries})`);
                itemToUpdate.status = TaskStatus.QUEUED;
                // 【新增】触发任务失败事件 (将重试)
                this.dependencies.eventBus.emit(OakEvents.TASK_FAILED, { taskId, queueName, error: error.message, willRetry: true });
            } else {
                Logger.error(`Task ${taskId} max retries reached. Discarding.`);
                itemToUpdate.status = TaskStatus.DISCARDED;
                taskSucceeded = true; // 对于清理而言，成功和丢弃都是最终状态
                new Notice(`任务 ${taskId} 已达最大重试次数，已被丢弃。`);
                await this.dependencies.persistence.deleteTaskCache(taskId);
                // 【新增】触发任务丢弃事件
                this.dependencies.eventBus.emit(OakEvents.TASK_DISCARDED, { taskId, queueName, error: error.message });
            }
            
        } finally {
            // 【关键】无论成功、失败还是丢弃，都释放槽位
            this.activeTasks.delete(taskId);
            
            // 【新增】如果任务达到最终状态 (成功 或 丢弃)，则清理队列数据并持久化
            if (taskSucceeded) {
                delete this.queueData[queueName][taskId];
                // 清理空队列
                if (Object.keys(this.queueData[queueName]).length === 0) {
                    delete this.queueData[queueName];
                }
                await this.dependencies.persistence.saveQueueData(this.queueData, { clean: true });
            } else {
                // 如果任务失败但将重试，也需要保存其状态
                await this.dependencies.persistence.saveQueueData(this.queueData);
            }
        }
    }
}
