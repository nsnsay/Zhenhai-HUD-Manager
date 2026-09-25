<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useColorMode, useEventListener } from "@vueuse/core";
import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { usePlayersStore } from "@renderer/stores/usePlayersStore";
import { useTeamsStore } from "@renderer/stores/useTeamsStore";
import { useMatchsStore } from "@renderer/stores/useMatchsStore";
import { useTournamentsStore, type TournamentRecord } from "@renderer/stores/useTournamentsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import TournamentModal from "@renderer/components/TournamentModal.vue";
import { useGsiStore } from "@zhenhai/csgogsi/gsi-vue";
import SettingsModal from "@renderer/components/SettingsModal.vue";
import { rendererLogger } from "@renderer/utils/logger";
import { useUpdaterStore } from "@renderer/stores/useUpdaterStore";
import { useOverlaysStore } from "@renderer/stores/useOverlaysStore";
import UpdateProgressCard from "@renderer/components/UpdateProgressCard.vue";
import type { NativeThemeSource } from "../../../shared/ipc";

const { t } = useI18n();
const currentTournament = useCurrentTournament();
const gsi = useGsiStore();
const toast = useToast();
const colorMode = useColorMode();
const tournamentsStore = useTournamentsStore();
const teamsStore = useTeamsStore();
const playersStore = usePlayersStore();
const matchsStore = useMatchsStore();

function syncNativeTheme(theme: NativeThemeSource): void {
  void window.api.setThemeSource(theme);
}

onMounted(() => {
  gsi.connect();
  syncNativeTheme(
    colorMode.value === "dark" ? "dark" : colorMode.value === "light" ? "light" : "system",
  );
});
onUnmounted(() => {
  gsi.disconnect();
});

const overlays = useOverlaysStore();

const updater = useUpdaterStore();
let updatePromptId: string | number | null = null;

function dismissUpdatePrompt(): void {
  if (updatePromptId !== null) {
    toast.remove(updatePromptId);
    updatePromptId = null;
  }
}

/**
 * 更新状态由 useUpdaterStore 统一维护（IPC 只订阅一次），
 * 这里只负责把状态变化映射成常驻提示；下载进度由 UpdateProgressCard 展示。
 */
watch(
  () => updater.status,
  (status) => {
    if (status === "available") {
      dismissUpdatePrompt();

      const toastItem = toast.add({
        title: "Update Available",
        description: `Version ${updater.version ?? "latest"} is ready to download.`,
        icon: "i-lucide-download-cloud",
        color: "primary",
        duration: 0,
        actions: [
          {
            label: "Download",
            color: "primary",
            onClick: () => {
              dismissUpdatePrompt();
              void updater.downloadUpdate();
            },
          },
          {
            label: "Later",
            color: "neutral",
            variant: "outline",
            onClick: dismissUpdatePrompt,
          },
        ],
      });

      updatePromptId = toastItem.id;
      return;
    }

    if (status === "downloading") {
      dismissUpdatePrompt();
      return;
    }

    if (status === "downloaded") {
      dismissUpdatePrompt();

      const toastItem = toast.add({
        title: "Update Ready",
        description: `Version ${updater.version ?? "latest"} has been downloaded.`,
        icon: "i-lucide-refresh-cw",
        color: "success",
        duration: 0,
        actions: [
          {
            label: "Restart & Install",
            color: "primary",
            onClick: () => {
              dismissUpdatePrompt();
              void updater.installUpdate();
            },
          },
        ],
      });

      updatePromptId = toastItem.id;
    }
  },
);

async function handleMinimize() {
  await window.api.windowMinimize();
}
async function handleMaximize() {
  await window.api.windowMaximize();
}
async function handleClose() {
  await window.api.windowClose();
}

onMounted(() => {
  updater.init();
});

onUnmounted(() => {
  updater.dispose();
});

