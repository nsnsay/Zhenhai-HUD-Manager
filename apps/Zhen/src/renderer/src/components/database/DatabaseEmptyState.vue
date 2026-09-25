<script setup lang="ts">
/**
 * 空状态：说明这里是什么、下一步做什么。
 *
 * HIG `writing.md › Best practices`："Provide clear next steps on any blank screens…
 * guide people on actions they can take"，所以 hint 直接点名页头的创建按钮。
 */
defineProps<{
  icon: string;
  title: string;
  hint?: string;
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-default bg-elevated/40 px-6 py-16 text-center"
  >
    <div class="mb-1 flex h-11 w-11 items-center justify-center rounded-full border border-default">
      <UIcon :name="icon" class="h-5 w-5 text-toned" />
    </div>

    <p class="text-sm font-medium text-highlighted">{{ title }}</p>
    <p v-if="hint" class="max-w-sm text-[13.5px] leading-5 text-toned">{{ hint }}</p>
  </div>
</template>
