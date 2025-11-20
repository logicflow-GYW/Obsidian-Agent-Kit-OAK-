// src/main.ts
import { Plugin, Notice } from "obsidian";
import { PluginData } from "./core/types";
import { Orchestrator } from "./core/Orchestrator";
import { LLMProvider } from "./core/LLMProvider";
import { GeneratorAgent } from "./agents/GeneratorAgent"; 
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
        maxRetries: 3,
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

        this.llm = new LLMProvider(() => this.data.settings);
        this.orchestrator = new Orchestrator(this);

        this.orchestrator.registerAgent(new GeneratorAgent(this, this.llm));

        this.addCommand({
            id: 'add-custom-concept',
            name: '添加新概念到生成队列',
            callback: () => {
                new InputModal(this.app, (concept) => {
                    // [修复]: 处理异步 Promise
                    this.orchestrator.addToQueue(GeneratorAgent.QUEUE_NAME, { concept: concept })
                        .then(() => {
                            new Notice(`已将 '${concept}' 加入队列。`);
                        })
                        .catch((err) => {
                            console.error("Failed to add to queue:", err);
                            new Notice("加入队列失败，请查看控制台。");
                        });
                }).open();
            }
        });

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
                // [修复]: 处理异步 Promise
                this.orchestrator.addToQueue(GeneratorAgent.QUEUE_NAME, { concept: concept })
                    .then(() => {
                         if (!this.orchestrator.isRunning) {
                            this.orchestrator.start(); 
                        }
                    })
                    .catch(console.error);
            }).open();
        });
        
        console.log("OAK Agent Kit loaded.");
    }

    onunload() {
        console.log("OAK Agent Kit unloaded.");
    }

    async loadData() {
        const loaded = await super.loadData();
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
    }
}