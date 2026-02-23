// src/InputModal.ts
import { App, Modal, Setting } from "obsidian";

export class InputModal extends Modal {
    result: string;
    onSubmit: (results: string[]) => void;

    constructor(app: App, onSubmit: (results: string[]) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "🌱 批量播种新概念" });

        let inputElement: HTMLTextAreaElement;

        new Setting(contentEl)
            .setName("输入概念名称")
            .setDesc("输入你想生成的知识点，每行一个。")
            .addTextArea((text) => {
                inputElement = text.inputEl;
                text.inputEl.rows = 10; // 设置默认行数
                text.inputEl.style.width = "100%";
                text.inputEl.style.fontFamily = "monospace";
                
                text.onChange((value) => {
                    this.result = value;
                });

                // 支持 Ctrl+Enter (或 Cmd+Enter) 快速提交
                text.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        this.submit();
                    }
                });
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("添加到队列 (Ctrl+Enter)")
                    .setCta()
                    .onClick(() => {
                        this.submit();
                    }));
        
        // 自动聚焦
        setTimeout(() => inputElement?.focus(), 0);
    }

    submit() {
        if (this.result && this.result.trim().length > 0) {
            this.close();
            // 按换行符分割，去重去空
            const concepts = this.result
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            
            if (concepts.length > 0) {
                this.onSubmit(concepts);
            }
        } else {
            this.close();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}