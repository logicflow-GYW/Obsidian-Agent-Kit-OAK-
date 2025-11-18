import { App, Modal, Setting } from "obsidian";

export class InputModal extends Modal {
    result: string;
    onSubmit: (result: string) => void;

    constructor(app: App, onSubmit: (result: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "🌱 播种新概念" });

        let inputElement: HTMLInputElement;

        new Setting(contentEl)
            .setName("输入概念名称")
            .setDesc("输入你想生成的知识点，例如：'第一性原理'")
            .addText((text) => {
                inputElement = text.inputEl;
                text.onChange((value) => {
                    this.result = value;
                });
                text.inputEl.addEventListener("keypress", (e) => {
                    if (e.key === "Enter") {
                        this.submit();
                    }
                });
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("添加到队列")
                    .setCta()
                    .onClick(() => {
                        this.submit();
                    }));
        
        setTimeout(() => inputElement?.focus(), 0);
    }

    submit() {
        if (this.result && this.result.trim().length > 0) {
            this.close();
            this.onSubmit(this.result.trim());
        } else {
            this.close();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
