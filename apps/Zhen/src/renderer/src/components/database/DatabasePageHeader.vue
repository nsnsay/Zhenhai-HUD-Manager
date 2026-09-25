<script setup lang="ts">
/** 数据库三个列表页共用的页头：标题 + 说明 + 右侧操作区。 */
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <header class="flex shrink-0 flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <h1 class="text-xl font-semibold leading-6 text-highlighted">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-[13.5px] leading-5 text-toned">{{ subtitle }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>
