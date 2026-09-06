import express from "express";
import { app as electronApp } from "electron";
import type { Express, Request, Response } from "express";
import http from "http";
import { join } from "path";
import type { DatabaseService } from "./database.service";
import type { CollectionName, QueryOptions } from "../types/database.types";
import type { FileService } from "./file.service";
import { GsiService } from "./gsi.service";
import { logger } from "./logger.service";
import type { LoggerPayload } from "../../shared/ipc";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getOverlayStaticDir(): string {
  if (electronApp.isPackaged) {
    return join(process.resourcesPath, "overlay");
  }

  return join(electronApp.getAppPath(), "resources", "overlay");
}

function normalizeLoggerPayload(payload: Record<string, unknown>): LoggerPayload {
  return {
    level:
      payload?.level === "error" || payload?.level === "warn" || payload?.level === "debug"
        ? payload.level
        : "info",
    source:
      typeof payload?.source === "string" && payload.source
        ? payload.source.slice(0, 80)
        : "HaiRenderer",
    message:
      typeof payload?.message === "string"
        ? payload.message.slice(0, 2000)
        : String(payload?.message ?? ""),
    meta: payload?.meta,
  };
}

export function startExpressServer(
  dbService: DatabaseService,
  fileService: FileService,
): http.Server {
  const app: Express = express();
  const gsiService = GsiService.getInstance();

  // ---------- CORS ----------
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    return next();
  });

  app.use(express.json());

  app.post("/logger", (req: Request, res: Response) => {
    logger.write(normalizeLoggerPayload(req.body ?? {}));
    res.status(200).json({ success: true });
  });

  app.post("/gsi", (req: Request, res: Response) => {
    gsiService.digest(req.body).catch((err) => {
      logger.error("GsiHttp", "GSI pipeline error", err);
    });
    res.sendStatus(200);
  });

  app.get("/api/:collection", (req: Request, res: Response) => {
    const collection = param(req.params.collection) as CollectionName;
    const { where, orderBy, order, limit, offset } = req.query;
    const options: QueryOptions = {};
    if (where) {
      try {
        options.where = JSON.parse(where as string);
      } catch {}
    }
    if (orderBy) {
      options.orderBy = { field: orderBy as string, order: (order as "asc" | "desc") || "asc" };
    }
    if (limit) options.limit = parseInt(limit as string, 10);
    if (offset) options.offset = parseInt(offset as string, 10);
    const result = dbService.list(collection, options);
    res.json(result);
  });

  app.get("/api/:collection/:id", (req: Request, res: Response) => {
    const collection = param(req.params.collection) as CollectionName;
    const id = param(req.params.id);
    const result = dbService.read(collection, id);
    res.status(result.success ? 200 : 404).json(result);
  });

  app.post("/api/:collection", (req: Request, res: Response) => {
    const collection = param(req.params.collection) as CollectionName;
    const result = dbService.create(collection, req.body);
    res.status(result.success ? 201 : 400).json(result);
  });

  app.put("/api/:collection/:id", (req: Request, res: Response) => {
    const collection = param(req.params.collection) as CollectionName;
    const id = param(req.params.id);
    const result = dbService.update(collection, id, req.body);
    res.status(result.success ? 200 : 404).json(result);
  });

  app.delete("/api/:collection/:id", (req: Request, res: Response) => {
    const collection = param(req.params.collection) as CollectionName;
    const id = param(req.params.id);
    const result = dbService.delete(collection, id);
    res.status(result.success ? 200 : 404).json(result);
  });

  app.get("/api/settings", (_req: Request, res: Response) => {
    const result = dbService.list("extras", { where: { configType: "app-settings" } });
    if (result.success && result.data && result.data.length > 0) {
      const record = result.data[0] as {
        settings?: Record<string, unknown>;
        [key: string]: unknown;
      };

      res.json({ success: true, data: record.settings ?? record });
    } else {
      res.json({ success: true, data: null });
    }
  });

  app.use("/assets", express.static(fileService.getAssetsDir()));
  app.use("/overlay", express.static(getOverlayStaticDir()));
  app.use("/hud", express.static(getOverlayStaticDir()));

  const server = http.createServer(app);
  return server;
}
