<script setup lang="ts">
import { ref, computed } from "vue";
import PlayerModal from "./components/PlayerModal.vue";
import { usePlayersStore, type PlayerRecord } from "@renderer/stores/usePlayersStore";
import { useContextMenuStore } from "@renderer/stores/context-menu.store";
import { useCurrentTournament } from "@renderer/stores/useCurrentTournament";
import { getAssetUrl } from "@renderer/utils/assets-url";
import { storeToRefs } from "pinia";
import type { TableColumn } from "@nuxt/ui";
import { rendererLogger } from "@renderer/utils/logger";

const playersStore = usePlayersStore();
const currentTournament = useCurrentTournament();
const contextMenuStore = useContextMenuStore();
const toast = useToast();

const playerModalRef = ref<InstanceType<typeof PlayerModal>>();

const { items: playerItems } = storeToRefs(playersStore);
const { currentId } = storeToRefs(currentTournament);

function handlePlayerContextMenu(player: PlayerRecord) {
  contextMenuStore.setContext({
    label: "Player",
    edit: () => handleEdit(player),
    delete: () => requestDelete(player),
  });
}

const filteredPlayers = computed(() =>
  playerItems.value.filter((player) => player.tournamentId === currentId.value),
);

const globalFilter = ref("");
const sorting = ref<any[]>([]);

const columns: TableColumn<PlayerRecord>[] = [
  {
    id: "playerAvatar",
    header: "",
    enableSorting: false,
    size: 60,
  },
  {
    accessorKey: "playerName",
    header: "Name",
    enableSorting: true,
  },
  {
    accessorKey: "playerRealName",
    header: "Real Name",
    enableSorting: true,
  },
  {
    accessorKey: "playerSteamID",
    header: "Steam ID",
    enableSorting: true,
  },
  {
    accessorKey: "playerCountry",
    header: "Country",
    enableSorting: true,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 100,
  },
];

function handleEdit(player: PlayerRecord) {
  playerModalRef.value?.openEdit(player);
}

const deleteTarget = ref<PlayerRecord | null>(null);
const showDeleteConfirm = computed({
  get: () => !!deleteTarget.value,
  set: (val) => {
    if (!val) deleteTarget.value = null;
  },
});

