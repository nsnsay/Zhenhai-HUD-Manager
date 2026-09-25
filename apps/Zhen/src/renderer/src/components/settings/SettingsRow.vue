<script setup lang="ts">
/**
 * 一行一件事：左侧标签（+可选说明），右侧控件。
 *
 * 行高与命中区按 apple-design 的桌面规格取：行 ≥44px，
 * 控件本身不低于 20pt 下限（≈27px），见 `accessibility.md › Mobility`。
 */
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    /** auto：控件自适应；wide：固定 220px（滑块用）；full：整行铺开（文本域用）。 */
    control?: "auto" | "wide" | "full";
  }>(),
  { control: "auto" },
);
</script>

<template>
  <div
    class="flex min-h-11 items-center gap-4 border-t border-default px-3.5 py-2.5 first:border-t-0"
    :class="control === 'full' ? 'flex-col items-stretch gap-2' : 'justify-between'"
  >
    <div class="min-w-0">
      <p class="text-sm font-medium text-highlighted">{{ label }}</p>
      <p v-if="hint" class="mt-0.5 text-[13px] leading-5 text-toned">{{ hint }}</p>
    </div>

    <div
      class="flex items-center justify-end"
      :class="
        control === 'wide' ? 'w-[220px] shrink-0' : control === 'full' ? 'w-full' : 'shrink-0'
      "
    >
      <slot />
    </div>
  </div>
</template>
