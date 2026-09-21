/**
 * CS2 GSI 的 observer_slot → HUD 展示槽位。
 *
 * 映射规则：
 * - 0..9 → +1（GSI 里第一个选手是 0，HUD 画面上的编号是 1..10）
 * - 10   → 0（绕回，使 0..10 的输入仍然落在 0..10）
 * - 11+  → 保持原值（教练/观战者等非选手槽位）
 *
 * 数组顺序不依赖本函数：player 管线先按原始 observer_slot 排序、再改写槽位值，
 * 因此 10 → 0 的绕回不会打乱侧栏与雷达的排列顺序。
 */
export const OBSERVER_SLOT_WRAP = 10;

export function toHudObserverSlot(slot: number | undefined | null): number | undefined {
  if (slot === undefined || slot === null) {
    return undefined;
  }

  if (slot >= 0 && slot < OBSERVER_SLOT_WRAP) {
    return slot + 1;
  }

  if (slot === OBSERVER_SLOT_WRAP) {
    return 0;
  }

  return slot;
}
