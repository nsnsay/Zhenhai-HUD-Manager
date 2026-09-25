import { ref, watch, type Ref } from "vue";

export type ViewMode = "list" | "table";

/**
 * 列表 / 表格视图模式的持久化。
 *
 * 每个页面一个存储键，默认落在「列表」：这三页都是文字为主的注册表，
 * 行列表比卡片墙更好扫读（HIG `lists-and-tables.md › Best practices`：
 * "Prefer displaying text in a list or table."）。
 */
export function useViewMode(storageKey: string, fallback: ViewMode = "list"): Ref<ViewMode> {
  const stored = localStorage.getItem(storageKey);
  const viewMode = ref<ViewMode>(stored === "list" || stored === "table" ? stored : fallback);

  watch(viewMode, (mode) => {
    localStorage.setItem(storageKey, mode);
  });

  return viewMode;
}
