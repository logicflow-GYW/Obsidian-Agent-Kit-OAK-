// src/settings.ts
import { App, PluginSettingTab, Setting } from "obsidian";
import AgentKitPlugin from "./main";
import { Logger } from "./core/utils";

export class OAKSettingTab extends PluginSettingTab {
    plugin: AgentKitPlugin;
    constructor(app: App, plugin: AgentKitPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        new Setting(containerEl).setName("General").setHeading();

        new Setting(containerEl)
            .setName("Debug mode")
            .setDesc("在控制台显示详细日志 (推荐开启以观察故障切换)")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug_mode)
                .onChange(async (value) => {
                    this.plugin.settings.debug_mode = value;
                    Logger.setDebugMode(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Primary Provider")
            .setDesc("首选 AI 提供商。当其所有 Key 均不可用时，会自动尝试另一个。")
            .addDropdown(d => d
                .addOption("openai", "OpenAI")
                .addOption("google", "Google")
                .setValue(this.plugin.settings.llmProvider)
                .onChange(async v => { 
                    this.plugin.settings.llmProvider = v; 
                    await this.plugin.saveSettings(); 
                    this.display(); 
                }));

        if (this.plugin.settings.llmProvider === "openai") {
            new Setting(containerEl).setName("OpenAI Settings").setHeading();
            this.addOpenAISettings(containerEl);
            this.addGoogleSettings(containerEl); // 即使选了 OpenAI，也显示 Google 以便配置备用
        } else {
            new Setting(containerEl).setName("Google Settings").setHeading();
            this.addGoogleSettings(containerEl);
            this.addOpenAISettings(containerEl);
        }

        new Setting(containerEl).setName("Engine Settings").setHeading();
        // ... 其他设置保持不变，为节省篇幅省略 ...
        new Setting(containerEl).setName("Output Folder").addText(t => t.setValue(this.plugin.settings.output_dir).onChange(async v => { this.plugin.settings.output_dir = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName("Max Retries").addText(t => t.setValue(String(this.plugin.settings.maxRetries)).onChange(async v => { this.plugin.settings.maxRetries = parseInt(v); await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName("Prompt Template").addTextArea(t => { t.setValue(this.plugin.settings.prompt_generator).onChange(async v => { this.plugin.settings.prompt_generator = v; await this.plugin.saveSettings(); }); t.inputEl.rows=5; t.inputEl.style.width="100%"; });
    }

    addOpenAISettings(el: HTMLElement) {
        new Setting(el)
            .setName("OpenAI Keys")
            .setDesc("一行一个 Key。支持自动轮换和冷却。")
            .addTextArea(t => {
                t.setValue(this.plugin.settings.openaiApiKey)
                 .onChange(async v => { this.plugin.settings.openaiApiKey = v; await this.plugin.saveSettings(); });
                t.inputEl.rows = 3;
                t.inputEl.style.width = "100%";
            });
        new Setting(el).setName("Base URL").addText(t => t.setValue(this.plugin.settings.openaiBaseUrl).onChange(async v => { this.plugin.settings.openaiBaseUrl = v; await this.plugin.saveSettings(); }));
        new Setting(el).setName("Model").addText(t => t.setValue(this.plugin.settings.openaiModel).onChange(async v => { this.plugin.settings.openaiModel = v; await this.plugin.saveSettings(); }));
    }

    addGoogleSettings(el: HTMLElement) {
        new Setting(el)
            .setName("Google Keys")
            .setDesc("一行一个 Key。")
            .addTextArea(t => {
                t.setValue(this.plugin.settings.googleApiKey)
                 .onChange(async v => { this.plugin.settings.googleApiKey = v; await this.plugin.saveSettings(); });
                t.inputEl.rows = 3;
                t.inputEl.style.width = "100%";
            });
        new Setting(el).setName("Model").addText(t => t.setValue(this.plugin.settings.googleModel).onChange(async v => { this.plugin.settings.googleModel = v; await this.plugin.saveSettings(); }));
    }
}