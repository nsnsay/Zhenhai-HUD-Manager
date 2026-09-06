import { defineStore } from "pinia";
import { getCurrentScope, markRaw, onScopeDispose, ref, shallowRef } from "vue";
import { io, type Socket } from "socket.io-client";
import type { CSGO, Events } from "../src/interfaces";

/**
 * 排除服务端不会转发、或者不适合客户端监听的事件。
 */
type ExcludedGsiEvent = "raw" | "newListener" | "removeListener";

export type GsiEventName = Exclude<keyof Events, ExcludedGsiEvent>;

export type GsiEventListener<K extends GsiEventName> = Events[K];

/**
 * 使用 Record<GsiEventName, true> 强制这里包含所有 GSI 事件。
 * 如果后续 Events 增加事件但这里没补，会产生 TS 编译错误。
 */
const GSI_EVENT_MAP: Record<GsiEventName, true> = {
  data: true,
  roundEnd: true,
  matchEnd: true,
  overtime: true,
  kill: true,
  hurt: true,
  phaseChange: true,
  timeoutStart: true,
  timeoutEnd: true,
  pauseStart: true,
  pauseEnd: true,
  warmupStart: true,
  warmupEnd: true,
  mvp: true,
  freezetimeStart: true,
  freezetimeEnd: true,
  intermissionStart: true,
  intermissionEnd: true,
  defuseStart: true,
  defuseStop: true,
  bombPlantStart: true,
  bombPlantStop: true,
  bombPlant: true,
  bombExplode: true,
  bombDefuse: true,
};

export const GSI_EVENT_NAMES = Object.keys(GSI_EVENT_MAP) as GsiEventName[];

export interface GsiConnectOptions {
  url?: string;
  autoRefresh?: boolean;
  reconnection?: boolean;

  /**
   * 是否将高频 `gsi:data` 合并到浏览器下一帧更新。
   *
   * - `false`：每一个 GSI 数据包都会立即写入 `data`，保留现有数据效率。
   * - `true`：同一帧内收到多个数据包时，只应用最新数据包，可降低 CPU。
   *
   * 默认 `false`，保证不影响现有数据频率。
   */
  frameSync?: boolean;
}

