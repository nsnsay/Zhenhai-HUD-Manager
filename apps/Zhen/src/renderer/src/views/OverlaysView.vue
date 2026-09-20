<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref } from "vue";
import OverlayActiveCard from "@renderer/components/overlays/OverlayActiveCard.vue";
import OverlayDevPanel from "@renderer/components/overlays/OverlayDevPanel.vue";
import OverlayEmptyState from "@renderer/components/overlays/OverlayEmptyState.vue";
import OverlayImportDialog from "@renderer/components/overlays/OverlayImportDialog.vue";
import OverlayList from "@renderer/components/overlays/OverlayList.vue";
import OverlaySettingsModal from "@renderer/components/overlays/OverlaySettingsModal.vue";
import { rendererLogger } from "@renderer/utils/logger";
import { useOverlaysStore } from "@renderer/stores/useOverlaysStore";
import type { DevOverlayInput, OverlayEntry, OverlayErrorCode } from "../../../shared/ipc";

const { t } = useI18n();
const toast = useToast();
const overlays = useOverlaysStore();

const showImportDialog = ref(false);
const settingsTarget = ref<string | null>(null);

const settingsOpen = computed({
  get: () => settingsTarget.value !== null,
  set: (value: boolean) => {
    if (!value) settingsTarget.value = null;
  },
});

function handleOpenSettings(overlayId: string): void {
  settingsTarget.value = overlayId;
}
const removeTarget = ref<OverlayEntry | null>(null);

const removeDialogOpen = computed({
  get: () => removeTarget.value !== null,
  set: (value: boolean) => {
    if (!value) {
      removeTarget.value = null;
    }
  },
});

const removeDialogBody = computed(() =>
  t("overlays.removeBody", { name: removeTarget.value?.name ?? "" }),
);

const showSkeleton = computed(() => overlays.isLoading && overlays.entries.length === 0);


function messageForError(code: string | null): string {
  switch (code as OverlayErrorCode | null) {
    case "zip_unsafe_entry":
      return t("overlays.errorZipUnsafe");
    case "zip_symlink":
      return t("overlays.errorZipSymlink");
    case "zip_too_many_entries":
      return t("overlays.errorZipTooMany");
    case "zip_too_large":
      return t("overlays.errorZipTooLarge");
    case "zip_no_index_html":
      return t("overlays.errorZipNoIndex");
    case "overlay_not_found":
      return t("overlays.errorNotFound");
    case "overlay_delete_failed":
      return t("overlays.errorDeleteFailed");
    case "dev_url_invalid":
      return t("overlays.errorDevUrl");
    case "dev_route_invalid":
      return t("overlays.errorDevRoute");
    case "dev_disabled":
      return t("overlays.errorDevDisabled");
    default:
      return t("overlays.errorZipFailed");
  }
}

function showErrorToast(code: string | null): void {
  toast.add({
    title: t("overlays.importFailedTitle"),
    description: messageForError(code),
    color: "error",
    icon: "i-lucide-alert-triangle",
  });
}

async function handleCopy(url: string): Promise<void> {
  if (!url) {
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      title: t("overlays.copiedUrl"),
      description: url,
      icon: "i-lucide-clipboard-check",
    });
  } catch (error) {
    rendererLogger.warn("OverlaysView", "Copy address failed", error);
    toast.add({
      title: t("overlays.copyFailed"),
      description: url,
      color: "error",
      icon: "i-lucide-alert-triangle",
    });
  }
}

async function handleConfirmImport(): Promise<void> {
  const entry = await overlays.importZip();
  showImportDialog.value = false;

  if (!entry) {
    showErrorToast(overlays.errorCode);
    return;
  }

  rendererLogger.info("OverlaysView", "Overlay imported", { overlayId: entry.overlayId });

  toast.add({
    title: t("overlays.importedTitle"),
    description: t("overlays.importedBody", { name: entry.name }),
    icon: "i-lucide-check",
  });
}

async function handleSelect(overlayId: string): Promise<void> {
  if (!(await overlays.select(overlayId))) {
    showErrorToast(overlays.errorCode);
    return;
  }

  toast.add({
    title: t("overlays.selectedTitle"),
    description: t("overlays.selectedBody", { name: overlays.selectedEntry?.name ?? overlayId }),
    icon: "i-lucide-layers",
  });
}

async function handleOpen(): Promise<void> {
  const opened = await overlays.openOverlay();

  if (!opened) {
    showErrorToast(overlays.errorCode);
  }
}

async function handleReload(): Promise<void> {
  await overlays.reload();
}

async function handleReveal(overlayId: string): Promise<void> {
  const revealed = await overlays.reveal(overlayId);

  if (!revealed) {
    toast.add({
      title: t("overlays.removeFailedTitle"),
      description: t("overlays.errorReveal"),
      color: "error",
      icon: "i-lucide-alert-triangle",
    });
  }
}

