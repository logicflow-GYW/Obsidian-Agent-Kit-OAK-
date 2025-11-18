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

        // 确保输出目录存在
        if (!await this.app.vault.adapter.exists(this.data.settings.output_dir)) {
            await this.app.vault.createFolder(this.data.settings.output_dir);
        }

        this.addSettingTab(new OAKSettingTab(this.app, this));

        this.llm = new LLMProvider(this.data.settings);
        this.orchestrator = new Orchestrator(this);

        this.orchestrator.registerAgent(new GeneratorAgent(this as any, this.llm));

        // --- 新增：添加自定义任务的命令 ---
        this.addCommand({
            id: 'add-custom-concept',
            name: '添加新概念到生成队列',
            callback: () => {
                new InputModal(this.app, (concept) => {
                    this.orchestrator.addToQueue("generation_queue", { concept: concept });
                    new Notice(`已将 '${concept}' 加入队列。记得启动引擎哦！`);
                }).open();
            }
        });

        // --- 引擎开关命令 ---
        this.addCommand({
            id: 'toggle-oak',
            name: '启动/停止 OAK 引擎',
            callback: () => {
               this.orchestrator.start(); 
            }
        });
        
        // --- Ribbon 图标 (点击直接输入) ---
        this.addRibbonIcon('bot', 'OAK Agent Kit', () => {
            new InputModal(this.app, (concept) => {
                this.orchestrator.addToQueue("generation_queue", { concept: concept });
                this.orchestrator.start(); 
            }).open();
        });
    }

    async loadData() {
        const loaded = await super.loadData();
        this.data = Object.assign({}, DEFAULT_DATA, loaded);
        this.data.settings = Object.assign({}, DEFAULT_DATA.settings, loaded?.settings);
    }

    async saveData() {
        await super.saveData(this.data);
        if (this.llm) {
            this.llm = new LLMProvider(this.data.settings);
        }
    }
}
