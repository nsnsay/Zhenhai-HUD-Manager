<script setup lang="ts">
import { ref, computed } from "vue";
import TeamModal from "./components/TeamModal.vue";
import { useTeamsStore, type TeamRecord } from "@renderer/stores/useTeamsStore";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import { storeToRefs } from "pinia";
import { usePlayersStore } from "@renderer/stores/usePlayersStore.js";
import { useContextMenuStore } from "@renderer/stores/context-menu.store";
import { rendererLogger } from "@renderer/utils/logger";

const contextMenuStore = useContextMenuStore();

const teamsStore = useTeamsStore();
const playersStore = usePlayersStore();
const currentTournament = useCurrentTournament();
const toast = useToast();

const teamModalRef = ref<InstanceType<typeof TeamModal>>();

const { items: teamItems } = storeToRefs(teamsStore);
const { items: playerItems } = storeToRefs(playersStore);
const { currentId } = storeToRefs(currentTournament);

function handleTeamContextMenu(team: TeamRecord) {
  contextMenuStore.setContext({
    label: "Team",
    edit: () => handleEdit(team),
    delete: () => requestDelete(team),
  });
}

const filteredTeams = computed(() =>
  teamItems.value.filter((team) => team.tournamentId === currentId.value),
);

function getPlayerById(playerId: string) {
  return playerItems.value.find((p) => p.id === playerId);
}

const deleteTarget = ref<TeamRecord | null>(null);
const showDeleteConfirm = computed({
  get: () => !!deleteTarget.value,
  set: (val) => {
    if (!val) deleteTarget.value = null;
  },
});

function handleEdit(team: TeamRecord) {
  teamModalRef.value?.openEdit(team);
}

function requestDelete(team: TeamRecord) {
  deleteTarget.value = team;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const team = deleteTarget.value;

  const result = await teamsStore.remove(team.id);
  if (result.success) {
    rendererLogger.info("DatabaseTeamView", "Team deleted", { id: team.id });
    toast.add({
      title: "Team Deleted",
      description: `"${team.teamName}" has been deleted.`,
      icon: "i-lucide-trash-2",
    });
  } else {
    rendererLogger.error("DatabaseTeamView", "Team delete failed", {
      id: team.id,
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
</script>

<template>
  <div class="w-full flex flex-col relative">
    <!-- Header -->
    <div class="w-full h-(--ui-components-header-height) flex flex-row">
      <div class="flex-1">
        <div class="text-xl font-semibold leading-6">Teams</div>
        <div class="text-[13px] leading-5 text-muted">Team Logo, Team Details, Team Statistics</div>
      </div>
      <div class="flex-1 flex items-end justify-end">
        <TeamModal ref="teamModalRef" />
      </div>
    </div>

    <!-- Teams Grid -->
    <div class="flex-1 overflow-auto mt-4">
      <div v-if="filteredTeams.length === 0"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/40 bg-elevated/20 py-16 text-muted backdrop-blur-md">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/45 ring-1 ring-white/5 mb-3">
          <UIcon name="i-lucide-users" class="h-5 w-5" />
        </div>
        <span class="text-sm font-medium text-muted">No teams in this tournament yet.</span>
      </div>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
        <div v-for="team in filteredTeams" :key="team.id" @contextmenu="handleTeamContextMenu(team)"
          class="group relative min-w-0 overflow-hidden rounded-lg border border-default/40 bg-elevated/35 p-4 shadow-sm backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-default/70 hover:shadow-lg">
          <!-- Team Header -->
          <div class="flex items-center gap-3 mb-3">
            <UAvatar class="rounded-lg bg-zinc-800/80 ring-1 ring-white/10 p-1" size="xl" v-if="team.teamLogo"
              :src="getAssetUrl(team.teamLogo)" />
            <div v-else
              class="h-12 w-12 rounded-lg bg-zinc-800/80 ring-1 ring-white/10 flex items-center justify-center">
              <UIcon name="i-lucide-users" class="text-muted" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold leading-5 truncate">{{ team.teamName }}</div>
              <div class="text-xs leading-5 text-muted truncate">{{ team.teamGameName }}</div>
            </div>

            <div
              class="flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
              <UButton @click="handleEdit(team)" icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" />
              <UButton @click="requestDelete(team)" icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" />
            </div>
          </div>

          <!-- Country Badge -->
          <div v-if="team.teamCountry" class="mb-3">
            <UBadge :label="team.teamCountry" color="neutral" variant="outline" size="sm" />
          </div>

          <!-- Divider -->
          <USeparator label="Players" class="my-2" />

          <!-- Players List -->
          <div class="space-y-1 mt-2">
            <template v-if="team.playerIds && team.playerIds.length > 0">
              <div v-for="playerId in team.playerIds" :key="playerId"
                class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 ring-1 ring-transparent transition-colors duration-200 hover:bg-elevated/60 hover:ring-white/5">
                <template v-if="getPlayerById(playerId)">
                  <UAvatar size="xs" :src="getAssetUrl(getPlayerById(playerId)?.playerAvatar || '')"
                    class="ring-1 ring-white/10" />
                  <span class="text-[13px] font-medium truncate">
                    {{ getPlayerById(playerId)?.playerName }}
                  </span>
                </template>
                <template v-else>
                  <div class="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center">
                    <UIcon name="i-lucide-user" class="text-muted text-[10px]" />
                  </div>
                  <span class="text-[12px] text-muted italic truncate">Unknown Player</span>
                </template>
              </div>
            </template>

            <div v-else class="rounded-lg bg-elevated/20 px-3 py-2 text-xs italic text-dimmed">No players assigned</div>
          </div>
        </div>
      </div>
    </div>

    <UModal v-model:open="showDeleteConfirm" title="Confirm Deletion"
      :description="`Are you sure you want to delete team ${deleteTarget?.teamName}? This action cannot be undone.`"
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
