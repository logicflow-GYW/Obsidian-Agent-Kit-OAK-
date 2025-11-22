// src/main.ts
import { Plugin, Notice } from "obsidian";
import { OAKSettings, QueueData } from "./core/types";
import { Orchestrator } from "./core/Orchestrator";
import { LLMProvider } from "./core/LLMProvider";
import { Persistence } from "./core/Persistence";
import { Logger } from "./core/utils";
import { GeneratorAgent } from "./agents/GeneratorAgent"; 
import { OAKSettingTab } from "./settings";
import { InputModal } from "./InputModal"; 
import { OakAPI } from "./api"; // 引入 API 定义
import { EventBus } from "./core/EventBus"; // 引入 EventBus

const DEFAULT_SETTINGS: OAKSettings = {
    llmProvider: "openai",
    openaiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-3.5-turbo",
    googleApiKey: "",
    googleModel: "gemini-1.5-flash",
    maxRetries: 3,
    prompt_generator: "请详细解释概念: {concept}，包含定义、原理和应用。",
    output_dir: "KnowledgeGraph",
    debug_mode: false
};

export default class AgentKitPlugin extends Plugin {
    settings: OAKSettings;
    queueData: QueueData; 
    
    orchestrator: Orchestrator;
    llm: LLMProvider;
    persistence: Persistence;
    eventBus: EventBus;

    // --- 核心：暴露 API 给其他插件 ---
    public get api(): OakAPI {
        return {
            version: this.manifest.version,
            registerAgent: (agent) => this.orchestrator.registerAgent(agent),
            dispatch: async (queueName, payload, sourcePluginId) => {
                // 为外部调用注入来源ID
                const item = { ...payload, sourcePluginId: sourcePluginId || 'External' };
                await this.orchestrator.addToQueue(queueName, item);
                // 确保引擎已启动
                if (!this.orchestrator.isRunning) this.orchestrator.start();
                return item.id; 
            },
            on: (event, cb) => this.eventBus.on(event, cb),
            off: (event, cb) => this.eventBus.off(event, cb)
        };
    }
    // ------------------------------

    async onload() {
        await this.loadSettings();
        Logger.setDebugMode(this.settings.debug_mode);

        this.persistence = new Persistence(this);
        await this.persistence.init();

        this.queueData = await this.persistence.loadQueueData();
        
        // 初始化 EventBus
        this.eventBus = EventBus.getInstance();
        
        if (!await this.app.vault.adapter.exists(this.settings.output_dir)) {
            await this.app.vault.createFolder(this.settings.output_dir);
        }

        this.addSettingTab(new OAKSettingTab(this.app, this));

        this.llm = new LLMProvider(() => this.settings);
        this.orchestrator = new Orchestrator(this);

        // 注册内置 Agent
        this.orchestrator.registerAgent(new GeneratorAgent(this, this.llm));

        // --- Commands & UI ---
        this.addCommand({
            id: 'add-custom-concept',
            name: '添加新概念到生成队列',
            callback: () => {
                new InputModal(this.app, (concept) => {
                    // 内部调用也可以走 dispatch，保持一致性
                    this.api.dispatch(GeneratorAgent.QUEUE_NAME, { concept }, 'OAK-GUI')
                        .then(() => new Notice(`已将 '${concept}' 加入队列。`));
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
                this.api.dispatch(GeneratorAgent.QUEUE_NAME, { concept }, 'OAK-Ribbon');
            }).open();
        });
        
        Logger.log("OAK Agent Kit (Framework Mode) loaded.");
    }

    onunload() {
        this.orchestrator.stop();
        // 清理事件监听，如果有的话
        Logger.log("OAK Agent Kit unloaded.");
    }

    async loadSettings() {
        const loaded = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}