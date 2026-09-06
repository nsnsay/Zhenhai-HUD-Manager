<script setup lang="ts">
import { computed, ref } from "vue";
import type { DropdownMenuItem } from "@nuxt/ui";
import { useContextMenuStore } from "@renderer/stores/context-menu.store";
import SettingsModal from "@renderer/components/SettingsModal.vue";

const contextMenuStore = useContextMenuStore();
const toast = useToast();
const showSettingsModal = ref(false);

async function handleCopy() {
  const ok = document.execCommand("copy");
  if (!ok) toast.add({ title: "Copy Failed", icon: "i-lucide-alert-triangle", color: "warning" });
}

async function handleCut() {
  const ok = document.execCommand("cut");
  if (!ok) toast.add({ title: "Cut Failed", icon: "i-lucide-alert-triangle", color: "warning" });
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
      { label: "Copy", icon: "i-lucide-copy", kbds: ["meta", "C"], onSelect: handleCopy },
      { label: "Cut", icon: "i-lucide-scissors", kbds: ["meta", "X"], onSelect: handleCut },
      {
        label: "Select All",
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
        label: `Edit ${target.label}`,
        icon: "i-lucide-pencil",
        onSelect: () => target.edit?.(),
      });
    }
    if (target.delete) {
      ctxGroup.push({
        label: `Delete ${target.label}`,
        icon: "i-lucide-trash-2",
        color: "error",
        onSelect: () => target.delete?.(),
      });
    }
    if (ctxGroup.length > 0) base.push(ctxGroup);
  }

  base.push([
    { label: "Settings", icon: "i-lucide-settings", onSelect: handleOpenSettings },
    { label: "DevTools", icon: "i-lucide-code", onSelect: handleOpenMainDevTools },
    { label: "Overlay DevTools", icon: "i-lucide-code", onSelect: handleOpenOverlayDevTools },
  ]);

  return base;
});
</script>

<template>
  <UContextMenu :items="items" :ui="{ content: 'w-52 z-10' }">
    <div class="w-full h-full" @contextmenu.capture="contextMenuStore.clearContext()">
      <slot />
    </div>
  </UContextMenu>

  <SettingsModal v-model:open="showSettingsModal" />
</template>
