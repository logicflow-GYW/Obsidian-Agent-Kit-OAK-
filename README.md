
# Obsidian Agent Kit (OAK)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**OAK (Obsidian Agent Kit)** 是一个为 Obsidian 打造的**企业级 AI 代理开发框架**。

它不仅仅是一个插件，更是一套标准的**生产管线**。它解决了 Obsidian AI 插件开发中最头疼的几个问题：**任务阻塞主线程**、**大数据量导致配置文件膨胀**、以及**缺乏统一的调度机制**。

---

## 🌟 核心特性 (Core Features)

* **🧠 稳健的调度核心 (Orchestrator)**: 基于事件循环的后台任务调度器，支持多 Agent 并行协作。
* **💾 专业级持久化 (Persistence Layer)**: 
    * **配置与数据分离**: 彻底告别 `data.json` 膨胀问题。任务队列独立存储，大文本内容自动缓存为文件。
    * **崩溃恢复**: 即使 Obsidian 意外关闭，未完成的任务也不会丢失，重启后自动断点续传。
* **🛡️ 容错与重试**: 内置指数退避重试机制，API 抖动不再导致任务失败。
* **📝 标准化日志 (Logger)**: 提供统一的调试模式与生产环境日志管理，符合插件审核规范。
* **🔌 多模型支持**: 开箱即用的 OpenAI (兼容 DeepSeek/Moonshot) 与 Google Gemini 支持。

---

## 🚀 快速开始 (用户视角)

1.  **安装**: 下载插件并启用。
2.  **配置**: 在设置中填入 API Key，并开启 **Debug Mode** 以查看详细运行日志。
3.  **使用**: 
    * 点击侧边栏机器人图标，输入概念（如“熵增定律”），点击“添加到队列”。
    * OAK 会在后台默默工作，生成完毕后自动将笔记保存到指定目录。

---

## 🧑‍💻 开发者指南：构建你的第一个 Agent

OAK 的设计哲学是：**"你只管写业务逻辑，剩下的交给框架"**。

### 第一步：定义任务与 Agent

创建一个继承自 `BaseAgent` 的类。你无需关心队列怎么存、API 怎么调，只需实现 `process` 方法。

```typescript
// src/agents/SummarizerAgent.ts
import { BaseAgent } from "../core/BaseAgent";
import { Notice } from "obsidian";

// 1. 定义任务数据结构
export interface SummarizeTask {
    filePath: string;
    fileContent: string;
}

export class SummarizerAgent extends BaseAgent<SummarizeTask> {
    // 2. 定义队列名称 (全局唯一)
    get queueName(): string {
        return "summarize_queue";
    }

    // 3. 实现业务逻辑
    async process(task: SummarizeTask): Promise<boolean> {
        this.log(`正在处理文件: ${task.filePath}`); // 使用内置日志工具

        const prompt = `请总结以下内容:\n\n${task.fileContent}`;
        const summary = await this.llm.chat(prompt);

        if (!summary) return false; // 返回 false 会触发框架的自动重试机制

        // 写入结果
        const targetFile = this.app.vault.getAbstractFileByPath(task.filePath);
        if (targetFile) {
            await this.app.vault.append(targetFile, `\n\n## AI 摘要\n${summary}`);
            new Notice(`摘要已生成: ${task.filePath}`);
        }
        
        return true; // 任务成功，移出队列
    }
}
````

### 第二步：注册 Agent

在 `main.ts` 中注册你的 Agent，OAK 调度器会自动接管它。

```typescript
// src/main.ts
import { SummarizerAgent } from "./agents/SummarizerAgent";

// ... 在 onload() 中
this.orchestrator.registerAgent(new GeneratorAgent(this, this.llm));
// 注册新 Agent
this.orchestrator.registerAgent(new SummarizerAgent(this, this.llm)); 
```

### 第三步：派发任务

在任何地方（Ribbon、Command、甚至另一个 Agent 中）派发任务。

```typescript
// 将任务丢进队列，立刻返回，不会卡顿界面
this.orchestrator.addToQueue("summarize_queue", { 
    filePath: "Notes/Meeting.md",
    fileContent: "..." 
});
```

-----

## 📄 许可证

[MIT](https://www.google.com/search?q=LICENSE)

