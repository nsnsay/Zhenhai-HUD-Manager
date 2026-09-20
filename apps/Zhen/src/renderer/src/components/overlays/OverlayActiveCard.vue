<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { resolveOverlayUrl } from "../../../../shared/overlays";
import { serverOrigin } from "../../../../shared/server";
import type { OverlayEntry } from "../../../../shared/ipc";

const props = defineProps<{
  entry: OverlayEntry | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  copy: [url: string];
}>();

const { t } = useI18n();

const url = computed(() => (props.entry ? resolveOverlayUrl(props.entry, serverOrigin()) : ""));

const sourceLabel = computed(() => {
  if (!props.entry) return "";
  if (props.entry.source === "builtin") return t("overlays.sourceBuiltin");
  if (props.entry.source === "dev") return t("overlays.sourceDev");

  return t("overlays.sourceImported");
});

const statusLabel = computed(() =>
  props.isOpen ? t("overlays.windowOpen") : t("overlays.windowClosed"),
);
</script>

<template>
  <section class="rounded-lg border border-default/50 bg-elevated/40 p-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
          <span class="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {{ t("overlays.onAir") }}
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <h3 class="truncate text-base font-semibold">{{ entry?.name ?? "—" }}</h3>
          <UBadge v-if="entry" size="sm" color="neutral" variant="subtle">{{ sourceLabel }}</UBadge>
        </div>

        <p class="mt-1 text-xs text-muted">{{ t("overlays.activeUrlHint") }}</p>
      </div>

      <UBadge
        :color="isOpen ? 'success' : 'neutral'"
        variant="subtle"
        :icon="isOpen ? 'i-lucide-monitor-play' : 'i-lucide-monitor-off'"
      >
        {{ statusLabel }}
      </UBadge>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <code
        class="min-w-0 flex-1 truncate rounded-md border border-default/40 bg-default/40 px-3 py-2 font-mono text-xs select-all"
      >
        {{ url || "—" }}
      </code>

      <UButton
        :label="t('overlays.copyUrl')"
        icon="i-lucide-clipboard-copy"
        size="sm"
        color="primary"
        variant="subtle"
        :disabled="!url"
        @click="emit('copy', url)"
      />
    </div>
  </section>
</template>