function requestDelete(player: PlayerRecord) {
  deleteTarget.value = player;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const player = deleteTarget.value;

  const result = await playersStore.remove(player.id);
  if (result.success) {
    rendererLogger.info("DatabasePlayerView", "Player deleted", { id: player.id });
    toast.add({
      title: "Player Deleted",
      description: `"${player.playerName}" has been deleted.`,
      icon: "i-lucide-trash-2",
    });
  } else {
    rendererLogger.error("DatabasePlayerView", "Player delete failed", {
      id: player.id,
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
  <div class="w-full flex flex-col relative h-full">
    <!-- Header -->
    <div class="w-full h-(--ui-components-header-height) flex flex-row items-end">
      <div class="flex-1">
        <div class="text-xl font-semibold leading-6">Players</div>
        <div class="text-[13px] leading-5 text-muted mt-1">
          Manage tournament players and rosters.
        </div>
      </div>
      <div class="flex items-end justify-end gap-3">
        <UInput
          v-model="globalFilter"
          icon="i-lucide-search"
          placeholder="Search players..."
          class="w-64"
          :ui="{ leadingIcon: 'text-muted' }"
        />
        <PlayerModal ref="playerModalRef" />
      </div>
    </div>

    <!-- Table Container -->
    <div
      class="flex-1 overflow-hidden mt-3 rounded-lg border border-default/40 bg-elevated/20 shadow-sm backdrop-blur-md"
    >
      <div
        v-if="filteredPlayers.length === 0"
        class="flex flex-col items-center justify-center h-full text-muted"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-full bg-elevated/45 ring-1 ring-white/5 mb-3"
        >
          <UIcon name="i-lucide-users" class="h-5 w-5 text-dimmed" />
        </div>
        <span class="text-sm font-medium">No players in this tournament yet.</span>
        <span class="text-xs text-dimmed mt-1">Click "Create Player" to add one.</span>
      </div>

      <UTable
        v-else
        v-model:sorting="sorting"
        v-model:global-filter="globalFilter"
        :data="filteredPlayers"
        :columns="columns"
        :ui="{
          wrapper: 'min-h-0',
          base: 'min-w-full',
          thead: 'bg-elevated/40 backdrop-blur-md',
          th: 'px-4 py-3 text-[11px] font-medium text-muted border-b border-default/40',
          td: 'px-4 py-3 text-sm border-b border-default/20 last:border-b-0',
          tr: 'group transition-colors duration-200 hover:bg-elevated/40 focus-within:bg-elevated/40',
          separator: 'z-0 opacity-0',
        }"
      >
        <!-- Name  -->
        <template #playerName-header="{ column }">
          <UButton
            color="neutral"
            variant="ghost"
            label="Name"
            size="xs"
            :icon="
              column.getIsSorted() === 'asc'
                ? 'i-lucide-arrow-up-narrow-wide'
                : column.getIsSorted() === 'desc'
                  ? 'i-lucide-arrow-down-wide-narrow'
                  : 'i-lucide-arrow-up-down'
            "
            class="-mx-2.5"
            @click="column.toggleSorting(column.getIsSorted() === 'asc')"
          />
        </template>

        <template #playerSteamID-header="{ column }">
          <UButton
            color="neutral"
            variant="ghost"
            label="Steam ID"
            size="xs"
            :icon="
              column.getIsSorted() === 'asc'
                ? 'i-lucide-arrow-up-narrow-wide'
                : column.getIsSorted() === 'desc'
                  ? 'i-lucide-arrow-down-wide-narrow'
                  : 'i-lucide-arrow-up-down'
            "
            class="-mx-2.5"
            @click="column.toggleSorting(column.getIsSorted() === 'asc')"
          />
        </template>

        <!-- Avatar Cell -->
        <template #playerAvatar-cell="{ row }">
          <UAvatar
            v-if="row.original.playerAvatar"
            :src="getAssetUrl(row.original.playerAvatar)"
            size="md"
            class="ring-1 ring-white/10 shadow-sm"
          />
          <div
            v-else
            class="h-9 w-9 rounded-full bg-elevated flex items-center justify-center ring-1 ring-white/10"
          >
            <UIcon name="i-lucide-user" class="h-4 w-4 text-muted" />
          </div>
        </template>

        <!-- Name Cell -->
        <template #playerName-cell="{ row }">
          <span
            @contextmenu="handlePlayerContextMenu(row.original)"
            class="font-semibold text-foreground"
            >{{ row.original.playerName }}</span
          >
        </template>

        <!-- Real Name Cell -->
        <template #playerRealName-cell="{ row }">
          <span class="text-muted">{{ row.original.playerRealName || "—" }}</span>
        </template>

        <!-- Steam ID Cell -->
        <template #playerSteamID-cell="{ row }">
          <span class="font-mono text-xs tabular-nums text-muted">{{
            row.original.playerSteamID || "—"
          }}</span>
        </template>

        <!-- Country Cell -->
        <template #playerCountry-cell="{ row }">
          <span class="text-sm">{{ row.original.playerCountry || "—" }}</span>
        </template>

        <!-- Actions Cell -->
        <template #actions-cell="{ row }">
          <div
            class="flex justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <UTooltip text="Edit">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="handleEdit(row.original)"
                aria-label="Edit"
              />
            </UTooltip>
            <UTooltip text="Delete">
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                @click="requestDelete(row.original)"
                aria-label="Delete"
              />
            </UTooltip>
          </div>
        </template>
      </UTable>
    </div>

    <!-- Delete Confirm Modal -->
    <UModal
      v-model:open="showDeleteConfirm"
      title="Confirm Deletion"
      :description="`Are you sure you want to delete player ${deleteTarget?.playerName}? This action cannot be undone.`"
      :ui="{ footer: 'justify-end' }"
    >
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
  }
}

@media (prefers-reduced-transparency: reduce) {
  .group {
    backdrop-filter: none;
  }
}
</style>
