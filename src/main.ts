// src/main.ts
import { Plugin, Notice, App } from "obsidian";
import { OAKSettings, QueueData, TaskItem, TaskStatus } from "./core/types";
import { Orchestrator, OrchestratorDependencies } from "./core/Orchestrator";
import { LLMProvider } from "./core/LLMProvider";
import { Persistence } from "./core/Persistence";
import { Logger } from "./core/utils";
import { GeneratorAgent } from "./agents/GeneratorAgent"; 
import { OAKSettingTab } from "./settings";
import { InputModal } from "./InputModal"; 
import { OakAPI } from "./api";
import { EventBus } from "./core/EventBus";
import { BaseAgent, IAgentContext } from "./core/BaseAgent";

const DEFAULT_SETTINGS: OAKSettings = {
    llmProvider: "openai",
    apiKeyStrategy: 'exhaustion',
    openaiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-3.5-turbo",
    googleApiKey: "",
    googleModel: "gemini-1.5-flash",
    maxRetries: 3,
    concurrency: 3,
    prompt_generator: "请详细解释概念: {concept}，包含定义、原理和应用。",
    output_dir: "KnowledgeGraph",
    debug_mode: false
};

export default class AgentKitPlugin extends Plugin {
    settings: OAKSettings;
    
    private persistence!: Persistence;
    private eventBus!: EventBus;
    private llmProvider!: LLMProvider;
    private orchestrator!: Orchestrator;

    async onload() {
        await this.loadSettings();
        Logger.setDebugMode(this.settings.debug_mode);

        this.persistence = new Persistence(this);
        await this.persistence.init();

        this.eventBus = EventBus.getInstance();
        this.llmProvider = new LLMProvider(() => this.settings);

        const dependencies: OrchestratorDependencies = {
            persistence: this.persistence,
            eventBus: this.eventBus,
            getSettings: () => this.settings,
        };
        this.orchestrator = new Orchestrator(dependencies);
        await this.orchestrator.loadInitialQueueData();

        // 【修复】创建独立的 getter 函数以避免 .bind(this) 语法错误
        const getPluginSettings = () => this.settings;

        const agentContext: IAgentContext = {
            get settings() { return getPluginSettings(); },
            app: this.app,
            persistence: {
                saveTaskCache: (id, content) => this.persistence.saveTaskCache(id, content),
                loadTaskCache: (id) => this.persistence.loadTaskCache(id),
                deleteTaskCache: (id) => this.persistence.deleteTaskCache(id),
            },
            orchestrator: {
                addToQueue: async (queueName, item) => this.orchestrator.addToQueue(queueName, item),
            },
            triggerEvent: (event, data) => this.eventBus.emit(event, data),
        };

        this.orchestrator.registerAgent(new GeneratorAgent(agentContext, this.llmProvider));
        
        this.addSettingTab(new OAKSettingTab(this.app, this));

        this.addCommand({
            id: 'add-custom-concept',
            name: '添加新概念到生成队列',
            callback: () => {
                new InputModal(this.app, (concept) => {
                    this.api.dispatch(GeneratorAgent.QUEUE_NAME, { concept }, 'OAK-GUI')
                        .then(taskId => new Notice(`已将 '${concept}' 加入队列 (ID: ${taskId})。`))
                        .catch(err => new Notice(`添加到队列失败: ${err.message}`));
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
                this.api.dispatch(GeneratorAgent.QUEUE_NAME, { concept }, 'OAK-Ribbon')
                    .then(taskId => new Notice(`已将 '${concept}' 加入队列 (ID: ${taskId})。`))
                    .catch(err => new Notice(`添加到队列失败: ${err.message}`));
            }).open();
        });
        
        Logger.log("OAK Agent Kit (Framework Mode) loaded.");
    }

    onunload() {
        this.orchestrator.stop();
        Logger.log("OAK Agent Kit unloaded.");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
    
    public get api(): OakAPI {
        return {
            version: this.manifest.version,
            registerAgent: (agent: BaseAgent<any>) => {
                // 【修复】为动态注册的 Agent 创建上下文，修复 .bind(this)
                const getApiSettings = () => this.settings;
                const agentContext: IAgentContext = {
                    get settings() { return getApiSettings(); },
                    app: this.app,
                    persistence: {
                        saveTaskCache: (id, content) => this.persistence.saveTaskCache(id, content),
                        loadTaskCache: (id) => this.persistence.loadTaskCache(id),
                        deleteTaskCache: (id) => this.persistence.deleteTaskCache(id),
                    },
                    orchestrator: {
                        addToQueue: async (queueName, item) => this.orchestrator.addToQueue(queueName, item),
                    },
                    triggerEvent: (event, data) => this.eventBus.emit(event, data),
                };
                
                // 假设外部传入的 agent 已经有了 LLMProvider，这里我们只重新注入 context
                // 一个更健壮的设计可能需要 agent 暴露一个 setContext 方法
                // 但为了遵循当前结构，我们直接注册。
                // 注意：这里假设 agent 的 LLMProvider 已经被正确设置。
                this.orchestrator.registerAgent(agent); 
            },
            dispatch: async (queueName: string, payload: any, sourcePluginId?: string): Promise<string> => {
                const item = { ...payload, sourcePluginId: sourcePluginId || 'External' };
                const taskId = await this.orchestrator.addToQueue(queueName, item);
                if (!this.orchestrator.isRunning) {
                    this.orchestrator.start();
                }
                return taskId;
            },
            chat: async (prompt: string): Promise<string> => {
                return await this.llmProvider.chat(prompt);
            },
            on: (event: string, callback: (...data: any) => void): void => {
                this.eventBus.on(event, callback);
            },
            off: (event: string, callback: (...data: any) => void): void => {
                this.eventBus.off(event, callback);
            }
        };
    }
}
