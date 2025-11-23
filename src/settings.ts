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
        
        new Setting(containerEl)
            .setName("General")
            .setHeading();

        // 1. Debug Mode
        new Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Enable verbose logging in console for troubleshooting.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug_mode)
                .onChange(async (value) => {
                    this.plugin.settings.debug_mode = value;
                    Logger.setDebugMode(value);
                    await this.plugin.saveSettings();
                }));

        // 2. AI Provider
        new Setting(containerEl)
            .setName("AI Model Provider")
            .addDropdown(d => d
                .addOption("openai", "OpenAI")
                .addOption("google", "Google")
                .setValue(this.plugin.settings.llmProvider)
                .onChange(async v => { 
                    this.plugin.settings.llmProvider = v; 
                    await this.plugin.saveSettings(); 
                    this.display(); 
                }));

        // 3. OpenAI 设置区
        if (this.plugin.settings.llmProvider === "openai") {
            new Setting(containerEl).setName("OpenAI").setHeading();
            
            new Setting(containerEl)
                .setName("API Keys")
                .setDesc("支持多 Key 轮换。请每行输入一个 API Key。当第一个失败时，会自动尝试下一个。")
                .addTextArea(t => {
                    t.setValue(this.plugin.settings.openaiApiKey)
                     .onChange(async v => { 
                        this.plugin.settings.openaiApiKey = v; 
                        await this.plugin.saveSettings(); 
                     });
                    t.inputEl.rows = 4;
                    t.inputEl.style.width = "100%";
                });
            
            new Setting(containerEl)
                .setName("Base URL")
                .addText(t => t
                    .setValue(this.plugin.settings.openaiBaseUrl)
                    .onChange(async v => { 
                        this.plugin.settings.openaiBaseUrl = v; 
                        await this.plugin.saveSettings(); 
                    }));
            
            new Setting(containerEl)
                .setName("Model Name")
                .addText(t => t
                    .setValue(this.plugin.settings.openaiModel)
                    .onChange(async v => { 
                        this.plugin.settings.openaiModel = v; 
                        await this.plugin.saveSettings(); 
                    }));
        }

        // 4. Google 设置区
        if (this.plugin.settings.llmProvider === "google") {
            new Setting(containerEl).setName("Google Gemini").setHeading();

            new Setting(containerEl)
                .setName("API Keys")
                .setDesc("支持多 Key 轮换。请每行输入一个 API Key。")
                .addTextArea(t => {
                    t.setValue(this.plugin.settings.googleApiKey)
                     .onChange(async v => { 
                        this.plugin.settings.googleApiKey = v; 
                        await this.plugin.saveSettings(); 
                     });
                    t.inputEl.rows = 4;
                    t.inputEl.style.width = "100%";
                });
            
            new Setting(containerEl)
                .setName("Model Name")
                .addText(t => t
                    .setValue(this.plugin.settings.googleModel)
                    .onChange(async v => { 
                        this.plugin.settings.googleModel = v; 
                        await this.plugin.saveSettings(); 
                    }));
        }

        // 5. 引擎设置区
        new Setting(containerEl).setName("Engine").setHeading();

        new Setting(containerEl)
            .setName("Output Folder")
            .addText(t => t
                .setValue(this.plugin.settings.output_dir)
                .onChange(async v => { 
                    this.plugin.settings.output_dir = v; 
                    await this.plugin.saveSettings(); 
                }));
        
        new Setting(containerEl)
            .setName("Max Retries")
            .setDesc("How many times to retry a failed task.")
            .addText(t => t
                .setValue(String(this.plugin.settings.maxRetries))
                .onChange(async v => { 
                    const num = parseInt(v);
                    if (!isNaN(num)) {
                        this.plugin.settings.maxRetries = num; 
                        await this.plugin.saveSettings(); 
                    }
                }));

        new Setting(containerEl)
            .setName("Generator Prompt Template")
            .addTextArea(t => { 
                t.setValue(this.plugin.settings.prompt_generator)
                 .onChange(async v => { 
                     this.plugin.settings.prompt_generator = v; 
                     await this.plugin.saveSettings(); 
                 }); 
                t.inputEl.rows = 5; 
                t.inputEl.style.width = "100%";
            });
    }
}