export const useGsiStore = defineStore("gsi", () => {
  const socket = shallowRef<Socket | null>(null);
  const connected = ref(false);
  const data = shallowRef<CSGO | null>(null);

  const refreshCallbacks = new Set<() => void>();
  const listeners = new Map<GsiEventName, Set<(...args: any[]) => void>>();

  type BrowserGlobals = {
    requestAnimationFrame?: (callback: () => void) => number;
    cancelAnimationFrame?: (id: number) => void;
    location?: {
      reload: () => void;
    };
  };

  let frameSyncEnabled = false;
  let pendingData: CSGO | null = null;
  let frameScheduled = false;
  let frameId: number | null = null;

  function flushPendingData(): void {
    frameScheduled = false;
    frameId = null;

    if (pendingData !== null) {
      data.value = pendingData;
      pendingData = null;
    }
  }

  function scheduleData(raw: CSGO): void {
    pendingData = raw;

    if (frameScheduled) {
      return;
    }

    frameScheduled = true;

    const browser = globalThis as typeof globalThis & BrowserGlobals;

    if (typeof browser.requestAnimationFrame === "function") {
      frameId = browser.requestAnimationFrame(() => {
        flushPendingData();
      });
    } else {
      Promise.resolve().then(() => {
        flushPendingData();
      });
    }
  }

  function cancelPendingData(): void {
    const browser = globalThis as typeof globalThis & BrowserGlobals;

    if (frameId !== null && typeof browser.cancelAnimationFrame === "function") {
      browser.cancelAnimationFrame(frameId);
    }

    frameId = null;
    frameScheduled = false;
    pendingData = null;
  }

  function setData(raw: CSGO | null): void {
    if (!raw) {
      cancelPendingData();
      data.value = null;
      return;
    }

    if (frameSyncEnabled) {
      scheduleData(raw);
    } else {
      data.value = raw;
    }
  }

  function emitLocal(event: GsiEventName, args: any[]): void {
    const set = listeners.get(event);

    if (!set || set.size === 0) {
      return;
    }

    for (const listener of set) {
      listener.apply(undefined, args);
    }
  }

  function handleGsiData(raw: CSGO): void {
    setData(raw);

    const set = listeners.get("data");

    if (!set || set.size === 0) {
      return;
    }

    for (const listener of set) {
      (listener as (data: CSGO) => void)(raw);
    }
  }

  function cleanupSocket(): void {
    if (!socket.value) {
      return;
    }

    socket.value.removeAllListeners();
    socket.value.disconnect();
    socket.value = null;
    connected.value = false;
  }

  function connect(options: GsiConnectOptions = {}): void {
    const {
      url = "http://127.0.0.1:1469",
      autoRefresh = false,
      reconnection = true,
      frameSync = false,
    } = options;

    if (socket.value?.connected) {
      return;
    }

    cleanupSocket();
    cancelPendingData();

    frameSyncEnabled = frameSync;

    const rawSocket = io(url, {
      transports: ["websocket"],
      reconnection,
    });

    /**
     * Socket.IO 实例不应该被 Vue 深度响应式代理。
     */
    const s = markRaw(rawSocket);

    socket.value = s;

    s.on("connect", () => {
      connected.value = true;
    });

    s.on("disconnect", () => {
      connected.value = false;
    });

    s.on("overlay:refresh", () => {
      refreshCallbacks.forEach((callback) => callback());

      const browser = globalThis as typeof globalThis & BrowserGlobals;

      if (autoRefresh && typeof browser.location?.reload === "function") {
        browser.location.reload();
      }
    });

    /**
     * 主数据事件。
     */
    s.on("gsi:data", handleGsiData);

    /**
     * 其他所有 GSI 事件。
     */
    for (const eventName of GSI_EVENT_NAMES) {
      if (eventName === "data") {
        continue;
      }

      s.on(`gsi:${String(eventName)}`, (...args: any[]) => {
        emitLocal(eventName, args);
      });
    }
  }

  function disconnect(): void {
    cancelPendingData();
    cleanupSocket();

    data.value = null;
    refreshCallbacks.clear();
  }

  function on<K extends GsiEventName>(event: K, listener: GsiEventListener<K>): () => void {
    let set = listeners.get(event);

    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }

    set.add(listener as (...args: any[]) => void);

    return () => {
      off(event, listener);
    };
  }

  function off<K extends GsiEventName>(event: K, listener: GsiEventListener<K>): void {
    const set = listeners.get(event);

    if (!set) {
      return;
    }

    set.delete(listener as (...args: any[]) => void);

    if (set.size === 0) {
      listeners.delete(event);
    }
  }

  function once<K extends GsiEventName>(event: K, listener: GsiEventListener<K>): () => void {
    const wrapper = ((...args: any[]) => {
      off(event, wrapper as GsiEventListener<K>);
      (listener as (...args: any[]) => void).apply(undefined, args);
    }) as GsiEventListener<K>;

    return on(event, wrapper);
  }

  function offAll(event?: GsiEventName): void {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }

  function onRefresh(callback: () => void): () => void {
    refreshCallbacks.add(callback);

    return () => {
      refreshCallbacks.delete(callback);
    };
  }

  return {
    connected,
    data,
    connect,
    disconnect,
    on,
    once,
    off,
    offAll,
    onRefresh,
  };
});

/**
 * Vue 组件内监听 GSI 事件。
 *
 * 会在组件作用域销毁时自动取消监听。
 */
export function useGsiEvent<K extends GsiEventName>(
  event: K,
  listener: GsiEventListener<K>,
): () => void {
  const store = useGsiStore();
  const off = store.on(event, listener);

  if (getCurrentScope()) {
    onScopeDispose(off);
  }

  return off;
}
