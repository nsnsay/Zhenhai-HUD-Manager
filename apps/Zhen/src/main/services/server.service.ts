import type http from "http";
import type { AppResult } from "../../shared/ipc";
import { SERVER_PORT, SERVER_HOST_LOCAL, serverHost } from "../../shared/server";
import { errorMessage } from "../../shared/errors";
import { startExpressServer } from "./express.service";
import type { DatabaseService } from "./database.service";
import type { FileService } from "./file.service";
import { SocketService } from "./socket.service";
import type { GsiService } from "./gsi.service";
import { logger } from "./logger.service";

export interface ServerBinding {
  host: string;
  port: number;
}

/**
 * Express + Socket.IO 的生命周期与监听地址。
 *
 * 默认仅监听 127.0.0.1；开启「允许局域网访问」后改为 0.0.0.0，
 * 保存设置时通过 close + listen 立即生效（Socket.IO 客户端会自动重连）。
 */
class ServerService {
  private static instance: ServerService;

  private server: http.Server | null = null;
  private socketService: SocketService | null = null;
  private host: string = SERVER_HOST_LOCAL;
  private port: number = SERVER_PORT;

  static getInstance(): ServerService {
    if (!ServerService.instance) {
      ServerService.instance = new ServerService();
    }

    return ServerService.instance;
  }

  init(dbService: DatabaseService, fileService: FileService, gsiService: GsiService): void {
    if (this.server) {
      return;
    }

    this.server = startExpressServer(dbService, fileService);
    this.socketService = SocketService.init(this.server);
    this.socketService.bindGsi(gsiService);
  }

  getSocketService(): SocketService | null {
    return this.socketService;
  }

  getBinding(): ServerBinding {
    return { host: this.host, port: this.port };
  }

  isListening(): boolean {
    return this.server?.listening ?? false;
  }

  async applyLanAccess(allowLanAccess: boolean): Promise<AppResult<ServerBinding>> {
    const host = serverHost(allowLanAccess);

    if (this.isListening() && host === this.host) {
      return { success: true, data: this.getBinding() };
    }

    const previousHost = this.host;
    const wasListening = this.isListening();

    await this.stop();

    const result = await this.listen(host);

    if (result.success || !wasListening) {
      return result;
    }

    // 新地址绑定失败：回退到原监听，避免服务彻底不可用。
    const rollback = await this.listen(previousHost);

    if (!rollback.success) {
      logger.error(
        "HttpServer",
        "Failed to bind the new address and the previous binding could not be restored; the local server is stopped until restart.",
        result.error,
      );

      return {
        success: false,
        error: `${result.error ?? "Bind failed"}（原监听也无法恢复，需要重启应用）`,
      };
    }

    logger.warn(
      "HttpServer",
      `Failed to bind ${host}, restored previous binding ${previousHost}`,
      result.error,
    );

    return {
      success: false,
      error: `${result.error ?? "Bind failed"}（已恢复原监听 ${previousHost}）`,
    };
  }

  private listen(host: string): Promise<AppResult<ServerBinding>> {
    const server = this.server;

    if (!server) {
      return Promise.resolve({ success: false, error: "HTTP 服务尚未初始化。" });
    }

    return new Promise<AppResult<ServerBinding>>((resolve) => {
      const onError = (error: Error): void => {
        server.off("error", onError);
        logger.error("HttpServer", "Failed to listen", error);
        resolve({ success: false, error: errorMessage(error) });
      };

      server.once("error", onError);

      server.listen(SERVER_PORT, host, () => {
        server.off("error", onError);
        this.host = host;
        this.port = SERVER_PORT;

        logger.info("HttpServer", `Express + Socket.IO listening on http://${host}:${SERVER_PORT}`);

        resolve({ success: true, data: this.getBinding() });
      });
    });
  }

  private stop(): Promise<void> {
    const server = this.server;

    if (!server || !server.listening) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      server.close(() => resolve());
      // 主动断开 keep-alive 连接，避免 close 长时间等待。
      server.closeAllConnections?.();
    });
  }
}

export const serverService = ServerService.getInstance();