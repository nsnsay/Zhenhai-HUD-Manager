<script setup lang="ts">
/**
 * 行尾的「更多操作」菜单。
 *
 * 取代旧版 hover 才出现的图标按钮：那组操作平时完全不可见，而且用的是
 * `size="xs"`（约 24px，低于桌面 20pt ≈ 26.7px 的下限）。这里改成常驻的
 * `⋯` 菜单，命中区 36px，并带可读的无障碍名称。
 */
import type { DropdownMenuItem } from "@nuxt/ui";

defineProps<{
  items: DropdownMenuItem[][];
  label: string;
}>();
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-ellipsis-vertical"
      size="md"
      color="neutral"
      variant="ghost"
      :aria-label="label"
      :title="label"
    />
  </UDropdownMenu>
</template>
