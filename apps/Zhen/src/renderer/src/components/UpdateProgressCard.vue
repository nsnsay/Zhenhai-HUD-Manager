<script setup lang="ts">
import { computed } from "vue";
import { useUpdaterStore } from "@renderer/stores/useUpdaterStore";

const props = withDefaults(
  defineProps<{
    /** 悬浮在窗口右下角（全局提示）；为 false 时作为普通卡片内联展示。 */
    floating?: boolean;
  }>(),
  {
    floating: false,
  },
);

const updater = useUpdaterStore();

const visible = computed(() => updater.isDownloading || updater.isDownloaded);

const title = computed(() =>
  updater.isDownloaded ? "Update ready to install" : "Downloading update",
);

const versionLabel = computed(() =>
  updater.version ? `Version ${updater.version}` : "Latest version",
);

const accentColor = computed(() => (updater.isDownloaded ? "var(--ui-success)" : "var(--ui-primary)"));

const iconName = computed(() =>
  updater.isDownloaded ? "i-lucide-circle-check" : "i-lucide-download-cloud",
);

function handleInstall(): void {
  void updater.installUpdate();
}
</script>

<template>
  <Transition name="update-progress">
    <div
      v-if="visible"
      class="update-progress-card w-72 rounded-lg border border-default/50 bg-elevated/90 p-3 shadow-lg backdrop-blur-xl"
      :class="props.floating ? 'fixed bottom-4 right-4 z-100000' : ''"
    >
      <div class="flex items-center gap-2">
        <UIcon :name="iconName" class="h-4 w-4 shrink-0" :style="{ color: accentColor }" />

        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-semibold">{{ title }}</div>
          <div class="truncate text-[11px] text-muted">{{ versionLabel }}</div>
        </div>

        <div class="shrink-0 font-mono text-xs text-muted">{{ updater.progress }}%</div>
      </div>

      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-default/50">
        <div
          class="h-full rounded-full transition-[width] duration-200 ease-out"
          :style="{ width: `${updater.progress}%`, backgroundColor: accentColor }"
        />
      </div>

      <div v-if="updater.isDownloaded" class="mt-3 flex justify-end">
        <UButton
          label="Restart & Install"
          icon="i-lucide-refresh-cw"
          color="primary"
          size="xs"
          @click="handleInstall"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.update-progress-enter-active,
.update-progress-leave-active {
  transition:
    opacity 200ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.update-progress-enter-from,
.update-progress-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .update-progress-enter-active,
  .update-progress-leave-active {
    transition: opacity 120ms ease;
    will-change: auto;
  }

  .update-progress-enter-from,
  .update-progress-leave-to {
    transform: none;
  }
}
</style>