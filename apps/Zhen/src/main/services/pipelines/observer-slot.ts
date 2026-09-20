/**
 * CS2 GSI 的 observer_slot → HUD 展示槽位。
 *
 * 保持历史语义（仅在行为上显式化，原先是一个空 else-if 分支）：
 * - 1..9 → +1
 * - 10   → 0（游戏里第 10 个槽位映射到 0）
 * - 0 与 11+ → 保持原值（教练/观战者等非选手槽位）
 */
export const OBSERVER_SLOT_WRAP = 10;

export function toHudObserverSlot(slot: number | undefined | null): number | undefined {
  if (slot === undefined || slot === null) {
    return undefined;
  }

  if (slot >= 1 && slot < OBSERVER_SLOT_WRAP) {
    return slot + 1;
  }

  if (slot === OBSERVER_SLOT_WRAP) {
    return 0;
  }

  return slot;
}