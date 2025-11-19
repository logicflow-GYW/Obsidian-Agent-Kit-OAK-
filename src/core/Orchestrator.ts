// src/core/Orchestrator.ts
import { Notice } from "obsidian";
import { BaseAgent, IAgentPluginContext } from "./BaseAgent"; // --- 修改 ---: 引入接口
import { TaskItem } from "./types";

export class Orchestrator {
    private _isRunning = false;
    private agents: BaseAgent<any>[] = [];
    
    // --- 修改 ---: 使用接口类型，获得完整的代码提示
    private plugin: IAgentPluginContext;

    public get isRunning(): boolean {
        return this._isRunning;
    }

    // --- 修改 ---: 构造函数类型安全化
    constructor(plugin: IAgentPluginContext) {
        this.plugin = plugin;
    }

    registerAgent(agent: BaseAgent<any>) {
        this.agents.push(agent);
        // 使用接口后，这里的 data 和 queues 都会有自动补全
        if (!this.plugin.data.queues[agent.queueName]) {
            this.plugin.data.queues[agent.queueName] = [];
        }
        // --- 修改 ---: 使用 info 级别记录生命周期事件
        console.info(`[Orchestrator] 已注册 Agent: ${agent.constructor.name} -> 监控队列: ${agent.queueName}`);
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
        this.loop();
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
                } catch (error: unknown) { // --- 修改 ---: 标准化错误捕获
                    const err = error instanceof Error ? error : new Error(String(error));
                    console.error(`[Agent Error] ${agent.constructor.name} 处理任务失败:`, item, err);
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
        setTimeout(() => this.loop(), delay);
    }
}