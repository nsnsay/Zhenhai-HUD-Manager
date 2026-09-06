<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useColorMode } from "@vueuse/core";
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
import type { NativeThemeSource, UpdaterEventPayload } from "../../../shared/ipc";

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

const overlayState = ref<string>("closed");

let unsubscribeUpdater: (() => void) | null = null;
let updatePromptId: string | number | null = null;

function dismissUpdatePrompt(): void {
  if (updatePromptId !== null) {
    toast.remove(updatePromptId);
    updatePromptId = null;
  }
}

function handleUpdaterEvent(event: UpdaterEventPayload): void {
  if (event.type === "available") {
    dismissUpdatePrompt();
    const toastItem = toast.add({
      title: "Update Available",
      description: `Version ${event.version ?? "latest"} is ready to download.`,
      icon: "i-lucide-download-cloud",
      color: "primary",
      duration: 0,
      actions: [
        {
          label: "Download",
          color: "primary",
          onClick: () => {
            dismissUpdatePrompt();
            void window.api.updater.downloadUpdate();
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
  }

  if (event.type === "downloaded") {
    dismissUpdatePrompt();
    const toastItem = toast.add({
      title: "Update Ready",
      description: `Version ${event.version ?? "latest"} has been downloaded.`,
      icon: "i-lucide-refresh-cw",
      color: "success",
      duration: 0,
      actions: [
        {
          label: "Restart & Install",
          color: "primary",
          onClick: () => {
            dismissUpdatePrompt();
            void window.api.updater.installUpdate();
          },
        },
      ],
    });
    updatePromptId = toastItem.id;
  }
}

async function handleMinimize() {
  await window.api.windowMinimize();
}
async function handleMaximize() {
  await window.api.windowMaximize();
}
async function handleClose() {
  await window.api.windowClose();
}

let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = window.api.onOverlayLifecycle((state) => {
    overlayState.value = state;
  });
  unsubscribeUpdater = window.api.updater.onEvent(handleUpdaterEvent);
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unsubscribeUpdater) {
    unsubscribeUpdater();
    unsubscribeUpdater = null;
  }
});

async function handleToggleOverlay() {
  if (overlayState.value === "shown") {
    await window.api.overlayClose();
    rendererLogger.info("AppView", "Overlay close requested");
    toast.add({
      title: "Overlay Status",
      description: "Closing Overlay...",
      icon: "i-lucide-send-to-back",
      duration: 1500,
      color: "neutral",
    });
  } else {
    await window.api.overlayCreate();
    rendererLogger.info("AppView", "Overlay create requested");
    toast.add({
      title: "Overlay Status",
      description: "Opening Overlay...",
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
  return item ?? { label: "No Tournament", value: "" };
});

const teamsItems = computed<DropdownMenuItem[][]>(() => [
  currentTournament.tournamentItems.map((item, index) => ({
    label: item.label,
    avatar: item.avatar,
    icon: item.avatar ? undefined : "i-lucide-trophy",
    children: [
      {
        label: "Select",
        icon: "i-lucide-check",
        kbds: ["meta", String(index + 1)],
        onSelect() {
          currentTournament.setCurrent(item.value);
        },
      },
      {
        label: "Edit",
        icon: "i-lucide-pencil",
        onSelect() {
          handleEditTournament(item.value);
        },
      },
      {
        label: "Delete",
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
      label: "Create tournament",
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
      label: "Database",
      icon: "i-lucide-database",
      defaultOpen: true,
      path: "/",
      to: "/",
      children: isExpanded
        ? [
            { label: "Matchs", icon: "i-lucide-trophy", to: "/matchs" },
            { label: "Teams", icon: "i-lucide-users", to: "/teams" },
            { label: "Players", icon: "i-lucide-circle-user-round", to: "/players" },
          ]
        : undefined,
    },
    {
      label: "Toolbox",
      icon: "i-lucide-square-dot",
      defaultOpen: true,
      path: "/toolbox",
      to: "/toolbox",
      children: isExpanded
        ? [
            { label: "GSI Data", icon: "i-lucide-binary", to: "/toolbox/gsi" },
            {
              label: "Commands & Links",
              icon: "i-lucide-link-2",
              to: "/toolbox/commands-links",
            },
            { label: "Logs", icon: "i-lucide-scroll-text", to: "/toolbox/logs" },
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

const userItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: "Settings",
      icon: "i-lucide-settings",
      onSelect() {
        showSettingsModal.value = true;
      },
    },
  ],
  [
    {
      label: "Appearance",
      icon: "i-lucide-sun-moon",
      children: [
        {
          label: "Light",
          icon: "i-lucide-sun",
          type: "checkbox",
          checked: colorMode.value === "light",
          onUpdateChecked(checked: boolean) {
            if (checked) {
              colorMode.value = "light";
              syncNativeTheme("light");
            }
          },
          onSelect(e: Event) {
            e.preventDefault();
          },
        },
        {
          label: "Dark",
          icon: "i-lucide-moon",
          type: "checkbox",
          checked: colorMode.value === "dark",
          onUpdateChecked(checked: boolean) {
            if (checked) {
              colorMode.value = "dark";
              syncNativeTheme("dark");
            }
          },
          onSelect(e: Event) {
            e.preventDefault();
          },
        },
      ],
    },
  ],
  [{ label: "Log out", icon: "i-lucide-log-out" }],
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
                overlayState === 'shown',
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
