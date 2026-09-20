<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import type { DropdownMenuItem } from "@nuxt/ui";
import { overlayPath } from "../../../../shared/overlays";
import type { OverlayEntry } from "../../../../shared/ipc";

const props = defineProps<{
  entry: OverlayEntry;
  selected: boolean;
  removable: boolean;
}>();

const emit = defineEmits<{
  select: [overlayId: string];
  remove: [overlayId: string];
  reveal: [overlayId: string];
  settings: [overlayId: string];
}>();

const { t } = useI18n();

const sourceLabel = computed(() => {
  if (props.entry.source === "builtin") return t("overlays.sourceBuiltin");
  if (props.entry.source === "dev") return t("overlays.sourceDev");

  return t("overlays.sourceImported");
});

const sourceIcon = computed(() => {
  if (props.entry.source === "builtin") return "i-lucide-box";
  if (props.entry.source === "dev") return "i-lucide-terminal";

  return "i-lucide-package";
});

const detail = computed(() => overlayPath(props.entry));

const warningText = computed(() => t("overlays.absoluteAssetWarning", { name: props.entry.name }));

const menuItems = computed<DropdownMenuItem[][]>(() => {
  const items: DropdownMenuItem[][] = [];

  // 开发条目没有磁盘目录，不提供「在文件夹中显示」。
  if (props.entry.source !== "dev") {
    items.push([
      {
        label: t("overlays.settingsTitle"),
        icon: "i-lucide-sliders-horizontal",
        onSelect: () => emit("settings", props.entry.overlayId),
      },
      {
        label: t("overlays.reveal"),
        icon: "i-lucide-folder-open",
        onSelect: () => emit("reveal", props.entry.overlayId),
      },
    ]);
  }

  if (props.removable) {
    items.push([
      {
        label: t("overlays.remove"),
        icon: "i-lucide-trash-2",
        color: "error",
        onSelect: () => emit("remove", props.entry.overlayId),
      },
    ]);
  }

  return items;
});
</script>

<template>
  <div
    class="relative flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
    :class="
      selected
        ? 'border-primary/40 bg-elevated/45'
        : 'border-default/40 bg-elevated/25 hover:bg-elevated/40'
    "
  >
    <span
      v-if="selected"
      class="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
      aria-hidden="true"
    />

    <UIcon :name="sourceIcon" class="h-4 w-4 shrink-0 text-muted" />

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="truncate text-sm font-medium">{{ entry.name }}</span>
        <UBadge size="sm" color="neutral" variant="subtle">{{ sourceLabel }}</UBadge>
        <UBadge v-if="selected" size="sm" color="primary" variant="subtle" icon="i-lucide-check">
          {{ t("overlays.inUse") }}
        </UBadge>
        <UIcon
          v-if="entry.absoluteAssetWarning"
          name="i-lucide-triangle-alert"
          class="h-3.5 w-3.5 shrink-0 text-warning"
          :title="warningText"
          :aria-label="warningText"
        />
      </div>

      <div class="truncate text-xs text-dimmed">{{ detail }}</div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <UButton
        v-if="!selected"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-check"
        :label="t('overlays.use')"
        @click="emit('select', entry.overlayId)"
      />

      <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-ellipsis-vertical"
          :title="t('overlays.moreActions')"
          :aria-label="t('overlays.moreActions')"
        />
      </UDropdownMenu>
    </div>
  </div>
</template>