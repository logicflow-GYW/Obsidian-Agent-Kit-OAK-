// src/main.ts
import { Plugin, Notice } from "obsidian";
import { PluginData } from "./core/types";
import { Orchestrator } from "./core/Orchestrator";
import { LLMProvider } from "./core/LLMProvider";
import { GeneratorAgent } from "./agents/GeneratorAgent"; // 引入 Agent 实现
import { OAKSettingTab } from "./settings";
import { InputModal } from "./InputModal"; 

const DEFAULT_DATA: PluginData = {
    queues: {
        "generation_queue": []
    },
    settings: {
        llmProvider: "openai",
        openaiApiKey: "",
        openaiBaseUrl: "https://api.openai.com/v1",
        openaiModel: "gpt-3.5-turbo",
        googleApiKey: "",
        googleModel: "gemini-1.5-flash",
        maxRetries: 3, // 新增默认重试次数
        prompt_generator: "请详细解释概念: {concept}，包含定义、原理和应用。",
        output_dir: "KnowledgeGraph"
    }
};

export default class AgentKitPlugin extends Plugin {
    data: PluginData;
    orchestrator: Orchestrator;
    llm: LLMProvider;

    async onload() {
        await this.loadData();

        if (!await this.app.vault.adapter.exists(this.data.settings.output_dir)) {
            await this.app.vault.createFolder(this.data.settings.output_dir);
        }

        this.addSettingTab(new OAKSettingTab(this.app, this));

        // --- 修改 ---: 传入一个返回最新 settings 的函数，解决配置热更新问题
        this.llm = new LLMProvider(() => this.data.settings);
        this.orchestrator = new Orchestrator(this);

        // --- 修改 ---: 现在 'this' 的类型是匹配的，不再需要 'as any'
        this.orchestrator.registerAgent(new GeneratorAgent(this, this.llm));

        this.addCommand({
            id: 'add-custom-concept',
            name: '添加新概念到生成队列',
            callback: () => {
                new InputModal(this.app, (concept) => {
                    // --- 修改 ---: 使用 Agent 定义的常量作为队列名，避免硬编码
                    this.orchestrator.addToQueue(GeneratorAgent.QUEUE_NAME, { concept: concept });
                    new Notice(`已将 '${concept}' 加入队列。`);
                }).open();
            }
        });

        // --- 修改 ---: 实现真正的启动/停止切换逻辑
        this.addCommand({
            id: 'toggle-oak',
            name: '启动/停止 OAK 引擎',
            callback: () => {
               if (this.orchestrator.isRunning) {
                   this.orchestrator.stop();
               } else {
                   this.orchestrator.start();
               }
            }
        });
        
        this.addRibbonIcon('bot', 'OAK: 添加新概念', () => {
            new InputModal(this.app, (concept) => {
                this.orchestrator.addToQueue(GeneratorAgent.QUEUE_NAME, { concept: concept });
                // 只有在引擎未运行时才启动，避免重复提示
                if (!this.orchestrator.isRunning) {
                    this.orchestrator.start(); 
                }
            }).open();
        });
    }

    async loadData() {
        const loaded = await super.loadData();
        // 使用 structuredClone 进行深层合并，避免嵌套对象被覆盖
        this.data = {
            ...DEFAULT_DATA,
            ...loaded,
            settings: {
                ...DEFAULT_DATA.settings,
                ...(loaded?.settings || {})
            },
            queues: {
                ...DEFAULT_DATA.queues,
                ...(loaded?.queues || {})
            }
        };
    }

    async saveData() {
        await super.saveData(this.data);
        // --- 移除 ---: 不再需要在这里重新创建 LLMProvider 实例
        // if (this.llm) {
        //     this.llm = new LLMProvider(this.data.settings);
        // }
    }
}
