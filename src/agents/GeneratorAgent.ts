import { BaseAgent } from "../core/BaseAgent";
import { normalizePath, TFile } from "obsidian"; // <--- 1. 别忘了导入这些！

interface GenTask {
    concept: string;
}

export class GeneratorAgent extends BaseAgent<GenTask> {
    get queueName() {
        return "generation_queue";
    }

    async process(task: GenTask): Promise<boolean> {
        console.log(`[Generator] Processing: ${task.concept}`);

        // 🛡️ 防御性编程：如果配置没读到，先报错而不是崩溃
        if (!this.settings) {
            throw new Error("无法读取插件设置，请检查 BaseAgent.ts");
        }

        const prompt = this.settings.prompt_generator.replace("{concept}", task.concept);
        const content = await this.llm.chat(prompt);

        if (content) {
            const fileName = `${task.concept}.md`;
            // 确保输出目录不为空，默认为根目录
            const folderPath = this.settings.output_dir || ""; 
            const filePath = normalizePath(`${folderPath}/${fileName}`);

            // 自动创建文件夹（如果不存在）
            if (folderPath !== "" && !this.app.vault.getAbstractFileByPath(folderPath)) {
                 await this.app.vault.createFolder(folderPath);
            }

            const fileExists = this.app.vault.getAbstractFileByPath(filePath);

            if (fileExists) {
                console.log(`文件已存在，跳过: ${filePath}`);
                // 如果你想覆盖，可以用: await this.app.vault.modify(fileExists as TFile, content);
            } else {
                await this.app.vault.create(filePath, content);
                console.log(`已创建文件: ${filePath}`);
            }
        }

        console.log(`[Generator] Generated content for ${task.concept}`);
        return true;
    }
}