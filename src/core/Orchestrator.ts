import { Notice, Plugin } from "obsidian";
import { BaseAgent } from "./BaseAgent";
import { PluginData } from "./types";

export class Orchestrator {
    private isRunning = false;
    private agents: BaseAgent<any>[] = [];
    // 保存 plugin 引用
    private plugin: Plugin & { data: PluginData, saveData: () => Promise<void> };

    constructor(plugin: any) {
        this.plugin = plugin;
    }

    /**
     * 注册一个智能体
     */
    registerAgent(agent: BaseAgent<any>) {
        this.agents.push(agent);
        if (!this.plugin.data.queues[agent.queueName]) {
            this.plugin.data.queues[agent.queueName] = [];
        }
        console.log(`[Orchestrator] 已注册 Agent: ${agent.constructor.name} -> 监听队列: ${agent.queueName}`);
    }

    /**
     * 添加任务到队列 (Agent 可以调用此方法进行任务流转)
     */
    async addToQueue(queueName: string, item: any) {
        if (!this.plugin.data.queues[queueName]) {
            this.plugin.data.queues[queueName] = [];
        }
        this.plugin.data.queues[queueName].push(item);
        await this.plugin.saveData();
        // 可选：给个提示
        // new Notice(`[${queueName}] +1 任务`);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        new Notice("🚀 引擎已启动");
        this.loop();
    }

    stop() {
        this.isRunning = false;
        new Notice("🛑 引擎已暂停");
    }

    private async loop() {
        if (!this.isRunning) return;

        let workDone = false;

        for (const agent of this.agents) {
            if (!this.isRunning) break;

            const queueName = agent.queueName;
            const queue = this.plugin.data.queues[queueName];

            if (queue && queue.length > 0) {
                const item = queue[0]; // Peek
                
                try {
                    // 执行处理
                    const success = await agent.process(item);
                    
                    if (success) {
                        queue.shift(); // 成功后移除
                        await this.plugin.saveData();
                        workDone = true;
                        // 这一轮只做一个任务，避免卡顿
                        break; 
                    }
                } catch (error) {
                    console.error(`[Agent Error] ${agent.constructor.name}:`, error);
                    new Notice(`Agent ${agent.constructor.name} 出错: ${error.message}`);
                    // 简单的防死循环机制：出错了就暂停
                    this.stop();
                    break;
                }
            }
        }

        // 动态调整心跳：有活干就快点(100ms)，没活干就休眠(2000ms)
        const delay = workDone ? 100 : 2000; 
        setTimeout(() => this.loop(), delay);
    }
}