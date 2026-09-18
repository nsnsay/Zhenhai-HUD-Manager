<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import FocusedPlayerHealth from './FocusedPlayerHealth.vue'
import { useHaiSettings } from '@/utils/useHaiSettings'
import FocusedPlayerInfo from './FocusedPlayerInfo.vue'
import FocusedPlayerWeapons from './FocusedPlayerWeapons.vue'
import { onUnmounted, ref } from 'vue'
import { useGsiEvent } from '@zhenhai/csgogsi/gsi-vue'

const { teamAttrs } = useHaiSettings()

defineProps<{
  players: Player[]
}>()

/** 观战目标切换动画时长。 */
const SWITCH_ANIMATION_MS = 220

const previousSteamId = ref('')
const targetSteamId = ref('')
const switching = ref(false)
let switchTimer: number | null = null

/**
 * 渲染真源仍然是 players[].isFocused；
 * observerTargetChange 只负责驱动「谁刚离开 / 谁刚进入」的过渡动画。
 */
useGsiEvent('observerTargetChange', (from, to) => {
  previousSteamId.value = from?.steamid ?? ''
  targetSteamId.value = to?.steamid ?? ''
  switching.value = true

  if (switchTimer !== null) {
    window.clearTimeout(switchTimer)
  }

  switchTimer = window.setTimeout(() => {
    switching.value = false
    switchTimer = null
  }, SWITCH_ANIMATION_MS)
})

onUnmounted(() => {
  if (switchTimer !== null) {
    window.clearTimeout(switchTimer)
    switchTimer = null
  }
})
</script>

<template>
  <div class="Focused__Player absolute w-140 h-50 bottom-(--hai-safe-y) left-1/2 -translate-x-1/2">
    <div
      :class="[
        { 'opacity-0': !player.isFocused },
      ]"
      class="focused-panel flex gap-3 items-end justify-center absolute bottom-0 left-1/2 -translate-x-1/2"
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

<style scoped>

</style>