import { App, PluginSettingTab, Setting } from "obsidian";
import AgentKitPlugin from "./main";

export class OAKSettingTab extends PluginSettingTab {
    plugin: AgentKitPlugin;
    constructor(app: App, plugin: AgentKitPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "OAK Agent Kit 设置" });
        new Setting(containerEl).setName("AI 模型提供商").addDropdown(d => d.addOption("openai", "OpenAI").addOption("google", "Google").setValue(this.plugin.data.settings.llmProvider).onChange(async v => { this.plugin.data.settings.llmProvider = v; await this.plugin.saveData(); this.display(); }));
        if (this.plugin.data.settings.llmProvider === "openai") {
            new Setting(containerEl).setName("API Key").addText(t => t.setValue(this.plugin.data.settings.openaiApiKey).onChange(async v => { this.plugin.data.settings.openaiApiKey = v; await this.plugin.saveData(); }));
            new Setting(containerEl).setName("Base URL").addText(t => t.setValue(this.plugin.data.settings.openaiBaseUrl).onChange(async v => { this.plugin.data.settings.openaiBaseUrl = v; await this.plugin.saveData(); }));
            new Setting(containerEl).setName("模型名称").addText(t => t.setValue(this.plugin.data.settings.openaiModel).onChange(async v => { this.plugin.data.settings.openaiModel = v; await this.plugin.saveData(); }));
        }
        if (this.plugin.data.settings.llmProvider === "google") {
            new Setting(containerEl).setName("API Key").addText(t => t.setValue(this.plugin.data.settings.googleApiKey).onChange(async v => { this.plugin.data.settings.googleApiKey = v; await this.plugin.saveData(); }));
            new Setting(containerEl).setName("模型名称").addText(t => t.setValue(this.plugin.data.settings.googleModel).onChange(async v => { this.plugin.data.settings.googleModel = v; await this.plugin.saveData(); }));
        }
        new Setting(containerEl).setName("输出文件夹").addText(t => t.setValue(this.plugin.data.settings.output_dir).onChange(async v => { this.plugin.data.settings.output_dir = v; await this.plugin.saveData(); }));
        new Setting(containerEl).setName("生成 Prompt 模板").addTextArea(t => { t.setValue(this.plugin.data.settings.prompt_generator).onChange(async v => { this.plugin.data.settings.prompt_generator = v; await this.plugin.saveData(); }); t.inputEl.rows = 5; });
    }
}
