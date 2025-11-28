// src/core/utils.ts
import { App, normalizePath, TFolder } from "obsidian";

export class Logger {
    private static isDebug: boolean = false;

    static setDebugMode(debug: boolean) {
        Logger.isDebug = debug;
    }

    static log(message: string, ...args: any[]) {
        if (Logger.isDebug) {
            console.log(`[OAK] ${message}`, ...args);
        }
    }

    static warn(message: string, ...args: any[]) {
        console.warn(`[OAK] ${message}`, ...args);
    }

    static error(message: string, ...args: any[]) {
        console.error(`[OAK] ${message}`, ...args);
    }
}

export function sanitizeFilename(name: string): string {
    let cleanName = name.replace(/\s*\(.*\)/g, '').trim();
    cleanName = cleanName.replace(/[\\/*?:"<>|]/g, "");
    return cleanName.slice(0, 100);
}

// 【新增】递归确保文件夹存在
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