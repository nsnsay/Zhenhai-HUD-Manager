<script setup lang="ts">
import { computed } from 'vue'
import { useHaiSettings } from '@/utils/useHaiSettings'
import type { CSGO } from '@zhenhai/csgogsi/types'
import PlayerSidebarVert from './PlayerSidebarVert.vue'
import PlayerSidebarHori from './PlayerSidebarHori.vue'

const { teamAttrs } = useHaiSettings()

const props = defineProps<{
  gsi: CSGO
}>()

const mode = computed(() => props.gsi?.settings?.overlayPlayerSidebarMode)
const modeClass = computed(() => (mode.value === 'mode1' ? 'flex-col' : 'flex-row'))

const sidebars = computed(() => [
  {
    team: 'CT',
    teamData: props.gsi?.map?.team_ct,
    position: 'left-(--hai-safe-x)',
    players: props.gsi?.players?.filter((p) => p.team.side === 'CT') ?? [],
  },
  {
    team: 'T',
    teamData: props.gsi?.map?.team_t,
    position: 'right-(--hai-safe-x)',
    players: props.gsi?.players?.filter((p) => p.team.side === 'T') ?? [],
  },
])
</script>

<template>
  <div
    v-for="sidebar in sidebars"
    :key="sidebar.team"
    v-bind="teamAttrs(sidebar.teamData?.side)"
    class="Players__Sidebar absolute bottom-(--hai-safe-y) flex gap-1"
    :class="[sidebar.team, sidebar.position, modeClass, { ' items-end': sidebar.team === 'T' }]"
  >
    <template v-if="mode === 'mode1'">
      <PlayerSidebarVert v-for="player in sidebar.players" :key="player.steamid" :player="player" />
    </template>
    <template v-else>
      <PlayerSidebarHori v-for="player in sidebar.players" :key="player.steamid" :player="player" />
    </template>
  </div>
</template>

<style scoped lang="scss"></style>