/**
 * 侧边栏 Overlay 按钮：状态直接取应用级 store 的 isOpen。
 *
 * store 在 App.vue 启动时已 refresh 过真实状态，之后创建/显示/隐藏/关闭都由主进程推送，
 * 因此按钮与 Overlay 窗口始终一致（不再依赖「只收到事件才更新」的本地 ref）。
 */
async function handleToggleOverlay() {
  if (overlays.isOpen) {
    await window.api.overlayClose();
    rendererLogger.info("AppView", "Overlay close requested");
    toast.add({
      title: t("app.overlayStatusTitle"),
      description: t("app.overlayClosing"),
      icon: "i-lucide-send-to-back",
      duration: 1500,
      color: "neutral",
    });
  } else {
    await overlays.openOverlay();
    rendererLogger.info("AppView", "Overlay create requested");
    toast.add({
      title: t("app.overlayStatusTitle"),
      description: t("app.overlayOpening"),
      icon: "i-lucide-send-to-back",
      duration: 1500,
    });
  }
}

const showTournamentModal = ref(false);

const selectedTeam = computed(() => {
  const item = currentTournament.tournamentItems.find(
    (t) => t.value === currentTournament.currentId,
  );
  return item ?? { label: t("app.noTournament"), value: "" };
});

const teamsItems = computed<DropdownMenuItem[][]>(() => [
  currentTournament.tournamentItems.map((item, index) => ({
    label: item.label,
    avatar: item.avatar,
    icon: item.avatar ? undefined : "i-lucide-trophy",
    children: [
      {
        label: t("app.select"),
        icon: "i-lucide-check",
        kbds: ["meta", String(index + 1)],
        onSelect() {
          currentTournament.setCurrent(item.value);
        },
      },
      {
        label: t("common.edit"),
        icon: "i-lucide-pencil",
        onSelect() {
          handleEditTournament(item.value);
        },
      },
      {
        label: t("common.delete"),
        icon: "i-lucide-trash-2",
        class: "text-error",
        onSelect() {
          requestDeleteTournament(item.value);
        },
      },
    ],
  })),
  [
    {
      label: t("app.createTournament"),
      icon: "i-lucide-circle-plus",
      onSelect() {
        openCreateTournament();
      },
    },
  ],
]);

defineShortcuts(extractShortcuts(teamsItems.value));

const sidebarState = ref<"collapsed" | "expanded">("expanded");

const menuItems = computed<NavigationMenuItem[]>(() => {
  const isExpanded = sidebarState.value === "expanded";

  const items: NavigationMenuItem[] = [
    {
      label: t("nav.database"),
      icon: "i-lucide-database",
      defaultOpen: true,
      path: "/",
      to: "/",
      children: isExpanded
        ? [
            { label: t("nav.matchs"), icon: "i-lucide-trophy", to: "/matchs" },
            { label: t("nav.teams"), icon: "i-lucide-users", to: "/teams" },
            { label: t("nav.players"), icon: "i-lucide-circle-user-round", to: "/players" },
          ]
        : undefined,
    },
    {
      label: t("nav.overlays"),
      icon: "i-lucide-layers",
      path: "/overlays",
      to: "/overlays",
    },
    {
      label: t("nav.toolbox"),
      icon: "i-lucide-square-dot",
      defaultOpen: true,
      path: "/toolbox",
      to: "/toolbox",
      children: isExpanded
        ? [
            { label: t("nav.gsi"), icon: "i-lucide-binary", to: "/toolbox/gsi" },
            {
              label: t("nav.commandsLinks"),
              icon: "i-lucide-link-2",
              to: "/toolbox/commands-links",
            },
            { label: t("nav.logs"), icon: "i-lucide-scroll-text", to: "/toolbox/logs" },
          ]
        : undefined,
    },
  ];

  return items;
});

const user = ref({
  name: "镇海塔",
  avatar: { src: "https://github.com/nsnsay.png", alt: "nsnsay" },
});

const showSettingsModal = ref(false);

