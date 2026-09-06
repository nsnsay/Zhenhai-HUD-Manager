<script setup lang="ts">
import { computed } from "vue";
import JsonViewer from "@ctechhindi/vue3-json-viewer";
import { useGsiStore } from "@zhenhai/csgogsi/gsi-vue";
import { useColorMode } from "@vueuse/core";

const gsi = useGsiStore();
const colorMode = useColorMode();

const connected = computed(() => gsi.connected);
const hasData = computed(() => Boolean(gsi.data));
const topLevelKeys = computed(() => (gsi.data ? Object.keys(gsi.data).length : 0));
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold leading-6">GSI Data</h2>
        <p class="text-sm text-muted">Inspect the latest live data forwarded by the server.</p>
      </div>

      <div class="flex items-center gap-2">
        <UBadge :color="connected ? 'success' : 'warning'" :variant="connected ? 'subtle' : 'outline'">
          {{ connected ? "Connected" : "Disconnected" }}
        </UBadge>
        <UBadge v-if="hasData" color="neutral" variant="outline">
          {{ topLevelKeys }} sections
        </UBadge>
      </div>
    </div>

    <div
      v-if="hasData"
      class="gsi-viewer-shell min-h-0 flex-1 overflow-hidden rounded-lg border border-default/40 bg-elevated/20 shadow-sm"
    >
      <JsonViewer
        v-model:data="gsi.data"
        :theme="colorMode === 'dark' ? 'dark' : 'light'"
        :editable="false"
        default-mode="tree"
        :max-depth="8"
        :hide-footer="true"
        :hide-edit-controls="true"
        :hide-search-button="true"
        :hide-copy-button="true"
        :hide-download-button="true"
        :hide-theme-button="true"
      />
    </div>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-default/40 bg-elevated/20 text-center"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/50">
        <UIcon name="i-lucide-radio" class="h-5 w-5 text-muted" />
      </div>
      <p class="mt-3 text-sm font-medium text-muted">No GSI data received yet.</p>
      <p class="mt-1 text-xs text-dimmed">Start CS2 with ZhenHai GSI enabled to see live data here.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gsi-viewer-shell {
  :deep(.json-viewer) {
    border: 0;
    box-shadow: none;
  }

  :deep(.menu-bar),
  :deep(.search-bar) {
    background: transparent;
    border-color: var(--border-default);
  }

  :deep(.view-area) {
    background: transparent;
  }
}
</style>
