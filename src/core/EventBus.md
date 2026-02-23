// src/core/EventBus.ts
import { Events } from "obsidian";
import { Logger } from "./utils";

export class EventBus extends Events {
    private static instance: EventBus;

    private constructor() {
        super();
    }

    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    // 封装 emit 以便统一记录日志
    emit(eventName: string, ...args: any[]) {
        Logger.log(`[EventBus] Emitting: ${eventName}`, args);
        super.trigger(eventName, ...args);
    }
}

// 定义标准事件名常量
export const OakEvents = {
    TASK_ADDED: 'oak:task-added',
    TASK_STARTED: 'oak:task-started',
    TASK_COMPLETED: 'oak:task-completed', // 成功
    TASK_FAILED: 'oak:task-failed',       // 失败（可能重试）
    TASK_DISCARDED: 'oak:task-discarded', // 彻底放弃
    WORKFLOW_COMPLETE: 'oak:workflow-complete'
};