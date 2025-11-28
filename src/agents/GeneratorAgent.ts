// src/agents/GeneratorAgent.ts
import { BaseAgent } from "../core/BaseAgent";
import { TaskItem } from "../core/types";
import { ensureFolderExists } from "../core/utils"; // 【新增】导入

interface GenerationTask extends TaskItem {
    concept: string;
}

export class GeneratorAgent extends BaseAgent<GenerationTask> {
    public static readonly QUEUE_NAME = "generation_queue";

    get queueName(): string {
        return GeneratorAgent.QUEUE_NAME;
    }

    async process(item: GenerationTask): Promise<boolean> {
        this.log(`正在处理概念: ${item.concept}`);
        
        const prompt = this.settings.prompt_generator.replace('{concept}', item.concept);
        
        // 如果 chat 抛出 AllModelsFailedError，会被 Orchestrator 捕获并停止引擎
        const content = await this.llm.chat(prompt);

        if (!content || content.trim().length === 0) {
            this.error("LLM 返回内容为空。");
            return false;
        }

        const outputDir = this.settings.output_dir;
        
        // 【新增】确保目标文件夹存在 (递归)
        try {
            await ensureFolderExists(this.app, outputDir);
        } catch (e) {
            this.error(`创建文件夹失败: ${outputDir}`, e);
            return false; // 文件夹无法创建，任务失败
        }

        const fileName = `${item.concept.replace(/[\\/:"*?<>|]/g, '_')}.md`;
        const filePath = `${outputDir}/${fileName}`;

        const fileExists = await this.app.vault.adapter.exists(filePath);
        if (fileExists) {
            this.log(`文件已存在，跳过创建: ${filePath}`);
            return true; 
        }

        await this.app.vault.create(filePath, content);
        this.log(`已成功创建文件: ${filePath}`);
        
        return true;
    }
}