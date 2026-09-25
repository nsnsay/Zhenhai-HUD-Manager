<script setup lang="ts">
/**
 * 可点击排序的表头。
 *
 * Nuxt UI 的 Table 不会自动把表头变成排序按钮，需要在 header 插槽里自己接
 * TanStack 的 column API；这里把三个页面里重复的那段收敛成一个组件。
 * HIG `lists-and-tables.md › Desktop (macOS)`："When it provides value, let people
 * click a column heading to sort a table view based on that column."
 */
import { computed } from "vue";

interface SortableColumn {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
}

const props = defineProps<{
  column: SortableColumn;
  label: string;
}>();

const icon = computed(() => {
  const sorted = props.column.getIsSorted();

  if (sorted === "asc") return "i-lucide-arrow-up-narrow-wide";
  if (sorted === "desc") return "i-lucide-arrow-down-wide-narrow";

  return "i-lucide-arrow-up-down";
});
</script>

<template>
  <UButton
    :label="label"
    :icon="icon"
    color="neutral"
    variant="ghost"
    size="sm"
    class="-mx-2.5"
    @click="column.toggleSorting(column.getIsSorted() === 'asc')"
  />
</template>
