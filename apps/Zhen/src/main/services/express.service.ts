import express from "express";
import { app as electronApp } from "electron";
import type { Express, Request, Response } from "express";
import http from "http";
import { join } from "path";
import type { DatabaseService } from "./database.service";
import type { QueryOptions } from "../types/database.types";
import type { FileService } from "./file.service";
import { GsiService } from "./gsi.service";
import { logger } from "./logger.service";
import { isCollectionName } from "../../shared/ipc";
import { DEFAULT_OVERLAY_ID, OVERLAY_ENTRY_FILE, composeEffectiveSettings, type OverlayEntry } from "../../shared/overlays";
import { overlayStorage } from "./overlay-storage.service";
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

  // 注意：/api/settings 必须注册在 /api/:collection 之前，否则会被通配路由抢先匹配。
  app.get("/api/settings", (_req: Request, res: Response) => {
    const result = dbService.list("extras", { where: { configType: "app-settings" } });
    if (result.success && result.data && result.data.length > 0) {
      const record = result.data[0] as {
        settings?: Record<string, unknown>;
        [key: string]: unknown;
      };

      const appSettings = (record.settings ?? record) as Record<string, unknown>;

      // 与 GSI 载荷使用同一份合成结果（app-settings ⊕ 清单默认 ⊕ 用户修改 ⊕ 强制覆盖）。
      const overlays = dbService.list("overlays");
      const selectedId =
        typeof appSettings.selectedOverlayId === "string"
          ? appSettings.selectedOverlayId
          : DEFAULT_OVERLAY_ID;
      const overlayRecord = overlays.success
        ? ((overlays.data as unknown as OverlayEntry[]).find(
            (entry) => entry.overlayId === selectedId,
          ) ?? null)
        : null;

      res.json({
        success: true,
        data: composeEffectiveSettings(appSettings, overlayRecord) ?? appSettings,
      });
    } else {
      res.json({ success: true, data: null });
    }
  });

  app.get("/api/:collection", (req: Request, res: Response) => {
    const collection = param(req.params.collection);
    if (!isCollectionName(collection)) {
      return res.status(400).json({ success: false, error: `Unknown collection: ${collection}` });
    }

    const { where, orderBy, order, limit, offset } = req.query;
    const options: QueryOptions = {};

    if (where) {
      try {
        options.where = JSON.parse(where as string);
      } catch {
        // 忽略无法解析的 where 参数，保持与旧版行为一致（返回全量）。
      }
    }

    if (orderBy) {
      options.orderBy = { field: orderBy as string, order: (order as "asc" | "desc") || "asc" };
    }

    if (limit) options.limit = parseInt(limit as string, 10);
    if (offset) options.offset = parseInt(offset as string, 10);

    const result = dbService.list(collection, options);
    return res.json(result);
  });

  app.get("/api/:collection/:id", (req: Request, res: Response) => {
    const collection = param(req.params.collection);
    if (!isCollectionName(collection)) {
      return res.status(400).json({ success: false, error: `Unknown collection: ${collection}` });
    }

    const id = param(req.params.id);
    const result = dbService.read(collection, id);
    return res.status(result.success ? 200 : 404).json(result);
  });

  app.post("/api/:collection", (req: Request, res: Response) => {
    const collection = param(req.params.collection);
    if (!isCollectionName(collection)) {
      return res.status(400).json({ success: false, error: `Unknown collection: ${collection}` });
    }

    const result = dbService.create(collection, req.body);
    return res.status(result.success ? 201 : 400).json(result);
  });

  app.put("/api/:collection/:id", (req: Request, res: Response) => {
    const collection = param(req.params.collection);
    if (!isCollectionName(collection)) {
      return res.status(400).json({ success: false, error: `Unknown collection: ${collection}` });
    }

    const id = param(req.params.id);
    const result = dbService.update(collection, id, req.body);
    return res.status(result.success ? 200 : 404).json(result);
  });

  app.delete("/api/:collection/:id", (req: Request, res: Response) => {
    const collection = param(req.params.collection);
    if (!isCollectionName(collection)) {
      return res.status(400).json({ success: false, error: `Unknown collection: ${collection}` });
    }

    const id = param(req.params.id);
    const result = dbService.delete(collection, id);
    return res.status(result.success ? 200 : 404).json(result);
  });

  // /overlays/<id>/... —— 内置与导入的 Overlay 统一对外地址（默认内置同时保留 /overlay 与 /hud 别名）。
  const overlayStaticHandlers = new Map<string, express.RequestHandler>();

  app.use("/overlays", (req: Request, res: Response, next) => {
    const [rawPath, rawQuery] = req.url.split("?");
    const segments = (rawPath ?? "").split("/").filter(Boolean);
    const overlayId = segments[0] ?? "";
    const root = overlayStorage.resolveStaticRoot(overlayId);

    if (!root) {
      res.status(404).json({ success: false, error: `Unknown overlay: ${overlayId}` });
      return;
    }

    let handler = overlayStaticHandlers.get(root);

    if (!handler) {
      handler = express.static(root, { index: OVERLAY_ENTRY_FILE });
      overlayStaticHandlers.set(root, handler);
    }

    const originalUrl = req.url;
    const rest = segments.slice(1).join("/");

    // 默认内置保留 /overlay/ 作为唯一地址（Hai 的 Vite base 与之绑定）。
    if (overlayId === DEFAULT_OVERLAY_ID) {
      res.redirect(302, `/overlay/${rest}${rawQuery ? `?${rawQuery}` : ""}`);
      return;
    }

    req.url = `/${rest}${rawQuery ? `?${rawQuery}` : ""}`;
    res.on("finish", () => {
      req.url = originalUrl;
    });

    handler(req, res, next);
  });

  app.use("/assets", express.static(fileService.getAssetsDir()));
  app.use("/overlay", express.static(getOverlayStaticDir()));
  app.use("/hud", express.static(getOverlayStaticDir()));

  const server = http.createServer(app);
  return server;
}