// src/core/Orchestrator.ts
import { Notice } from "obsidian";
import { BaseAgent } from "./BaseAgent";
import { TaskItem } from "./types";
import { EventBus, OakEvents } from "./EventBus";
import AgentKitPlugin from "../main";
import { Logger } from "./utils";
import { AgentResult } from "../api"; // 引入新定义的接口

export class Orchestrator {
    private _isRunning = false;
    private agents: BaseAgent<any>[] = [];
    private plugin: AgentKitPlugin;
    private eventBus: EventBus;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    constructor(plugin: AgentKitPlugin) {
        this.plugin = plugin;
        this.eventBus = EventBus.getInstance();
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
        
        // 初始化元数据
        item.retries = item.retries || 0;
        if (!item.id) item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        if (!item.timestamp) item.timestamp = Date.now();

        this.plugin.queueData[queueName].push(item);
        
        // 保存并广播
        await this.plugin.persistence.saveQueueData(this.plugin.queueData);
        this.eventBus.emit(OakEvents.TASK_ADDED, { queueName, task: item });
        Logger.log(`Task added to ${queueName} (Source: ${item.sourcePluginId || 'System'})`);
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

    private async loop() {
        if (!this._isRunning) return;

        let workDone = false;

        for (const agent of this.agents) {
            if (!this._isRunning) break;

            const queueName = agent.queueName;
            const queue = this.plugin.queueData[queueName];

            if (queue && queue.length > 0) {
                const item = queue[0]; 
                
                try {
                    Logger.log(`Processing task in ${queueName}...`);
                    this.eventBus.emit(OakEvents.TASK_STARTED, { queueName, task: item });
                    
                    // 兼容旧版返回 boolean，新版返回 AgentResult
                    const result: boolean | AgentResult = await agent.process(item);
                    
                    // 归一化处理结果
                    const isSuccess = typeof result === 'boolean' ? result : result.status === 'success';

                    if (isSuccess) {
                        queue.shift(); // 移除成功任务
                        workDone = true;
                        
                        const outputData = typeof result === 'object' ? result.data : null;
                        
                        // 触发完成事件
                        this.eventBus.emit(OakEvents.TASK_COMPLETED, { 
                            queueName, 
                            taskId: item.id, 
                            result: outputData 
                        });

                        // 处理任务链 (Chaining)
                        if (typeof result === 'object' && result.nextTasks && result.nextTasks.length > 0) {
                            Logger.log(`🔗 Triggering ${result.nextTasks.length} next tasks`);
                            for (const next of result.nextTasks) {
                                await this.addToQueue(next.queueName, {
                                    ...next.payload,
                                    sourcePluginId: 'OAK-Chaining', // 标记为内部链式触发
                                    parentId: item.id
                                });
                            }
                        }

                    } else {
                        throw new Error(typeof result === 'object' ? result.message : "Agent process returned false");
                    }
                } catch (error) {
                    this.handleFailure(queue, item, queueName, error);
                    workDone = true;
                } finally {
                    await this.plugin.persistence.saveQueueData(this.plugin.queueData);
                }
            }
        }

        const delay = workDone ? 100 : 2000; 
        if (this._isRunning) {
            setTimeout(() => {
                this.loop().catch(err => Logger.error("Loop timeout error:", err));
            }, delay);
        }
    }

    private handleFailure(queue: TaskItem[], item: TaskItem, queueName: string, error: any) {
        Logger.error(`Agent failed in ${queueName}:`, error);
        
        const failedItem = queue.shift();
        if (failedItem) {
            failedItem.retries = (failedItem.retries || 0) + 1;
            const maxRetries = this.plugin.settings.maxRetries || 3;

            if (failedItem.retries < maxRetries) {
                queue.push(failedItem); // 重新入队
                this.eventBus.emit(OakEvents.TASK_FAILED, { queueName, task: failedItem, error });
                Logger.warn(`Task retrying (${failedItem.retries}/${maxRetries})`);
            } else {
                this.eventBus.emit(OakEvents.TASK_DISCARDED, { queueName, task: failedItem, error });
                Logger.error(`Task max retries reached. Discarding.`);
                new Notice(`任务已达最大重试次数，已被放弃。`);
            }
        }
    }
}