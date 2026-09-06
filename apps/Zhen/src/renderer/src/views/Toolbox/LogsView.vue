<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const logText = ref("");
const isLoading = ref(false);
const lastUpdated = ref<string | null>(null);
let refreshTimer: number | null = null;

const visibleLines = computed(() =>
  logText.value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-1000)
    .reverse(),
);

function lineTone(line: string): "error" | "warn" | "info" | "debug" {
  if (/\[error\]/.test(line)) return "error";
  if (/\[warn\]/.test(line)) return "warn";
  if (/\[debug\]/.test(line)) return "debug";
  return "info";
}

async function refreshLogs(): Promise<void> {
  if (isLoading.value) return;

  isLoading.value = true;
  try {
    logText.value = await window.api.logger.read(1000);
    lastUpdated.value = new Date().toLocaleTimeString();
  } catch (error) {
    logText.value = `[error] [LogsView] Failed to read logs\n${String(error)}`;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void refreshLogs();
  refreshTimer = window.setInterval(() => {
    void refreshLogs();
  }, 2000);
});

onUnmounted(() => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold leading-6">Logs</h2>
        <p class="text-sm text-muted">Recent main process, IPC, and renderer log output.</p>
      </div>

      <div class="flex items-center gap-2">
        <UBadge v-if="lastUpdated" color="neutral" variant="outline">
          {{ lastUpdated }}
        </UBadge>
        <UButton
          label="Refresh"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="isLoading"
          @click="refreshLogs"
        />
      </div>
    </div>

    <div class="log-panel min-h-0 flex-1 overflow-hidden rounded-lg border border-default/40 bg-black/20 shadow-sm">
      <div v-if="visibleLines.length > 0" class="h-full overflow-auto p-3 font-mono text-xs leading-5">
        <div
          v-for="(line, index) in visibleLines"
          :key="`${index}-${line}`"
          class="whitespace-pre-wrap break-all"
          :class="{
            'text-error': lineTone(line) === 'error',
            'text-amber-400': lineTone(line) === 'warn',
            'text-muted': lineTone(line) === 'debug',
            'text-foreground': lineTone(line) === 'info',
          }"
        >
          {{ line }}
        </div>
      </div>

      <div v-else class="flex h-full items-center justify-center text-sm text-muted">
        No log output yet.
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.log-panel {
  backdrop-filter: blur(16px);
}

@media (prefers-reduced-transparency: reduce) {
  .log-panel {
    backdrop-filter: none;
  }
}
</style>
