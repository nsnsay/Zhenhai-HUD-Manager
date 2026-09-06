<script setup lang="ts">
import { ref, computed } from "vue";
import MatchModal from "./components/MatchModal.vue";
import { useMatchsStore, type MatchRecord } from "@renderer/stores/useMatchsStore";
import { useTeamsStore, type TeamRecord } from "@renderer/stores/useTeamsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import { storeToRefs } from "pinia";
import { useContextMenuStore } from "@renderer/stores/context-menu.store.js";
import { rendererLogger } from "@renderer/utils/logger";

const matchsStore = useMatchsStore();
const teamsStore = useTeamsStore();
const currentTournament = useCurrentTournament();
const toast = useToast();

const matchModalRef = ref<InstanceType<typeof MatchModal>>();

const { items: matchItems } = storeToRefs(matchsStore);
const { items: teamItems } = storeToRefs(teamsStore);
const { currentId } = storeToRefs(currentTournament);

const viewMode = ref<"card" | "table">(
  (localStorage.getItem("zh-match-view-mode") as "card" | "table") || "table",
);

function setViewMode(mode: "card" | "table") {
  viewMode.value = mode;
  localStorage.setItem("zh-match-view-mode", mode);
}

const filteredMatchs = computed(() =>
  matchItems.value.filter((match) => match.tournamentId === currentId.value),
);

function getTeamName(teamId: string): string {
  const team = teamItems.value.find((t) => t.id === teamId);
  return team?.teamName ?? teamId?.slice(0, 8) ?? "Unknown";
}

function getTeamLogo(teamId: string): string {
  const team = teamItems.value.find((t) => t.id === teamId);
  const logo = (team as TeamRecord | undefined)?.teamLogo;
  return logo ? getAssetUrl(logo) : "";
}

const columns = [
  { id: "teamA", header: "Team A" },
  { id: "teamB", header: "Team B" },
  { accessorKey: "matchLength", header: "Best Of" },
  { accessorKey: "matchType", header: "Phase" },
  { accessorKey: "createdAt", header: "Created" },
  { id: "actions", header: "" },
];

const deleteTarget = ref<MatchRecord | null>(null);
const showDeleteConfirm = computed({
  get: () => !!deleteTarget.value,
  set: (val) => {
    if (!val) deleteTarget.value = null;
  },
});

function handleEdit(match: MatchRecord) {
  matchModalRef.value?.openEdit(match);
}

function requestDelete(match: MatchRecord) {
  deleteTarget.value = match;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const match = deleteTarget.value;
  const teamA = getTeamName(match.matchTeamA);
  const teamB = getTeamName(match.matchTeamB);

  const result = await matchsStore.remove(match.id);
  if (result.success) {
    rendererLogger.info("DatabaseMatchView", "Match deleted", { id: match.id });
    toast.add({
      title: "Match Deleted",
      description: `"${teamA} vs ${teamB}" has been deleted.`,
      icon: "i-lucide-trash-2",
    });
  } else {
    rendererLogger.error("DatabaseMatchView", "Match delete failed", {
      id: match.id,
      error: result.error,
    });
    toast.add({
      title: "Delete Failed",
      description: result.error ?? "Unknown error",
      icon: "i-lucide-x-circle",
      color: "error",
    });
  }
  deleteTarget.value = null;
}

async function handleToggleLive(match: MatchRecord) {
  const isCurrentlyLive = !!match.isLive;

  if (isCurrentlyLive) {
    await matchsStore.update(match.id, { isLive: false });
    rendererLogger.info("DatabaseMatchView", "Match live stopped", { id: match.id });
    toast.add({
      title: "Live Stopped",
      description: `${getTeamName(match.matchTeamA)} vs ${getTeamName(match.matchTeamB)} is no longer live.`,
      icon: "i-lucide-square",
    });
  } else {
    const liveMatchs = matchItems.value.filter(
      (m) => m.isLive === true && m.id !== match.id,
    );
    await Promise.all(liveMatchs.map((m) => matchsStore.update(m.id, { isLive: false })));
    await matchsStore.update(match.id, { isLive: true });
    rendererLogger.info("DatabaseMatchView", "Match live started", { id: match.id });
    toast.add({
      title: "Match is Live!",
      description: `${getTeamName(match.matchTeamA)} vs ${getTeamName(match.matchTeamB)} is now live.`,
      icon: "i-lucide-radio",
    });
  }
}

