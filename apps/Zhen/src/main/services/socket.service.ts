import { Server as SocketIOServer } from "socket.io";
import type http from "http";
import { FORWARDED_GSI_EVENTS, type GsiService } from "./gsi.service";
import { logger } from "./logger.service";

type GsiForwardHandler = (...args: unknown[]) => void;

export class SocketService {
  private static instance: SocketService;

  private io: SocketIOServer;

  private gsiService: GsiService | null = null;
  private gsiAttached = false;
  private connectionCount = 0;

  /**
   * 所有需要挂载到 GsiService 的监听器。
   *
   * key 是 GsiService 的事件名（`gsi:data`、`roundEnd`、`kill` …）；
   * `gsi:data` 是管线处理后的主数据事件，其余事件统一转发为 `gsi:事件名`。
   */
  private readonly handlers = new Map<string, GsiForwardHandler>();

  private constructor(server: http.Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.handlers.set("gsi:data", (...args: unknown[]) => {
      if (this.connectionCount > 0) {
        this.io.emit("gsi:data", ...args);
      }
    });

    for (const eventName of FORWARDED_GSI_EVENTS) {
      if (eventName === "data") {
        continue;
      }

      this.handlers.set(eventName, (...args: unknown[]) => {
        if (this.connectionCount > 0) {
          this.io.emit(`gsi:${eventName}`, ...args);
        }
      });
    }

    this.io.on("connection", (socket) => {
      logger.info("SocketIO", "Client connected", {
        id: socket.id,
        connectionCount: this.connectionCount + 1,
      });

      // 第一个客户端连接时挂载 GSI 事件；没有客户端时不监听，避免无谓的序列化开销。
      if (this.connectionCount === 0) {
        this.attachGsiEvents();
      }

      this.connectionCount++;

      socket.on("disconnect", (reason) => {
        const previousCount = this.connectionCount;

        if (this.connectionCount > 0) {
          this.connectionCount--;
        }

        if (this.connectionCount === 0) {
          this.detachGsiEvents();
        }

        logger.info("SocketIO", "Client disconnected", {
          id: socket.id,
          reason,
          previousCount,
          connectionCount: this.connectionCount,
        });
      });
    });

    logger.info("SocketService", "Initialized");
  }

  static init(server: http.Server): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService(server);
    }

    return SocketService.instance;
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      throw new Error("SocketService not initialized. Call init() first.");
    }

    return SocketService.instance;
  }

  bindGsi(gsiService: GsiService): void {
    if (this.gsiService !== gsiService) {
      this.detachGsiEvents();
      this.gsiService = gsiService;
    }

    if (this.connectionCount > 0) {
      this.attachGsiEvents();
    }

    logger.info("SocketService", "GSI events bound");
  }

  broadcast(event: string, data: unknown): void {
    if (this.connectionCount === 0) {
      return;
    }

    this.io.emit(event, data);
  }

  private attachGsiEvents(): void {
    if (!this.gsiService || this.gsiAttached) {
      return;
    }

    for (const [eventName, handler] of this.handlers) {
      this.gsiService.on(eventName, handler);
    }

    this.gsiAttached = true;
  }

  private detachGsiEvents(): void {
    if (!this.gsiService || !this.gsiAttached) {
      return;
    }

    for (const [eventName, handler] of this.handlers) {
      this.gsiService.off(eventName, handler);
    }

    this.gsiAttached = false;
  }
}