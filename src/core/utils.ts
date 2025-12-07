// src/core/utils.ts
import { App, normalizePath, TFolder } from "obsidian";

// 【新增】定义单个日志条目的结构
export interface LogEntry {
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    namespace: string; // 例如: [Orchestrator], [GeneratorAgent]
    message: string;
    details?: any; // 额外的上下文数据
}

export class Logger {
    private static isDebug: boolean = false;
    private static memoryBuffer: LogEntry[] = [];
    private static readonly MAX_MEMORY_LOGS = 200; // 内存中最多保存200条日志

    static setDebugMode(debug: boolean) {
        Logger.isDebug = debug;
    }

    private static formatMessage(level: 'INFO' | 'WARN' | 'ERROR', namespace: string, message: string): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            namespace,
            message
        };
    }

    private static output(entry: LogEntry, ...args: any[]) {
        // 输出到控制台
        const logString = JSON.stringify(entry, null, 2);
        if (entry.level === 'ERROR') {
            console.error(logString, ...args);
        } else if (entry.level === 'WARN') {
            console.warn(logString, ...args);
        } else {
            // INFO 级别只在 Debug 模式下显示
            if (Logger.isDebug) {
                console.log(logString, ...args);
            }
        }

        // 更新内存缓冲区
        Logger.memoryBuffer.push(entry);
        if (Logger.memoryBuffer.length > Logger.MAX_MEMORY_LOGS) {
            Logger.memoryBuffer.shift(); // 移除最旧的日志
        }
    }
    
    static log(message: string, details?: any) {
        const namespace = message.match(/^\[(.*?)\]/)?.[1] || 'OAK';
        const cleanMessage = message.replace(/^\[.*?\]\s*/, '');
        const entry = Logger.formatMessage('INFO', namespace, cleanMessage);
        if (details) {
            entry.details = details;
        }
        Logger.output(entry);
    }

    static warn(message: string, details?: any) {
        const namespace = message.match(/^\[(.*?)\]/)?.[1] || 'OAK';
        const cleanMessage = message.replace(/^\[.*?\]\s*/, '');
        const entry = Logger.formatMessage('WARN', namespace, cleanMessage);
        if (details) {
            entry.details = details;
        }
        Logger.output(entry);
    }

    static error(message: string, error?: Error | any, details?: any) {
        const namespace = message.match(/^\[(.*?)\]/)?.[1] || 'OAK';
        const cleanMessage = message.replace(/^\[.*?\]\s*/, '');
        const entry = Logger.formatMessage('ERROR', namespace, cleanMessage);
        if (error instanceof Error) {
            entry.details = { ...details, error: error.message, stack: error.stack };
        } else if (error) {
            entry.details = { ...details, error: String(error) };
        } else if (details) {
            entry.details = details;
        }
        Logger.output(entry);
    }

    // 【新增】静态方法，供外部获取内存中的日志
    static getMemoryLogs(): LogEntry[] {
        return [...Logger.memoryBuffer]; // 返回一个副本，防止外部修改
    }
}

export function sanitizeFilename(name: string): string {
    let cleanName = name.replace(/\s*\(.*\)/g, '').trim();
    cleanName = cleanName.replace(/[\\/*?:"<>|]/g, "");
    return cleanName.slice(0, 100);
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const folders = normalizedPath.split("/");
    let currentPath = "";

    for (const folder of folders) {
        currentPath = currentPath === "" ? folder : `${currentPath}/${folder}`;
        const existing = app.vault.getAbstractFileByPath(currentPath);
        
        if (!existing) {
            try {
                await app.vault.createFolder(currentPath);
            } catch (error) {
                // 忽略并发创建时的错误
            }
        } else if (!(existing instanceof TFolder)) {
            throw new Error(`Path conflict: ${currentPath} exists but is not a folder.`);
        }
    }
}
