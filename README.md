
# 🌳 OAK (Obsidian Agent Kit)

![Version](https://img.shields.io/badge/version-1.1.0-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Platform](https://img.shields.io/badge/Obsidian-Framework-purple)

> **为 Obsidian 打造的 AI 基础设施与多智能体协作系统**

**OAK (Obsidian Agent Kit)** 不仅仅是一个插件，它是 Obsidian 生态中的 **AI 操作系统内核**。
它旨在解决 AI 插件开发中的“最后五公里”难题：**复杂任务调度**、**并发控制**、**断点续传**以及**跨插件协作**。

---

## 🌟 为什么选择 OAK？(Why OAK?)

### 对于普通用户
* 📦 **开箱即用**：内置“深度概念生成器”，一键生成包含 Mermaid 图表、核心隐喻和深度解析的知识卡片。
* ⚡ **后台运行**：任务在后台默默完成，绝不卡顿你的写作界面。
* 🔄 **自动重试**：网络波动？API 报错？OAK 会自动指数退避重试，确保任务必达。

### 对于开发者 (Framework Mode)
* 🧠 **事件驱动架构 (Event-Driven)**：基于 Pub/Sub 的中央神经系统，轻松实现插件间的解耦与联动。
* 🔌 **标准化 API**: 提供 `OakAPI`，允许任何第三方插件注册 Agent、派发任务或监听状态。
* 🛡️ **稳健调度核心**: 内置错误熔断、死信队列 (Dead Letter Queue) 与优先级管理。
* 💾 **持久化存储**: 任务队列实时写入磁盘，即使 Obsidian 崩溃重启，任务进度依然不丢。
* 🤝 **多智能体流水线**: 支持任务接力 (Chaining)，轻松构建 `生成 -> 审查 -> 归档 -> 发布` 的复杂工作流。

---

## 🚀 快速开始

### 1. 安装与配置
1.  下载并安装本插件。
2.  在设置页配置 AI Provider（支持 **OpenAI** / **Google Gemini**）。
3.  开启 **Debug Mode** (可选) 以查看详细的调度日志。

### 2. 基础使用
* 点击侧边栏的 🤖 **机器人图标**。
* 输入你想研究的概念（例如：“纳什均衡”）。
* OAK 将自动调度 Agent 生成笔记，并保存至 `KnowledgeGraph` 目录。

---

## 👩‍💻 开发者指南：构建你的 AI 插件

**别再重复造轮子了。** 专注于你的业务逻辑，把队列管理、API 调用和持久化交给 OAK。

### 第一步：连接框架

在你的插件 `onload` 生命周期中连接 OAK：

```typescript
// 你的插件 main.ts
const oakPlugin = this.app.plugins.getPlugin('Obsidian-Agent-Kit');

if (oakPlugin && oakPlugin.api) {
    const oak = oakPlugin.api;
    console.log(`✅ 已连接到 OAK 基础设施 v${oak.version}`);
} else {
    console.error("❌ 未找到 OAK 框架，请先安装！");
}
````

### 第二步：注册 Agent (办理入职)

定义一个 Agent 并注册。你无需关心 LLM 如何调用，只需关注 `process` 方法。

```typescript
// 定义你的 Agent
class ReviewAgent {
    // 1. 定义队列名称 (必须唯一)
    get queueName() { return 'review_queue'; }

    // 2. 核心处理逻辑
    async process(task) {
        console.log("收到审查任务:", task);
        
        // 执行你的业务逻辑...
        // ...
        
        // 3. 返回标准结果
        return { 
            status: 'success', 
            data: { reviewed: true, score: 95 },
            // 可选：任务链，当前任务完成后自动触发下一个任务
            nextTasks: [] 
        };
    }
}

// 注册到 OAK 调度器
oak.registerAgent(new ReviewAgent(this.app));
```

### 第三步：派发任务与监听

你可以利用 OAK 的事件总线，监听其他插件的动作，实现**自动化流水线**。

```typescript
// 场景：当 "生成队列" 完成任务后，自动触发 "审查队列"
oak.on('oak:task-completed', (data) => {
    // data 包含: { queueName, taskId, result }
    
    if (data.queueName === 'generation_queue') {
        console.log("检测到新内容生成，流水线启动...");
        
        // 派发新任务
        oak.dispatch(
            'review_queue',                // 目标队列
            {                              // 任务载荷
                concept: data.result.filename,
                originalTaskId: data.taskId 
            },     
            'My-Auto-Reviewer-Plugin'      // 来源 ID (用于调试追踪)
        );
    }
});
```

-----

## 📚 API 参考

通过 `plugin.api` 访问以下核心方法：

| 方法签名 | 描述 |
| :--- | :--- |
| `registerAgent(agent: BaseAgent)` | 将一个 Agent 实例注册到中央调度器。 |
| `dispatch(queue: string, payload: any, source?: string)` | 向指定队列派发一个新任务。返回 TaskID。 |
| `on(event: string, callback: Function)` | 订阅框架事件。 |
| `off(event: string, callback: Function)` | 取消订阅。 |

### 事件列表 (`oak:`)

  * 🟢 `task-added`: 任务成功进入队列。
  * 🟡 `task-started`: Agent 开始处理任务。
  * ✅ `task-completed`: 任务执行成功。
  * ❌ `task-failed`: 任务执行出错（将触发重试）。
  * 🗑️ `task-discarded`: 超过最大重试次数，任务被丢弃。

-----

## 🗺️ 路线图 (Roadmap)

  - [x] **v1.0**: 基础调度器与持久化层。
  - [x] **v1.1**: 开放 API、事件总线与多智能体协作支持。
  - [ ] **v1.2**: 可视化仪表盘 (Dashboard View)，实时监控队列状态。
  - [ ] **v1.5**: 支持本地 LLM (Ollama) 适配器。
  - [ ] **v2.0**: 插件市场与 Agent 预设库。

-----

## 📄 许可证

[MIT License](https://www.google.com/search?q=LICENSE) © 2025 logicflow-GYW