function requestRemove(overlayId: string): void {
  removeTarget.value = overlays.entries.find((entry) => entry.overlayId === overlayId) ?? null;
}

async function confirmRemove(): Promise<void> {
  const target = removeTarget.value;

  if (!target) {
    return;
  }

  const removed =
    target.source === "dev"
      ? await overlays.removeDevEntry(target.overlayId)
      : await overlays.remove(target.overlayId);

  removeTarget.value = null;

  if (!removed) {
    toast.add({
      title: t("overlays.removeFailedTitle"),
      description: messageForError(overlays.errorCode),
      color: "error",
      icon: "i-lucide-x-circle",
    });
    return;
  }

  toast.add({
    title: t("overlays.removedTitle"),
    description: t("overlays.removedBody", { name: target.name }),
    icon: "i-lucide-trash-2",
  });
}

async function handleAddDev(input: DevOverlayInput): Promise<void> {
  const entry = await overlays.addDevEntry(input);

  if (!entry) {
    showErrorToast(overlays.errorCode);
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold leading-6">{{ t("overlays.title") }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t("overlays.subtitle") }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :label="t('overlays.reloadOverlay')"
          icon="i-lucide-refresh-cw"
          size="sm"
          color="neutral"
          variant="subtle"
          :disabled="!overlays.isOpen"
          :title="overlays.isOpen ? undefined : t('overlays.windowClosed')"
          @click="handleReload"
        />
        <UButton
          :label="t('overlays.openOverlay')"
          icon="i-lucide-monitor-play"
          size="sm"
          color="neutral"
          variant="subtle"
          @click="handleOpen"
        />
        <UButton
          :label="t('overlays.importZip')"
          icon="i-lucide-file-archive"
          size="sm"
          color="primary"
          :loading="overlays.isImporting"
          @click="showImportDialog = true"
        />
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 scrollbar-none">
      <OverlayActiveCard
        :entry="overlays.selectedEntry"
        :is-open="overlays.isOpen"
        @copy="handleCopy"
      />

      <div v-if="showSkeleton" class="mt-4 flex flex-col gap-2" aria-hidden="true">
        <div
          v-for="index in 3"
          :key="index"
          class="h-12 animate-pulse rounded-lg border border-default/40 bg-elevated/25"
        />
      </div>

      <template v-else>
        <section class="mt-4 flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ t("overlays.builtinSection") }}</h3>
          <p class="text-xs text-dimmed">{{ t("overlays.builtinHint") }}</p>
          <OverlayList
            :entries="overlays.builtins"
            :selected-id="overlays.selectedId"
            @select="handleSelect"
            @reveal="handleReveal"
            @remove="requestRemove"
            @settings="handleOpenSettings"
          />
        </section>

        <section class="mt-4 flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ t("overlays.importedSection") }}</h3>
          <p class="text-xs text-dimmed">{{ t("overlays.importedHint") }}</p>
          <OverlayList
            v-if="overlays.imported.length"
            :entries="overlays.imported"
            :selected-id="overlays.selectedId"
            removable
            @select="handleSelect"
            @reveal="handleReveal"
            @remove="requestRemove"
            @settings="handleOpenSettings"
          />
          <OverlayEmptyState
            v-else
            :title="t('overlays.emptyImportedTitle')"
            :body="t('overlays.emptyImportedBody')"
          >
            <UButton
              :label="t('overlays.importZip')"
              icon="i-lucide-file-archive"
              size="sm"
              color="primary"
              variant="subtle"
              @click="showImportDialog = true"
            />
          </OverlayEmptyState>
        </section>

        <section v-if="overlays.isDev" class="mt-4 flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ t("overlays.devSection") }}</h3>
          <OverlayDevPanel
            :entries="overlays.devEntries"
            :selected-id="overlays.selectedId"
            @add="handleAddDev"
            @select="handleSelect"
            @remove="requestRemove"
            @reveal="handleReveal"
          />
        </section>
      </template>

      <p class="mt-4 text-xs text-dimmed">{{ t("overlays.contractHint") }}</p>
      <p class="mt-1 text-xs text-dimmed">{{ t("overlays.networkNotice") }}</p>
    </div>

    <OverlayImportDialog
      v-model:open="showImportDialog"
      :importing="overlays.isImporting"
      @confirm="handleConfirmImport"
    />

    <UModal
      v-model:open="removeDialogOpen"
      :title="t('overlays.removeTitle')"
      :description="removeDialogBody"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton :label="t('common.cancel')" color="neutral" variant="outline" @click="close" />
        <UButton :label="t('overlays.remove')" color="error" @click="confirmRemove" />
      </template>
    </UModal>
    <OverlaySettingsModal v-model:open="settingsOpen" :overlay-id="settingsTarget ?? ''" />
  </div>
</template>