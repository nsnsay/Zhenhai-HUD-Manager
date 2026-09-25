<script setup lang="ts">
/**
 * 数据库列表的一行。
 *
 * 行式样按 HIG `lists-and-tables.md › Style`：行首一张小图，后面跟简短的说明标签，
 * 行尾放配件（状态与操作）。行高 ≥52px、行内控件 ≥28px，见
 * `accessibility.md › Mobility`（桌面默认 28pt、最小 20pt）。
 *
 * `accent` 用于「正在直播」这类状态：左侧一条状态色条，
 * 配合右侧的状态胶囊，不靠颜色单独传达状态。
 */
withDefaults(defineProps<{ accent?: boolean }>(), { accent: false });
</script>

<template>
  <div
    class="relative flex min-h-13 items-center gap-3 border-t border-default px-3.5 py-2.5 transition-colors first:border-t-0 hover:bg-accented/40 focus-within:bg-accented/40"
  >
    <span
      v-if="accent"
      class="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-error"
      aria-hidden="true"
    />

    <slot name="leading" />

    <div class="min-w-0 flex-1">
      <slot />
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <slot name="trailing" />
    </div>
  </div>
</template>
