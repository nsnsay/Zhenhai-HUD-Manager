<script setup lang="ts">
/**
 * 设置面板外壳：左侧分区 rail + 右侧内容。
 *
 * 这里只负责布局、分区状态与数据装载；每个分区的设置项在自己的 pane 组件里，
 * 通过 `useAppSettings()` 共享同一个「即时生效」控制器（provide/inject）。
 */
import { computed, provide, ref, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { provideAppSettings } from "@renderer/composables/useAppSettings";
import { rendererLogger } from "@renderer/utils/logger";
import SettingsPaneAbout from "./settings/SettingsPaneAbout.vue";
import SettingsPaneComponents from "./settings/SettingsPaneComponents.vue";
import SettingsPaneGeneral from "./settings/SettingsPaneGeneral.vue";
import SettingsPaneNetwork from "./settings/SettingsPaneNetwork.vue";
import SettingsPaneRadar from "./settings/SettingsPaneRadar.vue";
import SettingsPaneShortcuts from "./settings/SettingsPaneShortcuts.vue";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits(["update:open"]);
const { t } = useI18n();

const { isLoading, load } = provideAppSettings();

provide("closeSettings", () => emit("update:open", false));

type PaneId = "general" | "components" | "radar" | "shortcuts" | "network" | "about";

/** 记住上次看的分区（HIG settings.md：重新打开时回到上次的 pane）。 */
const PANE_STORAGE_KEY = "zh-settings-pane";

const panes = computed<Array<{ id: PaneId; label: string; icon: string }>>(() => [
  { id: "general", label: t("settings.paneGeneral"), icon: "i-lucide-sliders-horizontal" },
  { id: "components", label: t("settings.paneComponents"), icon: "i-lucide-layout-grid" },
  { id: "radar", label: t("settings.paneRadar"), icon: "i-lucide-radar" },
  { id: "shortcuts", label: t("settings.paneShortcuts"), icon: "i-lucide-keyboard" },
  { id: "network", label: t("settings.paneNetwork"), icon: "i-lucide-network" },
  { id: "about", label: t("settings.paneAbout"), icon: "i-lucide-info" },
]);

const paneComponents: Record<PaneId, Component> = {
  general: SettingsPaneGeneral,
  components: SettingsPaneComponents,
  radar: SettingsPaneRadar,
  shortcuts: SettingsPaneShortcuts,
  network: SettingsPaneNetwork,
  about: SettingsPaneAbout,
};

function readStoredPane(): PaneId {
  const stored = localStorage.getItem(PANE_STORAGE_KEY);

  return panes.value.some((pane) => pane.id === stored) ? (stored as PaneId) : "general";
}

const activePane = ref<PaneId>(readStoredPane());

const activePaneLabel = computed(
  () => panes.value.find((pane) => pane.id === activePane.value)?.label ?? "",
);

watch(activePane, (pane) => {
  localStorage.setItem(PANE_STORAGE_KEY, pane);
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;

    // 每次打开都重读一次：向导、Overlay 页也可能改过同一份设置
    void load();
    activePane.value = readStoredPane();
    rendererLogger.info("SettingsModal", "Opened", { pane: activePane.value });
  },
);
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="t('settings.title')"
    :description="activePaneLabel"
    :ui="{
      content: 'settings-panel max-w-[880px] rounded-2xl bg-default/70 backdrop-blur-md z-10',
      header: 'px-5 pt-4 pb-3 border-b border-default/60',
      body: 'p-0',
      footer: 'hidden',
    }"
  >
    <template #body>
      <div v-if="isLoading" class="flex h-[420px] items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin text-toned" />
      </div>

      <div v-else class="flex h-[420px]">
        <nav
          class="flex w-[200px] shrink-0 flex-col gap-0.5 border-r border-default p-2"
          :aria-label="t('settings.title')"
        >
          <button
            v-for="pane in panes"
            :key="pane.id"
            type="button"
            class="cursor-pointer flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
            :class="
              pane.id === activePane
                ? 'bg-accented font-semibold text-highlighted'
                : 'text-toned hover:bg-elevated'
            "
            :aria-current="pane.id === activePane ? 'true' : undefined"
            @click="activePane = pane.id"
          >
            <UIcon :name="pane.icon" class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ pane.label }}</span>
          </button>
        </nav>

        <div class="min-w-0 flex-1 overflow-y-auto p-5 scrollbar-none">
          <Transition name="settings-pane" mode="out-in">
            <component :is="paneComponents[activePane]" :key="activePane" />
          </Transition>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped lang="scss">
.settings-pane-enter-active,
.settings-pane-leave-active {
  transition:
    opacity 160ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.settings-pane-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.settings-pane-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .settings-pane-enter-active,
  .settings-pane-leave-active {
    transition: opacity 100ms ease;
    will-change: auto;
  }

  .settings-pane-enter-from,
  .settings-pane-leave-to {
    transform: none;
  }
}
</style>
