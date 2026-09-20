<script setup lang="ts">
import OverlayListItem from "./OverlayListItem.vue";
import type { OverlayEntry } from "../../../../shared/ipc";

const props = withDefaults(
  defineProps<{
    entries: OverlayEntry[];
    selectedId: string;
    removable?: boolean;
  }>(),
  {
    removable: false,
  },
);

const emit = defineEmits<{
  select: [overlayId: string];
  remove: [overlayId: string];
  reveal: [overlayId: string];
  settings: [overlayId: string];
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <OverlayListItem
      v-for="entry in props.entries"
      :key="entry.overlayId"
      :entry="entry"
      :selected="entry.overlayId === props.selectedId"
      :removable="props.removable"
      @select="emit('select', $event)"
      @remove="emit('remove', $event)"
      @reveal="emit('reveal', $event)"
      @settings="emit('settings', $event)"
    />
  </div>
</template>