const contextMenuStore = useContextMenuStore();

function handleMatchContextMenu(match: MatchRecord) {
  contextMenuStore.setContext({
    label: "Match",
    edit: () => handleEdit(match),
    delete: () => requestDelete(match),
  });
}

</script>

<template>
  <div class="w-full h-full flex flex-col relative">
    <!-- Header -->
    <div class="w-full h-(--ui-components-header-height) flex flex-row items-end">
      <div class="flex-1">
        <div class="text-xl font-semibold leading-6">Matchs</div>
        <div class="text-[13px] leading-5 text-muted">Match Veto, Match Versus, Match Score</div>
      </div>
      <div class="flex items-center justify-end gap-2">
        <div class="rounded-lg bg-elevated/45 p-1 ring-1 ring-white/5 shadow-sm backdrop-blur-md" size="xs">
          <UButton size="md" icon="i-lucide-layout-grid" label="Card" :variant="viewMode === 'card' ? 'solid' : 'ghost'"
            :color="viewMode === 'card' ? 'primary' : 'neutral'" @click="setViewMode('card')" />
          <UButton size="md" icon="i-lucide-table" label="Table" :variant="viewMode === 'table' ? 'solid' : 'ghost'"
            :color="viewMode === 'table' ? 'primary' : 'neutral'" @click="setViewMode('table')" />
        </div>
        <MatchModal ref="matchModalRef" />
      </div>
    </div>

    <div class="flex-1 overflow-auto mt-4">
      <div v-if="filteredMatchs.length === 0"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/40 bg-elevated/20 py-16 text-muted backdrop-blur-md">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/45 ring-1 ring-white/5 mb-3">
          <UIcon name="i-lucide-swords" class="h-5 w-5" />
        </div>
        <span class="text-sm font-medium text-muted">No matches in this tournament yet.</span>
      </div>
      <div v-else-if="viewMode === 'card'" class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
        <div v-for="match in filteredMatchs" :key="match.id" @contextmenu="handleMatchContextMenu(match)"
          class="group relative min-w-0 overflow-hidden rounded-lg border bg-elevated/35 p-4 shadow-sm backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-lg"
          :class="match.isLive
            ? 'border-error/40 ring-1 ring-error/10 hover:border-error/60'
            : 'border-default/40 hover:border-default/70'
            ">
          <!-- Team A vs Team B -->
          <div class="flex flex-row items-center justify-between gap-2.5 mb-3 w-full">
            <div class="flex items-center gap-2.5">
              <UAvatar :src="getTeamLogo(match.matchTeamA)" size="xl"
                class="rounded-xl bg-zinc-800/80 ring-1 ring-white/10 p-1" />
              <span class="font-semibold text-[14px] truncate flex-1">
                {{ getTeamName(match.matchTeamA) }}
              </span>
            </div>
            <div class="flex items-center gap-2.5">
              <span class="font-semibold text-[14px] truncate flex-1">
                {{ getTeamName(match.matchTeamB) }}
              </span>
              <UAvatar :src="getTeamLogo(match.matchTeamB)" size="xl"
                class="rounded-xl bg-zinc-800/80 ring-1 ring-white/10 p-1" />
            </div>
          </div>

          <!-- Match Info -->
          <div class="flex items-center justify-between gap-2 text-[11px] text-muted mb-1">
            <UBadge :label="`BO${match.matchLength}`" color="neutral" variant="solid" size="md" />
            <UBadge :label="`${match.matchType}`" color="neutral" variant="solid" size="md" />
          </div>

          <USeparator class="my-3" label="Maps" />

          <div class="flex items-center justify-between gap-2 text-[13px] text-muted mb-1 flex-wrap">
            <template v-for="(map, index) in match.matchVeto" :key="index">
              <UBadge v-if="map.mapVetoType === 'pick' || map.mapVetoType === 'decider'" color="neutral"
                variant="outline" size="md" :label="map.mapName" />
            </template>
          </div>

          <!-- Actions -->
          <div
            class="absolute inset-x-0 bottom-0 flex items-center justify-end p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <div
              class="flex items-center gap-0.5 rounded-lg bg-elevated/75 p-1 ring-1 ring-white/5 shadow-sm backdrop-blur-md">
              <UButton :icon="match.isLive ? 'i-lucide-square' : 'i-lucide-play'" size="xs"
                :color="match.isLive ? 'error' : 'success'" :variant="match.isLive ? 'solid' : 'ghost'"
                @click="handleToggleLive(match)" aria-label="Toggle Live" />
              <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" @click="handleEdit(match)"
                aria-label="Edit" />
              <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" @click="requestDelete(match)"
                aria-label="Delete" />
            </div>
          </div>
        </div>
      </div>

      <div v-else
        class="min-h-0 overflow-hidden rounded-lg border border-default/40 bg-elevated/20 shadow-sm backdrop-blur-md">
        <UTable :data="filteredMatchs" :columns="columns" :ui="{
          wrapper: 'min-h-0',
          base: 'min-w-full',
          thead: 'bg-elevated/40 backdrop-blur-md',
          th: 'px-4 py-3 text-[11px] font-medium text-muted border-b border-default/40',
          td: 'px-4 py-3 text-sm border-b border-default/20 last:border-b-0',
          tr: 'group transition-colors duration-200 hover:bg-elevated/40 focus-within:bg-elevated/40',
          separator: 'z-0 opacity-0'
        }">
          <template #teamA-cell="{ row }">
            <div class="flex items-center gap-2">
              <UAvatar :src="getTeamLogo((row.original as MatchRecord).matchTeamA)" size="md" class="bg-zinc-700 p-1" />
              <span class="font-medium">{{ getTeamName((row.original as MatchRecord).matchTeamA) }}</span>
            </div>
          </template>
          <template #teamB-cell="{ row }">
            <div class="flex items-center gap-2">
              <UAvatar :src="getTeamLogo((row.original as MatchRecord).matchTeamB)" size="md" class="bg-zinc-700 p-1" />
              <span class="font-medium">{{ getTeamName((row.original as MatchRecord).matchTeamB) }}</span>
            </div>
          </template>
          <template #matchLength-cell="{ row }">
            <span>BO{{ (row.original as MatchRecord).matchLength }}</span>
          </template>
          <template #createdAt-cell="{ row }">
            <span class="text-muted text-xs">
              {{ new Date((row.original as MatchRecord).createdAt).toLocaleDateString() }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="group flex gap-1">
              <UButton :icon="(row.original as MatchRecord).isLive ? 'i-lucide-square' : 'i-lucide-play'" size="xs"
                :color="(row.original as MatchRecord).isLive ? 'error' : 'success'"
                :variant="(row.original as MatchRecord).isLive ? 'solid' : 'ghost'"
                @click="handleToggleLive(row.original as MatchRecord)" aria-label="Toggle Live" />
              <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost"
                @click="handleEdit(row.original)" aria-label="Edit" />
              <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost"
                @click="requestDelete(row.original)" aria-label="Delete" />
            </div>
          </template>
        </UTable>
      </div>
    </div>
    <UModal v-model:open="showDeleteConfirm" title="Confirm Deletion"
      :description="`Are you sure you want to delete the match ${getTeamName(deleteTarget?.matchTeamA ?? '')} vs ${getTeamName(deleteTarget?.matchTeamB ?? '')}? This action cannot be undone.`"
      :ui="{ footer: 'justify-end' }">
      <template #footer="{ close }">
        <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
        <UButton label="Delete" color="error" @click="confirmDelete" />
      </template>
    </UModal>
  </div>
</template>

<style scoped lang="scss">
@media (prefers-reduced-motion: reduce) {

  .group,
  .group * {
    transition: none !important;
    transform: none !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .group {
    backdrop-filter: none;
  }
}
</style>
