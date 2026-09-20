import { globalShortcut } from "electron";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  SHORTCUT_ACTION_LABELS,
  canonicalAccelerator,
  findDuplicateBindings,
  type ShortcutAction,
  type ShortcutBindings,
  type ShortcutRegistrationMap,
} from "../../shared/shortcuts";
import { errorMessage } from "../../shared/errors";
import { logger } from "./logger.service";

export type ShortcutHandler = () => void;

export interface DynamicShortcutResult {
  id: string;
  accelerator: string;
  success: boolean;
  error?: string;
}

/**
 * 全局快捷键注册表。
 *
 * - 每个动作独立注册，逐个返回成功/失败原因（组合键冲突、被其它程序占用等）；
 * - 只有注册成功才会被记为「当前生效」，避免设置界面显示一个实际未生效的键；
 * - 重新注册前先注销上一轮，保证改键立即生效。
 */
class ShortcutService {
  private static instance: ShortcutService;

  private readonly handlers = new Map<ShortcutAction, ShortcutHandler>();
  private readonly registered = new Map<ShortcutAction, string>();
  /** 动态（Overlay 声明）快捷键：scope → (shortcutId → accelerator)。 */
  private readonly dynamicScopes = new Map<string, Map<string, string>>();
  private lastDynamicResults: DynamicShortcutResult[] = [];

  static getInstance(): ShortcutService {
    if (!ShortcutService.instance) {
      ShortcutService.instance = new ShortcutService();
    }

    return ShortcutService.instance;
  }

  setHandler(action: ShortcutAction, handler: ShortcutHandler): void {
    this.handlers.set(action, handler);
  }

  register(bindings: ShortcutBindings): ShortcutRegistrationMap {
    this.unregisterActions();

    const duplicated = new Set<ShortcutAction>();

    for (const actions of findDuplicateBindings(bindings).values()) {
      for (const action of actions) {
        duplicated.add(action);
      }
    }

    const results = {} as ShortcutRegistrationMap;

    for (const action of SHORTCUT_ACTIONS) {
      const accelerator = (bindings[action] ?? DEFAULT_SHORTCUTS[action]).trim();
      const label = SHORTCUT_ACTION_LABELS[action];

      if (!accelerator) {
        results[action] = { accelerator, success: false, error: "快捷键不能为空" };
        continue;
      }

      if (duplicated.has(action)) {
        results[action] = { accelerator, success: false, error: "与其它动作的组合键重复" };
        logger.error("ShortcutService", `Duplicate accelerator for ${label}: ${accelerator}`);
        continue;
      }

      const handler = this.handlers.get(action);

      if (!handler) {
        results[action] = { accelerator, success: false, error: "缺少动作处理器" };
        logger.error("ShortcutService", `No handler registered for action: ${action}`);
        continue;
      }

      let success = false;

      try {
        success = globalShortcut.register(accelerator, handler);
      } catch (error) {
        results[action] = { accelerator, success: false, error: errorMessage(error) };
        logger.error("ShortcutService", `Invalid accelerator for ${label}: ${accelerator}`, error);
        continue;
      }

      if (success) {
        this.registered.set(action, accelerator);
        results[action] = { accelerator, success: true };
        logger.info("ShortcutService", `Registered ${label}: ${accelerator}`);
      } else {
        results[action] = { accelerator, success: false, error: "该组合键已被其它程序占用" };
        logger.error("ShortcutService", `Failed to register ${label}: ${accelerator}`);
      }
    }

    return results;
  }

  getRegistered(): ShortcutBindings {
    const bindings: ShortcutBindings = {};

    for (const [action, accelerator] of this.registered) {
      bindings[action] = accelerator;
    }

    return bindings;
  }

  private unregisterActions(): void {
    for (const accelerator of this.registered.values()) {
      globalShortcut.unregister(accelerator);
    }

    this.registered.clear();
  }

  /**
   * 注册一组动态快捷键（Overlay 清单声明）。
   *
   * 命名空间由调用方给出（当前为 "overlay"）；应用自带动作与其它 scope 已占用的组合键会被跳过并报告冲突。
   */
  registerDynamic(
    scope: string,
    bindings: Record<string, string>,
    onPress: (shortcutId: string) => void,
  ): DynamicShortcutResult[] {
    this.unregisterDynamic(scope);

    const reserved = new Set<string>();

    for (const accelerator of this.registered.values()) {
      reserved.add(canonicalAccelerator(accelerator));
    }

    for (const accelerators of this.dynamicScopes.values()) {
      for (const accelerator of accelerators.values()) {
        reserved.add(canonicalAccelerator(accelerator));
      }
    }

    const registered = new Map<string, string>();
    const results: DynamicShortcutResult[] = [];

    for (const [id, accelerator] of Object.entries(bindings)) {
      const value = accelerator?.trim() ?? "";

      if (!value) {
        results.push({ id, accelerator: value, success: false, error: "快捷键不能为空" });
        continue;
      }

      if (reserved.has(canonicalAccelerator(value))) {
        results.push({ id, accelerator: value, success: false, error: "与应用快捷键或其它 Overlay 冲突" });
        continue;
      }

      let success = false;

      try {
        success = globalShortcut.register(value, () => onPress(id));
      } catch {
        success = false;
      }

      if (!success) {
        results.push({ id, accelerator: value, success: false, error: "该组合键已被其它程序占用" });
        continue;
      }

      reserved.add(canonicalAccelerator(value));
      registered.set(id, value);
      results.push({ id, accelerator: value, success: true });
      logger.info("ShortcutService", `Registered dynamic shortcut ${scope}:${id}: ${value}`);
    }

    this.dynamicScopes.set(scope, registered);
    this.lastDynamicResults = results;

    return results;
  }

  unregisterDynamic(scope: string): void {
    const accelerators = this.dynamicScopes.get(scope);

    if (!accelerators) return;

    for (const accelerator of accelerators.values()) {
      globalShortcut.unregister(accelerator);
    }

    this.dynamicScopes.delete(scope);
  }

  /** 切换 Overlay / 退出前清空所有动态快捷键。 */
  unregisterAllDynamic(): void {
    for (const scope of [...this.dynamicScopes.keys()]) {
      this.unregisterDynamic(scope);
    }

    this.lastDynamicResults = [];
  }

  getLastDynamicResults(): DynamicShortcutResult[] {
    return this.lastDynamicResults;
  }

  unregisterAll(): void {
    this.unregisterAllDynamic();
    globalShortcut.unregisterAll();
    this.registered.clear();
  }
}

export const shortcutService = ShortcutService.getInstance();