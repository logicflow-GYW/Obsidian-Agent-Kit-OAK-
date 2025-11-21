// src/core/utils.ts

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
    // 移除 Obsidian 不允许的字符，并限制长度
    let cleanName = name.replace(/\s*\(.*\)/g, '').trim();
    cleanName = cleanName.replace(/[\\/*?:"<>|]/g, "");
    return cleanName.slice(0, 100);
}