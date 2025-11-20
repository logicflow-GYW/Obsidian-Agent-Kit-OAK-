// src/core/Orchestrator.ts
import { Notice, Plugin } from "obsidian";
import { BaseAgent } from "./BaseAgent";
import { PluginData, TaskItem } from "./types";

export class Orchestrator {
    private _isRunning = false;
    private agents: BaseAgent<any>[] = [];
    private plugin: Plugin & { data: PluginData, saveData: () => Promise<void> };

    public get isRunning(): boolean {
        return this._isRunning;
    }

    constructor(plugin: any) {
        this.plugin = plugin;
    }

    registerAgent(agent: BaseAgent<any>) {
        this.agents.push(agent);
        if (!this.plugin.data.queues[agent.queueName]) {
            this.plugin.data.queues[agent.queueName] = [];
        }
        console.log(`[Orchestrator] 已注册 Agent: ${agent.constructor.name} -> 监控队列: ${agent.queueName}`);
    }

    async addToQueue(queueName: string, item: TaskItem) {
        if (!this.plugin.data.queues[queueName]) {
            this.plugin.data.queues[queueName] = [];
        }
        item.retries = 0;
        this.plugin.data.queues[queueName].push(item);
        await this.plugin.saveData();
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;
        new Notice("🚀 OAK 引擎已启动");
        // [修复]: 处理悬空 Promise，显式捕获异常
        this.loop().catch(err => console.error("[Orchestrator] Loop error:", err));
    }

    stop() {
        this._isRunning = false;
        new Notice("🛑 OAK 引擎已停止");
    }

    private async loop() {
        if (!this._isRunning) return;

        let workDone = false;

        for (const agent of this.agents) {
            if (!this._isRunning) break;

            const queueName = agent.queueName;
            const queue = this.plugin.data.queues[queueName];

            if (queue && queue.length > 0) {
                const item = queue[0]; 
                
                try {
                    const success = await agent.process(item);
                    
                    if (success) {
                        queue.shift();
                        workDone = true;
                    } else {
                        throw new Error("Agent process returned false.");
                    }
                } catch (error) {
                    console.error(`[Agent Error] ${agent.constructor.name} 处理任务失败:`, item, error);
                    workDone = true;
                    
                    const failedItem = queue.shift();
                    if (failedItem) {
                        failedItem.retries = (failedItem.retries || 0) + 1;
                        
                        const maxRetries = this.plugin.data.settings.maxRetries || 3;
                        if (failedItem.retries < maxRetries) {
                            queue.push(failedItem);
                            new Notice(`任务失败，将在稍后重试 (${failedItem.retries}/${maxRetries})`);
                        } else {
                            new Notice(`任务已达最大重试次数，已被放弃。请检查日志。`);
                            console.error(`[Agent Error] 任务永久失败:`, failedItem);
                        }
                    }
                } finally {
                    await this.plugin.saveData();
                }
            }
        }

        const delay = workDone ? 100 : 2000; 
        // [修复]: 处理 setTimeout 中的悬空 Promise
        setTimeout(() => {
            this.loop().catch(err => console.error("[Orchestrator] Loop error in timeout:", err));
        }, delay);
    }
}