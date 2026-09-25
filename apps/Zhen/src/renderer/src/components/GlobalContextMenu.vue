<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { DropdownMenuItem } from "@nuxt/ui";
import { useContextMenuStore } from "@renderer/stores/context-menu.store";
import SettingsModal from "@renderer/components/SettingsModal.vue";

const { t } = useI18n();
const contextMenuStore = useContextMenuStore();
const toast = useToast();
const showSettingsModal = ref(false);

function handleCopy() {
  const ok = document.execCommand("copy");
  if (!ok) {
    toast.add({ title: t("common.copyFailed"), icon: "i-lucide-alert-triangle", color: "warning" });
  }
}

function handleCut() {
  const ok = document.execCommand("cut");
  if (!ok) {
    toast.add({ title: t("common.cutFailed"), icon: "i-lucide-alert-triangle", color: "warning" });
  }
}

function handleSelectAll() {
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
    (active as HTMLInputElement).select();
  } else {
    document.execCommand("selectAll");
  }
}

function handleOpenMainDevTools() {
  window.api.mainWindowDevtoolsToggle();
}

function handleOpenOverlayDevTools() {
  window.api.overlayDevtoolsToggle();
}

function handleOpenSettings() {
  showSettingsModal.value = true;
}

const items = computed<DropdownMenuItem[][]>(() => {
  const base: DropdownMenuItem[][] = [
    [
      { label: t("common.copy"), icon: "i-lucide-copy", kbds: ["meta", "C"], onSelect: handleCopy },
      { label: t("common.cut"), icon: "i-lucide-scissors", kbds: ["meta", "X"], onSelect: handleCut },
      {
        label: t("common.selectAll"),
        icon: "i-lucide-square-mouse-pointer",
        kbds: ["meta", "A"],
        onSelect: handleSelectAll,
      },
    ],
  ];

  const target = contextMenuStore.target;
  if (target) {
    const ctxGroup: DropdownMenuItem[] = [];
    if (target.edit) {
      ctxGroup.push({
        label: t("common.editEntity", { entity: target.label }),
        icon: "i-lucide-pencil",
        onSelect: () => target.edit?.(),
      });
    }
    if (target.delete) {
      ctxGroup.push({
        label: t("common.deleteEntity", { entity: target.label }),
        icon: "i-lucide-trash-2",
        color: "error",
        onSelect: () => target.delete?.(),
      });
    }
    if (ctxGroup.length > 0) base.push(ctxGroup);
  }

  base.push([
    { label: t("settings.title"), icon: "i-lucide-settings", onSelect: handleOpenSettings },
    { label: t("common.devtools"), icon: "i-lucide-code", onSelect: handleOpenMainDevTools },
    { label: t("common.overlayDevtools"), icon: "i-lucide-code", onSelect: handleOpenOverlayDevTools },
  ]);

  return base;
});
</script>

<template>
  <UContextMenu :items="items" :ui="{ content: 'w-52 z-10 bg-default/70 backdrop-blur-md' }">
    <div class="w-full h-full" @contextmenu.capture="contextMenuStore.clearContext()">
      <slot />
    </div>
  </UContextMenu>

  <SettingsModal v-model:open="showSettingsModal" />
</template>
