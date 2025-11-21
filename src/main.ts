// src/main.ts
import { Plugin, Notice } from "obsidian";
import { OAKSettings, QueueData } from "./core/types"; // 更新引用
import { Orchestrator } from "./core/Orchestrator";
import { LLMProvider } from "./core/LLMProvider";
import { Persistence } from "./core/Persistence"; // 新增
import { Logger } from "./core/utils"; // 新增
import { GeneratorAgent } from "./agents/GeneratorAgent"; 
import { OAKSettingTab } from "./settings";
import { InputModal } from "./InputModal"; 

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
    queueData: QueueData; // 运行时队列数据
    
    orchestrator: Orchestrator;
    llm: LLMProvider;
    persistence: Persistence;

    async onload() {
        // 1. 加载配置 (data.json)
        await this.loadSettings();
        Logger.setDebugMode(this.settings.debug_mode);

        // 2. 初始化持久化层
        this.persistence = new Persistence(this);
        await this.persistence.init();

        // 3. 加载队列数据 (queues.json)
        this.queueData = await this.persistence.loadQueueData();
        
        // 4. 确保输出目录存在
        if (!await this.app.vault.adapter.exists(this.settings.output_dir)) {
            await this.app.vault.createFolder(this.settings.output_dir);
        }

        this.addSettingTab(new OAKSettingTab(this.app, this));

        // 5. 初始化核心组件
        // 注意：LLMProvider 仍然使用旧版，暂不修改，下一阶段升级
        this.llm = new LLMProvider(() => this.settings);
        this.orchestrator = new Orchestrator(this);

        // 6. 注册 Agent
        // GeneratorAgent 需要适配新的 BaseAgent 签名，但在本阶段 BaseAgent 变动较小，
        // 主要是 types 变了，Agent 代码可能只需要很少修改。
        // 我们这里要把 'this' cast 一下或者确保 GeneratorAgent 接受的 context 正确
        this.orchestrator.registerAgent(new GeneratorAgent(this, this.llm));

        // --- Commands & UI ---
        this.addCommand({
            id: 'add-custom-concept',
            name: '添加新概念到生成队列',
            callback: () => {
                new InputModal(this.app, (concept) => {
                    this.orchestrator.addToQueue(GeneratorAgent.QUEUE_NAME, { concept: concept })
                        .then(() => {
                            new Notice(`已将 '${concept}' 加入队列。`);
                        })
                        .catch((err) => {
                            Logger.error("Failed to add to queue:", err);
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
                this.orchestrator.addToQueue(GeneratorAgent.QUEUE_NAME, { concept: concept })
                    .then(() => {
                         if (!this.orchestrator.isRunning) {
                            this.orchestrator.start(); 
                        }
                    })
                    .catch(err => Logger.error(err));
            }).open();
        });
        
        Logger.log("OAK Agent Kit loaded.");
    }

    onunload() {
        Logger.log("OAK Agent Kit unloaded.");
    }

    async loadSettings() {
        // 仅加载 data.json 中的配置
        const loaded = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    }

    async saveSettings() {
        // 仅保存配置
        await this.saveData(this.settings);
    }
    
    // 注意：移除了 savePluginData 之类的方法，现在由 Persistence 接管
}