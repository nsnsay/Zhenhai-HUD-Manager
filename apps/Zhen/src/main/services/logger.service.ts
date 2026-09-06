import { app } from "electron";
import { mkdirSync, readFileSync } from "fs";
import { join } from "path";
import electronLog from "electron-log/main";
import type { LoggerPayload } from "../../shared/ipc";

class LoggerService {
  private static instance: LoggerService;
  private initialized = false;
  private logFilePath: string = ""; // 存储本次启动的完整日志路径

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * 初始化日志服务，每次启动生成一个带时间戳的新日志文件
   */
  initialize(): void {
    if (this.initialized) return;

    const logsDir = join(app.getPath("documents"), "ZhenHai", "logs");
    mkdirSync(logsDir, { recursive: true });

    // 生成时间戳文件名：zhenhai_YYYY-MM-DD_HH-MM-SS.log
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
      `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const fileName = `zhenhai_${timestamp}.log`;
    this.logFilePath = join(logsDir, fileName);

    // 配置 electron-log
    electronLog.transports.file.resolvePathFn = () => this.logFilePath;
    electronLog.transports.file.level = "debug";
    electronLog.transports.file.maxSize = 5 * 1024 * 1024;
    electronLog.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope}{text}";
    electronLog.transports.console.level = "info";
    electronLog.initialize();
    electronLog.errorHandler.startCatching({ showDialog: false });

    this.initialized = true;
    this.info("LoggerService", `Initialized logs at ${this.logFilePath}`);
  }

  getLogsDir(): string {
    return join(app.getPath("documents"), "ZhenHai", "logs");
  }

  readRecentLogs(limit = 500): string {
    if (!this.logFilePath) return "";

    try {
      const content = readFileSync(this.logFilePath, "utf8");
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      return lines.slice(-Math.max(1, Math.min(limit, 5000))).join("\n");
    } catch (error) {
      this.error("LoggerService", "Failed to read recent logs", error);
      return "";
    }
  }

  write(payload: LoggerPayload): void {
    const scope = electronLog.scope(payload.source);

    switch (payload.level) {
      case "error":
        scope.error(payload.message, payload.meta ?? "");
        break;
      case "warn":
        scope.warn(payload.message, payload.meta ?? "");
        break;
      case "debug":
        scope.debug(payload.message, payload.meta ?? "");
        break;
      default:
        scope.info(payload.message, payload.meta ?? "");
    }
  }

  error(source: string, message: string, meta?: unknown): void {
    this.write({ level: "error", source, message, meta });
  }

  warn(source: string, message: string, meta?: unknown): void {
    this.write({ level: "warn", source, message, meta });
  }

  info(source: string, message: string, meta?: unknown): void {
    this.write({ level: "info", source, message, meta });
  }

  debug(source: string, message: string, meta?: unknown): void {
    this.write({ level: "debug", source, message, meta });
  }
}

// 导出单例实例
export const logger = LoggerService.getInstance();
