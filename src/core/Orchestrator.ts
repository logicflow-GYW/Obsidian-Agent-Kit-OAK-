// src/core/Orchestrator.ts
import { Notice } from "obsidian";
import { BaseAgent } from "./BaseAgent";
import { TaskItem, QueueData } from "./types";
import AgentKitPlugin from "../main";
import { Logger } from "./utils";

export class Orchestrator {
    private _isRunning = false;
    private agents: BaseAgent<any>[] = [];
    private plugin: AgentKitPlugin;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    constructor(plugin: AgentKitPlugin) {
        this.plugin = plugin;
    }

    registerAgent(agent: BaseAgent<any>) {
        this.agents.push(agent);
        // 确保队列初始化
        if (!this.plugin.queueData[agent.queueName]) {
            this.plugin.queueData[agent.queueName] = [];
        }
        Logger.log(`Registered Agent: ${agent.constructor.name} -> Queue: ${agent.queueName}`);
    }

    async addToQueue(queueName: string, item: TaskItem) {
        if (!this.plugin.queueData[queueName]) {
            this.plugin.queueData[queueName] = [];
        }
        
        // 赋予默认属性
        item.retries = 0;
        if (!item.id) item.id = Date.now().toString(); // 简单的 ID 生成

        this.plugin.queueData[queueName].push(item);
        
        // 通过 Persistence 保存
        await this.plugin.persistence.saveQueueData(this.plugin.queueData);
        Logger.log(`Task added to ${queueName}`);
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
                    const success = await agent.process(item);
                    
                    if (success) {
                        queue.shift(); // 移除成功任务
                        workDone = true;
                    } else {
                        throw new Error("Agent process returned false.");
                    }
                } catch (error) {
                    Logger.error(`Agent ${agent.constructor.name} failed:`, error);
                    workDone = true;
                    
                    const failedItem = queue.shift();
                    if (failedItem) {
                        failedItem.retries = (failedItem.retries || 0) + 1;
                        
                        const maxRetries = this.plugin.settings.maxRetries || 3;
                        if (failedItem.retries < maxRetries) {
                            queue.push(failedItem); // 重新入队到末尾
                            Logger.warn(`Task retrying (${failedItem.retries}/${maxRetries})`);
                        } else {
                            Logger.error(`Task max retries reached. Discarding.`);
                            new Notice(`任务已达最大重试次数，已被放弃。`);
                            // 这里可以考虑加一个 "discarded" 队列，就像 KGG 那样
                        }
                    }
                } finally {
                    // 每次任务处理完（无论成功失败），保存队列状态
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
}