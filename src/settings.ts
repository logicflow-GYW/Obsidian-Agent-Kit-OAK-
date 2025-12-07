// src/settings.ts
import { App, PluginSettingTab, Setting, Notice, Modal } from "obsidian";
import AgentKitPlugin from "./main";
import { Logger, LogEntry } from "./core/utils";

class LogViewerModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "OAK Recent Logs" });

        const logs = Logger.getMemoryLogs();

        if (logs.length === 0) {
            contentEl.createEl("p", { text: "No recent logs to display." });
            return;
        }

        const logContainer = contentEl.createDiv("oak-log-viewer-container");
        logContainer.style.height = '400px';
        logContainer.style.overflow = 'auto';
        logContainer.style.border = '1px solid var(--background-modifier-border)';
        logContainer.style.padding = '10px';
        logContainer.style.backgroundColor = 'var(--background-secondary)';
        logContainer.style.fontFamily = 'monospace';
        logContainer.style.fontSize = '0.8em';
        logContainer.style.whiteSpace = 'pre-wrap';

        const logText = logs.map(entry => {
            const levelColor = entry.level === 'ERROR' ? 'var(--text-error)' : 
                             entry.level === 'WARN' ? 'var(--text-warning)' : 
                             'var(--text-normal)';
            return `<span style="color: var(--text-muted);">[${entry.timestamp}]</span> <span style="color: ${levelColor}; font-weight: bold;">[${entry.level}]</span> <span style="color: var(--text-accent);">[${entry.namespace}]</span> ${entry.message}${entry.details ? `\n  ${JSON.stringify(entry.details, null, 2)}` : ''}`;
        }).join('\n\n');

        logContainer.innerHTML = logText;

        const copyButton = contentEl.createEl("button", { text: "Copy Logs to Clipboard" });
        copyButton.onclick = async () => {
            const rawLogText = logs.map(entry => JSON.stringify(entry)).join('\n');
            await navigator.clipboard.writeText(rawLogText);
            new Notice("Logs copied to clipboard!");
        };

    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

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
            .setDesc("在控制台显示详细日志。必须开启此模式才能记录 INFO 级别日志。")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug_mode)
                .onChange(async (value) => {
                    this.plugin.settings.debug_mode = value;
                    Logger.setDebugMode(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Primary Provider")
            .setDesc("首选 AI 提供商。")
            .addDropdown(d => d
                .addOption("openai", "OpenAI")
                .addOption("google", "Google")
                .setValue(this.plugin.settings.llmProvider)
                .onChange(async v => { 
                    this.plugin.settings.llmProvider = v; 
                    await this.plugin.saveSettings(); 
                    this.display(); // 重新渲染以显示/隐藏相关设置
                }));

        new Setting(containerEl)
            .setName("API Key Strategy")
            .setDesc("选择 API Key 的轮换方式。")
            .addDropdown(d => d
                .addOption("exhaustion", "顺序耗尽")
                .addOption("round-robin", "轮询均衡")
                .setValue(this.plugin.settings.apiKeyStrategy)
                .onChange(async v => {
                    this.plugin.settings.apiKeyStrategy = v as 'exhaustion' | 'round-robin';
                    await this.plugin.saveSettings();
                }));

        // --- LLM Provider Settings ---
        const isPrimaryOpenAI = this.plugin.settings.llmProvider === 'openai';

        // 无论主要提供商是谁，都显示所有提供商的设置，但顺序不同
        if (isPrimaryOpenAI) {
            this.addOpenAISettings(containerEl);
            this.addGoogleSettings(containerEl); 
        } else {
            this.addGoogleSettings(containerEl);
            this.addOpenAISettings(containerEl);
        }

        new Setting(containerEl).setName("Engine Settings").setHeading();
        
        new Setting(containerEl)
            .setName("Max Concurrency")
            .setDesc("同时处理的任务数量 (滑动窗口大小)。建议设置为 3-5。")
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.concurrency || 3)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.concurrency = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Max Retries")
            .setDesc("任务失败后的最大重试次数。")
            .addText(text => text
                .setPlaceholder("3")
                .setValue(String(this.plugin.settings.maxRetries))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.maxRetries = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName("Output Folder")
            .setDesc("生成文件的默认存放路径。")
            .addText(text => text
                .setPlaceholder("KnowledgeGraph")
                .setValue(this.plugin.settings.output_dir)
                .onChange(async (value) => {
                    this.plugin.settings.output_dir = value || 'KnowledgeGraph';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Prompt Template (for GeneratorAgent)")
            .setDesc("用于生成内容的提示词模板，使用 {concept} 作为占位符。")
            .addTextArea(text => { 
                text.setValue(this.plugin.settings.prompt_generator)
                 .onChange(async (value) => { 
                     this.plugin.settings.prompt_generator = value; 
                     await this.plugin.saveSettings(); 
                 }); 
                text.inputEl.rows = 5; 
                text.inputEl.style.width = "100%"; 
                text.inputEl.style.fontFamily = "monospace";
            });
            
        // --- Diagnostics ---
        new Setting(containerEl).setName("Diagnostics").setHeading();
        new Setting(containerEl)
            .setName("View Logs")
            .setDesc("打开一个窗口，显示最近在内存中记录的 OAK 日志。")
            .addButton(button => button
                .setButtonText("Open Log Viewer")
                .onClick(() => {
                    new LogViewerModal(this.app).open();
                })
            );

        containerEl.createEl('p', { 
            text: "Note: Logs are only kept in memory temporarily. For permanent storage, please check the browser's developer console.",
            cls: 'setting-item-description'
        });
    }

    addOpenAISettings(el: HTMLElement) {
        new Setting(el).setName("OpenAI Settings").setHeading();
        new Setting(el)
            .setName("OpenAI Keys")
            .setDesc("一行一个 Key。")
            .addTextArea(t => {
                t.setValue(this.plugin.settings.openaiApiKey)
                 .onChange(async v => { this.plugin.settings.openaiApiKey = v; await this.plugin.saveSettings(); });
                t.inputEl.rows = 3;
                t.inputEl.style.width = "100%";
                t.inputEl.style.fontFamily = "monospace";
            });
        new Setting(el)
            .setName("Base URL")
            .setDesc("API 请求地址，用于兼容 OpenAI 格式的代理服务。")
            .addText(t => t
                .setPlaceholder("https://api.openai.com/v1")
                .setValue(this.plugin.settings.openaiBaseUrl)
                .onChange(async v => { 
                    this.plugin.settings.openaiBaseUrl = v || 'https://api.openai.com/v1'; 
                    await this.plugin.saveSettings(); 
                }));
        new Setting(el)
            .setName("Model")
            .setDesc("要使用的 OpenAI 模型。")
            .addText(t => t
                .setPlaceholder("gpt-3.5-turbo")
                .setValue(this.plugin.settings.openaiModel)
                .onChange(async v => { 
                    this.plugin.settings.openaiModel = v || 'gpt-3.5-turbo'; 
                    await this.plugin.saveSettings(); 
                }));
    }

    addGoogleSettings(el: HTMLElement) {
        new Setting(el).setName("Google Settings").setHeading();
        new Setting(el)
            .setName("Google Keys")
            .setDesc("一行一个 Key。")
            .addTextArea(t => {
                t.setValue(this.plugin.settings.googleApiKey)
                 .onChange(async v => { this.plugin.settings.googleApiKey = v; await this.plugin.saveSettings(); });
                t.inputEl.rows = 3;
                t.inputEl.style.width = "100%";
                t.inputEl.style.fontFamily = "monospace";
            });
        new Setting(el)
            .setName("Model")
            .setDesc("要使用的 Google 模型。")
            .addText(t => t
                .setPlaceholder("gemini-1.5-flash")
                .setValue(this.plugin.settings.googleModel)
                .onChange(async v => { 
                    this.plugin.settings.googleModel = v || 'gemini-1.5-flash'; 
                    await this.plugin.saveSettings(); 
                }));
    }
}