/**
 * Ctrl/Cmd + , 打开设置 —— Apple 的标准设置快捷键在 Electron 里的等价物。
 * 外观已经并进设置面板的「通用」页，这里不再保留第二份入口与那个没有处理函数的 Log out。
 */
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.key === "," && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    showSettingsModal.value = true;
  }
});

const userItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t("settings.title"),
      icon: "i-lucide-settings",
      kbds: ["ctrl", ","],
      onSelect() {
        showSettingsModal.value = true;
      },
    },
  ],
]);

const tournamentModalRef = ref<InstanceType<typeof TournamentModal>>();

const deleteTournamentTarget = ref<TournamentRecord | null>(null);

const deleteTournamentCounts = computed(() => {
  const targetId = deleteTournamentTarget.value?.id;

  if (!targetId) {
    return { matches: 0, teams: 0, players: 0 };
  }

  return {
    matches: matchsStore.items.filter((match) => match.tournamentId === targetId).length,
    teams: teamsStore.items.filter((team) => team.tournamentId === targetId).length,
    players: playersStore.items.filter((player) => player.tournamentId === targetId).length,
  };
});

const showDeleteTournamentConfirm = computed({
  get: () => !!deleteTournamentTarget.value,
  set: (val) => {
    if (!val) deleteTournamentTarget.value = null;
  },
});

function openCreateTournament() {
  showTournamentModal.value = true;
}

function handleEditTournament(tournamentId: string) {
  const tournament = tournamentsStore.getById(tournamentId);

  if (tournament) {
    tournamentModalRef.value?.openEdit(tournament);
  }
}

function requestDeleteTournament(tournamentId: string) {
  const tournament = tournamentsStore.getById(tournamentId);

  deleteTournamentTarget.value = tournament ?? {
    id: tournamentId,
    createdAt: "",
    updatedAt: "",
    tournamentName: "this tournament",
    tournamentLogo: "",
    tournamentDescription: "",
  };
}

async function confirmDeleteTournament() {
  const target = deleteTournamentTarget.value;

  if (!target) return;

  const wasCurrentTournament = currentTournament.currentId === target.id;
  const relatedMatchs = matchsStore.items.filter((match) => match.tournamentId === target.id);
  const relatedTeams = teamsStore.items.filter((team) => team.tournamentId === target.id);
  const relatedPlayers = playersStore.items.filter((player) => player.tournamentId === target.id);

  const childDeletions = [
    ...relatedMatchs.map((match) => () => matchsStore.remove(match.id)),
    ...relatedTeams.map((team) => () => teamsStore.remove(team.id)),
    ...relatedPlayers.map((player) => () => playersStore.remove(player.id)),
  ];

  for (const removeChild of childDeletions) {
    const childResult = await removeChild();

    if (!childResult.success) {
      toast.add({
        title: "Delete Failed",
        description: childResult.error ?? "Unable to delete related tournament data.",
        icon: "i-lucide-x-circle",
        color: "error",
      });
      deleteTournamentTarget.value = null;
      return;
    }
  }

  const result = await tournamentsStore.remove(target.id);

  if (result.success) {
    rendererLogger.info("AppView", "Tournament deleted", {
      tournamentId: target.id,
      matches: relatedMatchs.length,
      teams: relatedTeams.length,
      players: relatedPlayers.length,
    });

    toast.add({
      title: "Tournament Deleted",
      description: `"${target.tournamentName}" has been deleted.`,
      icon: "i-lucide-trash-2",
    });

    if (wasCurrentTournament) {
      const nextTournament = tournamentsStore.items[0];
      currentTournament.setCurrent(nextTournament?.id ?? "");
    }
  } else {
    toast.add({
      title: "Delete Failed",
      description: result.error ?? "Unknown error",
      icon: "i-lucide-x-circle",
      color: "error",
    });
  }

  deleteTournamentTarget.value = null;
}
</script>

