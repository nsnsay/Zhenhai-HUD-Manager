/**
 * 全局快捷键的动作定义与纯函数工具。
 *
 * - 动作枚举、默认键、展示名供 main / renderer 共用；
 * - acceleratorFromInput / formatAccelerator / canonicalAccelerator 都是纯函数，
 *   便于单元测试（不依赖 DOM 与 Electron）。
 */
export const SHORTCUT_ACTIONS = ["overlayRefresh", "overlayToggleMouseEvents"] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export interface ShortcutRegistration {
  accelerator: string;
  success: boolean;
  error?: string;
}

export type ShortcutRegistrationMap = Record<ShortcutAction, ShortcutRegistration>;

export type ShortcutBindings = Partial<Record<ShortcutAction, string>>;

export const SHORTCUT_ACTION_LABELS: Record<ShortcutAction, string> = {
  overlayRefresh: "Refresh Overlay",
  overlayToggleMouseEvents: "Toggle Overlay Mouse Events",
};

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  overlayRefresh: "CommandOrControl+Alt+I",
  overlayToggleMouseEvents: "CommandOrControl+Alt+M",
};

/** 录制用输入：由 KeyboardEvent 提取，保持与 DOM 解耦。 */
export interface ShortcutKeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const NAMED_KEYS: Record<string, string> = {
  " ": "Space",
  Spacebar: "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Tab: "Tab",
  Enter: "Return",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Escape: "Escape",
};

const MODIFIER_KEY_NAMES = new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "AltGraph",
  "CapsLock",
]);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEY_NAMES.has(key);
}

function normalizeKey(input: ShortcutKeyInput): string | null {
  if (!input.key) {
    return null;
  }

  if (Object.hasOwn(NAMED_KEYS, input.key)) {
    return NAMED_KEYS[input.key]!;
  }

  if (/^[a-z]$/i.test(input.key)) {
    return input.key.toUpperCase();
  }

  if (/^[0-9]$/.test(input.key)) {
    return input.key;
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(input.key)) {
    return input.key.toUpperCase();
  }

  return null;
}

/**
 * 根据一次按键生成 Electron accelerator。
 *
 * 规则：必须有 CommandOrControl / Alt / Super 之一（仅 Shift 或裸键会被忽略），
 * 键名限定在字母、数字、F1-F24 与常见功能键，其它键（标点、IME 等）返回 null。
 */
export function acceleratorFromInput(input: ShortcutKeyInput): string | null {
  const key = normalizeKey(input);

  if (!key) {
    return null;
  }

  const hasPrimaryModifier = input.ctrlKey || input.altKey || input.metaKey;

  if (!hasPrimaryModifier) {
    return null;
  }

  const parts: string[] = [];

  if (input.ctrlKey) parts.push("CommandOrControl");
  if (input.altKey) parts.push("Alt");
  if (input.shiftKey) parts.push("Shift");
  if (input.metaKey) parts.push("Super");

  parts.push(key);

  return parts.join("+");
}

/** 归一化用于比较（大小写 / 空格无关），供重复绑定检测使用。 */
export function canonicalAccelerator(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join("+");
}

/** 把 accelerator 转成界面上展示的写法（Ctrl + Alt + I）。 */
export function formatAccelerator(accelerator: string): string {
  if (!accelerator) {
    return "";
  }

  return accelerator
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      switch (part.toLowerCase()) {
        case "commandorcontrol":
        case "cmdorctrl":
        case "control":
        case "ctrl":
          return "Ctrl";
        case "cmd":
        case "command":
        case "super":
        case "meta":
          return "Super";
        case "alt":
        case "option":
          return "Alt";
        case "shift":
          return "Shift";
        case "return":
        case "enter":
          return "Enter";
        case "space":
          return "Space";
        default:
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join(" + ");
}

/** 找出重复绑定的动作对（key 为 canonical accelerator）。 */
export function findDuplicateBindings(
  bindings: ShortcutBindings,
): Map<string, ShortcutAction[]> {
  const groups = new Map<string, ShortcutAction[]>();

  for (const action of SHORTCUT_ACTIONS) {
    const accelerator = bindings[action]?.trim();

    if (!accelerator) {
      continue;
    }

    const key = canonicalAccelerator(accelerator);
    const existing = groups.get(key);

    if (existing) {
      existing.push(action);
    } else {
      groups.set(key, [action]);
    }
  }

  for (const [key, actions] of groups) {
    if (actions.length < 2) {
      groups.delete(key);
    }
  }

  return groups;
}