<script setup lang="ts">
import type { CSGO } from '@zhenhai/csgogsi/types'
import MatchBoxTeamInfo from './MatchBoxTeamInfo.vue'
import MatchBoxRoundInfo from './MatchBoxRoundInfo.vue'
import { computed, onUnmounted, ref } from 'vue'
import { useGsiEvent } from '@zhenhai/csgogsi/gsi-vue'

const props = defineProps<{
  gsi: CSGO
}>()

/** 地图结束提示的展示时长。 */
const MAP_END_BANNER_MS = 5000

const mapEndVisible = ref(false)
let hideTimer: number | null = null

const mapEndText = computed(() => {
  const map = props.gsi?.map

  if (!map) {
    return ''
  }

  const ctName = map.team_ct?._db?.teamShortName || map.team_ct?.name || 'CT'
  const tName = map.team_t?._db?.teamShortName || map.team_t?.name || 'T'

  return `${ctName} ${map.team_ct?.score ?? 0} : ${map.team_t?.score ?? 0} ${tName}`
})

/**
 * 上游 6.x 用 mapEnd 取代 matchEnd（后者语义上是「一局地图结束」而非系列赛），
 * 这里只订阅 mapEnd，避免同一事件被处理两次。
 */
useGsiEvent('mapEnd', () => {
  mapEndVisible.value = true

  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
  }

  hideTimer = window.setTimeout(() => {
    mapEndVisible.value = false
    hideTimer = null
  }, MAP_END_BANNER_MS)
})

onUnmounted(() => {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
})
</script>

<template>
  <div
    class="fixed top-(--hai-safe-y) left-1/2 -translate-x-1/2 flex flex-col rounded-(--hai-radius) gap-1"
  >
    <div class="w-full h-8 bg-pri/50 rounded flex flex-row">
      <div class="flex-1 flex items-center justify-center font-semibold">
        {{ gsi.matchinfo?.tournament?.tournamentName }}
      </div>
      <div class="w-24 h-full flex items-center justify-center relative">
        <img class="absolute bottom-0 h-10" :src="gsi.matchinfo?.tournament?.tournamentLogo" />
      </div>
      <div class="flex-1 flex items-center justify-center font-semibold">
        {{ gsi.matchinfo?.matchType }}
      </div>
    </div>
    <div class="flex flex-row w-165 h-16 gap-2">
      <MatchBoxTeamInfo :team="gsi?.map.team_ct" :phase="gsi?.phase_countdowns" />
      <MatchBoxRoundInfo :gsi="gsi" />
      <MatchBoxTeamInfo :team="gsi?.map.team_t" :phase="gsi?.phase_countdowns" />
    </div>
    <Transition name="map-end">
      <div
        v-if="mapEndVisible"
        class="flex h-9 w-full items-center justify-center rounded-(--hai-radius) bg-pri/80 text-sm font-bold tracking-widest text-sec/90"
      >
        MAP END · {{ mapEndText }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.map-end-enter-active,
.map-end-leave-active {
  transition:
    opacity 240ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.map-end-enter-from,
.map-end-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .map-end-enter-active,
  .map-end-leave-active {
    transition: opacity 120ms ease;
    will-change: auto;
  }

  .map-end-enter-from,
  .map-end-leave-to {
    transform: none;
  }
}
</style>