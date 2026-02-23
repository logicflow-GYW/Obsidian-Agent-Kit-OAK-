// src/agents/GeneratorAgent.ts
import { BaseAgent } from "../core/BaseAgent";
import { TaskItem, TaskStatus } from "../core/types"; // 导入 TaskStatus
import { ensureFolderExists } from "../core/utils";

interface GenerationTask extends TaskItem {
    concept: string;
}

export class GeneratorAgent extends BaseAgent<GenerationTask> {
    public static readonly QUEUE_NAME = "generation_queue";

    get queueName(): string {
        return GeneratorAgent.QUEUE_NAME;
    }

    // 【修改】process 方法现在返回更新后的 TaskItem
    async process(item: GenerationTask): Promise<GenerationTask> {
        this.log(`正在处理概念: ${item.concept}`);
        
        const prompt = this.settings.prompt_generator.replace('{concept}', item.concept);
        const content = await this.llm.chat(prompt);

        if (!content || content.trim().length === 0) {
            this.error("LLM 返回内容为空。");
            throw new Error("LLM returned empty content."); // 抛出错误以触发重试
        }

        const outputDir = this.settings.output_dir;
        
        try {
            await ensureFolderExists(this.app, outputDir);
        } catch (e) {
            this.error(`创建文件夹失败: ${outputDir}`, e);
            throw new Error(`Failed to create output directory: ${outputDir}`); // 抛出错误
        }

        const fileName = `${item.concept.replace(/[\\/:"*?<>|]/g, '_')}.md`;
        const filePath = `${outputDir}/${fileName}`;

        const fileExists = await this.app.vault.adapter.exists(filePath);
        if (fileExists) {
            this.log(`文件已存在，跳过创建: ${filePath}`);
            // 即使跳过，也认为任务成功
            return { ...item, status: TaskStatus.SUCCESS };
        }

        await this.app.vault.create(filePath, content);
        this.log(`已成功创建文件: ${filePath}`);
        
        // 返回更新后的任务项，Orchestrator 会用它来更新状态
        return { ...item, status: TaskStatus.SUCCESS };
    }
}
