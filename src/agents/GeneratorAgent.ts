// src/agents/GeneratorAgent.ts
import { BaseAgent } from "../core/BaseAgent";
import { TaskItem } from "../core/types";

interface GenerationTask extends TaskItem {
    concept: string;
}

export class GeneratorAgent extends BaseAgent<GenerationTask> {
    public static readonly QUEUE_NAME = "generation_queue";

    get queueName(): string {
        return GeneratorAgent.QUEUE_NAME;
    }

    async process(item: GenerationTask): Promise<boolean> {
        // --- 修改 ---: 使用 debug 级别记录详细处理过程
        console.debug(`[GeneratorAgent] 正在处理概念: ${item.concept}`);
        
        const prompt = this.settings.prompt_generator.replace('{concept}', item.concept);
        
        const content = await this.llm.chat(prompt);

        if (!content || content.trim().length === 0) {
            console.error("[GeneratorAgent] LLM 返回内容为空。");
            return false;
        }

        const outputDir = this.settings.output_dir;
        const fileName = `${item.concept.replace(/[\\/:"*?<>|]/g, '_')}.md`;
        const filePath = `${outputDir}/${fileName}`;

        const fileExists = await this.app.vault.adapter.exists(filePath);
        if (fileExists) {
            console.warn(`[GeneratorAgent] 文件已存在，跳过创建: ${filePath}`);
            return true; 
        }

        await this.app.vault.create(filePath, content);
        // --- 修改 ---: 成功创建属于重要信息，可以使用 info 或 debug，这里选 debug 保持一致性
        console.debug(`[GeneratorAgent] 已成功创建文件: ${filePath}`);
        
        return true;
    }
}