<template>
  <div class="flex flex-1 w-full h-full">
    <USidebar
      collapsible="icon"
      rail
      :ui="{
        container: 'h-full',
        inner: 'bg-elevated/25 divide-transparent',
        body: 'py-0',
      }"
    >
      <template #header>
        <img src="../assets/icon.png" class="h-8 w-auto" />
        <div
          class="absolute top-0 left-0 right-0 h-(--ui-header-height)"
          style="-webkit-app-region: drag"
        />
      </template>

      <template #default="{ state }">
        <component
          :is="
            () => {
              sidebarState = state;
              return null;
            }
          "
        />

        <UNavigationMenu
          :key="state"
          :items="menuItems"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />

        <UButton
          class="relative mt-auto flex justify-center items-center cursor-pointer"
          color="neutral"
          :class="[
            {
              'bg-linear-to-r from-sky-300 to-sky-700 transition duration-800':
                overlays.isOpen,
            },
          ]"
          icon="i-lucide-send-to-back"
          @click="handleToggleOverlay()"
          variant="subtle"
        >
          <div v-if="sidebarState === 'expanded'">Overlay</div>
        </UButton>
      </template>

      <template #footer>
        <UDropdownMenu
          :items="userItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            v-bind="user"
            :label="user?.name"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            square
            class="w-full data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
          />
        </UDropdownMenu>
      </template>
    </USidebar>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col relative">
      <div
        class="relative h-(--ui-header-height) shrink-0 flex items-center gap-1 px-3 border-b border-default"
      >
        <UDropdownMenu
          :items="teamsItems"
          :content="{ align: 'start', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            v-bind="selectedTeam"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            square
            class="w-48 data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
          />
        </UDropdownMenu>
        <div class="absolute top-3 left-60 right-30 bottom-0" style="-webkit-app-region: drag" />
        <div class="flex ml-auto z-100001 fixed right-3">
          <UButton
            @click="handleMinimize()"
            icon="i-lucide-minus"
            size="lg"
            color="secondary"
            variant="ghost"
          />
          <UButton
            @click="handleMaximize()"
            icon="i-lucide-maximize-2"
            size="lg"
            color="primary"
            variant="ghost"
          />
          <UButton
            @click="handleClose()"
            icon="i-lucide-x"
            size="lg"
            color="error"
            variant="ghost"
          />
        </div>
      </div>
      <div class="absolute top-0 left-0 right-0 h-3.25" style="-webkit-app-region: drag" />
      <div class="flex-1 w-full min-h-0 relative overflow-hidden">
        <div class="absolute inset-0 overflow-auto p-4 scrollbar">
          <router-view v-slot="{ Component }">
            <Transition name="route" mode="out-in" appear>
              <keep-alive>
                <component :is="Component" />
              </keep-alive>
            </Transition>
          </router-view>
        </div>
      </div>
    </div>
  </div>

  <TournamentModal ref="tournamentModalRef" v-model:open="showTournamentModal" />
  <SettingsModal v-model:open="showSettingsModal" />

  <UModal
    v-model:open="showDeleteTournamentConfirm"
    title="Confirm Deletion"
    :description="`Delete tournament ${deleteTournamentTarget?.tournamentName}? This will also remove ${deleteTournamentCounts.matches} matches, ${deleteTournamentCounts.teams} teams, and ${deleteTournamentCounts.players} players. This action cannot be undone.`"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton label="Delete" color="error" @click="confirmDeleteTournament" />
    </template>
  </UModal>

  <UpdateProgressCard floating />
</template>

<style scoped>
:global(:root) {
  --route-fade-dur: 200ms;
  --route-fade-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.route-enter-active,
.route-leave-active {
  transition: opacity var(--route-fade-dur) var(--route-fade-ease);
  will-change: opacity;
}

.route-enter-from {
  opacity: 0;
}

.route-leave-to {
  opacity: 0;
}

.scrollbar {
  scrollbar-width: none;
}

@media (prefers-reduced-motion: reduce) {
  .route-enter-active,
  .route-leave-active {
    transition: opacity 160ms ease;
    will-change: auto;
  }

  .route-enter-from,
  .route-leave-to {
    opacity: 0;
  }
}
</style>
