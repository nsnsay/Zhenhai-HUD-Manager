import { BrowserWindow, shell } from "electron";
import { is } from "@electron-toolkit/utils";
import { join } from "path";
import icon from "../../../resources/icon.ico?asset";
import type { OverlayLifecycleState } from "../../shared/ipc";
import { resolveOverlayUrl, type OverlayEntry } from "../../shared/overlays";
import { OVERLAY_DEV_URL, overlayUrl, serverOrigin } from "../../shared/server";
import { logger } from "./logger.service";

export type { OverlayLifecycleState };

export interface OverlayServiceHandlers {
  onLifecycle?: (state: OverlayLifecycleState) => void;
  onIgnoreMouseChanged?: (enabled: boolean) => void;
}

/**
 * Overlay 窗口的唯一归属者：创建/关闭、生命周期事件与鼠标穿透状态。
 *
 * 鼠标穿透默认开启，且**不持久化**——每次创建窗口都回到「穿透开启」，
 * 避免重启后忘记切换而出现全屏拦截点击。
 */
class OverlayService {
  private static instance: OverlayService;

  private overlayWindow: BrowserWindow | null = null;
  private ignoreMouseEvents = true;
  private activeEntry: OverlayEntry | null = null;
  private handlers: OverlayServiceHandlers = {};

  private readonly lifecycleBound = new WeakSet<BrowserWindow>();

  static getInstance(): OverlayService {
    if (!OverlayService.instance) {
      OverlayService.instance = new OverlayService();
    }

    return OverlayService.instance;
  }

  init(handlers: OverlayServiceHandlers): void {
    this.handlers = handlers;
  }

  getWindow(): BrowserWindow | null {
    if (this.overlayWindow && this.overlayWindow.isDestroyed()) {
      this.overlayWindow = null;
    }

    return this.overlayWindow;
  }

  isOpen(): boolean {
    return this.getWindow() !== null;
  }

  isIgnoreMouseEvents(): boolean {
    return this.ignoreMouseEvents;
  }

  /**
   * 打开（或聚焦）Overlay 窗口。
   *
   * 传入 entry 时会成为当前生效的 Overlay；若与已打开的窗口不同则立即重新加载。
   * 不传 entry 时只显示窗口，避免每次打开都刷新。
   */
  open(entry: OverlayEntry | null = null): BrowserWindow | null {
    const entryChanged = entry !== null && entry.overlayId !== this.activeEntry?.overlayId;

    if (entry) {
      this.activeEntry = entry;
    }

    const existing = this.getWindow();

    if (existing) {
      existing.show();

      if (entryChanged) {
        void existing.loadURL(this.resolveActiveUrl());
      }

      return existing;
    }

    return this.create();
  }

  getActiveEntry(): OverlayEntry | null {
    return this.activeEntry;
  }

  setActiveEntry(entry: OverlayEntry | null): void {
    this.activeEntry = entry;
  }

  /** 按当前生效条目重新加载（Overlays 页面的 Reload 动作）。 */
  reload(): boolean {
    const win = this.getWindow();

    if (!win) {
      return false;
    }

    void win.loadURL(this.resolveActiveUrl());
    logger.info("OverlayService", `Overlay reloaded: ${this.activeEntry?.overlayId ?? "default"}`);

    return true;
  }

  private resolveActiveUrl(): string {
    if (this.activeEntry) {
      return resolveOverlayUrl(this.activeEntry, serverOrigin());
    }

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      return OVERLAY_DEV_URL;
    }

    return overlayUrl();
  }

  close(): boolean {
    const win = this.getWindow();

    if (!win) {
      return false;
    }

    win.close();
    return true;
  }

  setIgnoreMouseEvents(enabled: boolean): boolean {
    this.ignoreMouseEvents = enabled;

    const win = this.getWindow();
    win?.setIgnoreMouseEvents(enabled);

    logger.info(
      "OverlayService",
      `Ignore mouse events set to ${enabled}${win ? "" : " (overlay window not open)"}`,
    );
    this.handlers.onIgnoreMouseChanged?.(enabled);

    return enabled;
  }

  /** 由全局快捷键调用：作用于当前 Overlay 窗口，不自动创建窗口。 */
  toggleIgnoreMouseEvents(): boolean {
    return this.setIgnoreMouseEvents(!this.ignoreMouseEvents);
  }

  toggleDevTools(): boolean {
    const win = this.getWindow();

    if (!win) {
      return false;
    }

    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools({ mode: "detach" });
    }

    return true;
  }

  private create(): BrowserWindow {
    const win = new BrowserWindow({
      fullscreen: true,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      focusable: true,
      frame: false,
      title: "Zhenhai Overlay",
      icon: icon,
      skipTaskbar: true,
      type: "toolbar",
      webPreferences: {
        preload: join(__dirname, "../../preload/index.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        devTools: true,
      },
    });

    this.overlayWindow = win;
    this.ignoreMouseEvents = true;

    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    win.on("closed", () => {
      this.overlayWindow = null;
      this.ignoreMouseEvents = true;
      logger.info("OverlayService", "Overlay window destroyed");
    });

    win.setAlwaysOnTop(true, "screen-saver", 1);
    win.setFullScreen(true);
    win.setIgnoreMouseEvents(true);

    this.bindLifecycle(win);

    logger.info("OverlayService", "Overlay window created");
    this.handlers.onIgnoreMouseChanged?.(true);

    win.loadURL(this.resolveActiveUrl());

    return win;
  }

  /** 把窗口生命周期转发给主窗口渲染端（用 WeakSet 记录绑定，避免给窗口挂私有属性）。 */
  private bindLifecycle(win: BrowserWindow): void {
    if (this.lifecycleBound.has(win)) {
      return;
    }

    this.lifecycleBound.add(win);

    const notify = (state: OverlayLifecycleState): void => {
      logger.info("OverlayService", `Overlay lifecycle event: ${state}`);
      this.handlers.onLifecycle?.(state);
    };

    win.on("show", () => notify("shown"));
    win.on("hide", () => notify("hidden"));
    win.on("close", () => notify("closing"));
    win.on("closed", () => notify("closed"));
  }
}

export const overlayService = OverlayService.getInstance();