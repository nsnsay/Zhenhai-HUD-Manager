<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import FocusedPlayerHealth from './FocusedPlayerHealth.vue'
import { useHaiSettings } from '@/utils/useHaiSettings'
import FocusedPlayerInfo from './FocusedPlayerInfo.vue'
import FocusedPlayerWeapons from './FocusedPlayerWeapons.vue'
const { teamAttrs } = useHaiSettings()

const props = defineProps<{
  players: Player[]
}>()
</script>

<template>
  <div class="Focused__Player absolute w-140 h-50 bottom-(--hai-safe-y) left-1/2 -translate-x-1/2">
    <div
      :class="[{ 'opacity-0': !player.isFocused }]"
      class="flex gap-3 items-end justify-center absolute bottom-0 left-1/2 -translate-x-1/2"
      v-bind="teamAttrs(player.team.side)"
      v-for="player in players"
      :key="player.steamid"
    >
      <FocusedPlayerHealth :player="player" />
      <FocusedPlayerInfo :player="player" />
      <FocusedPlayerWeapons :player="player" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
