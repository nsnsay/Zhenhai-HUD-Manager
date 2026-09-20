<script setup lang="ts">
defineProps<{
  title: string;
  body: string;
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/40 bg-elevated/20 px-6 py-10 text-center"
  >
    <UIcon name="i-lucide-layers" class="h-5 w-5 text-muted" />
    <p class="mt-3 text-sm font-medium text-muted">{{ title }}</p>
    <p class="mt-1 text-xs text-dimmed">{{ body }}</p>
    <div class="mt-3">
      <slot />
    </div>
  </div>
</template>