<script setup lang="ts">
import { computed } from 'vue'
import type { CSGO, MapPickDecider, MapPickVeto, MapVeto } from '@zhenhai/csgogsi/types'

const props = defineProps<{
  gsi: CSGO
}>()

const matchInfo = computed(() => props.gsi.matchinfo)
const teamA = computed(() => matchInfo.value?.teamA ?? null)
const teamB = computed(() => matchInfo.value?.teamB ?? null)

function isSelectedMap(veto: MapVeto): veto is MapPickVeto | MapPickDecider {
  return veto.mapVetoType === 'pick' || veto.mapVetoType === 'decider'
}

const selectedMaps = computed<(MapPickVeto | MapPickDecider)[]>(() => {
  return matchInfo.value?.matchVeto?.filter(isSelectedMap) ?? []
})

function mapBackground(mapName: string): string {
  return `./background/${mapName}.png`
}

function displayMapName(mapName: string): string {
  return mapName.replace(/^de_/, '').replace(/_/g, ' ')
}

function formatScore(a: number, b: number): string {
  return a === 0 && b === 0 ? '-' : `${a} - ${b}`
}

function teamLabel(teamId?: string): string {
  if (!teamId) return 'Unknown'
  if (teamA.value?.id === teamId) {
    return teamA.value.teamShortName || teamA.value.teamName || 'Team A'
  }
  if (teamB.value?.id === teamId) {
    return teamB.value.teamShortName || teamB.value.teamName || 'Team B'
  }
  return teamId.slice(0, 6)
}

function pickMeta(map: MapPickVeto) {
  const pickTeam = teamLabel(map.mapPickTeam)
  const opponent =
    map.mapPickTeam === teamA.value?.id ? teamLabel(teamB.value?.id) : teamLabel(teamA.value?.id)

  return {
    pickTeam,
    opponent,
    score: formatScore(map.mapPickTeamScore, map.mapPickEnemyScore),
  }
}

function deciderMeta(map: MapPickDecider) {
  return {
    score: formatScore(map.mapTeamAScore, map.mapTeamBScore),
    label: `Decider`,
  }
}
</script>

<template>
  <div
    v-if="selectedMaps.length > 0"
    class="veto-feed fixed top-(--hai-safe-y) right-(--hai-safe-y) z-40 flex max-w-120 flex-col items-end gap-2"
  >
    <TransitionGroup name="veto-card" tag="div" class="flex w-full flex-col items-end gap-1">
      <div
        v-for="(map, index) in selectedMaps"
        :key="`${map.mapName}-${index}`"
        class="veto-card group relative h-16 w-48 overflow-hidden rounded-(--hai-radius) bg-white/0 shadow-[0_12px_36px_rgba(0,0,0,0.28)]"
        :style="{ '--veto-index': index }"
      >
        <div
          class="absolute inset-0 bg-cover bg-center transition-[transform,filter,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] mask-l-from-30"
          :style="
            mapBackground(map.mapName)
              ? { backgroundImage: `url(${mapBackground(map.mapName)})` }
              : {}
          "
        />
        <div class="absolute inset-0 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

        <div class="relative flex h-full items-center gap-3 px-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-start gap-2">
              <span class="truncate text-sm font-bold uppercase text-white">
                {{ displayMapName(map.mapName).slice(0, 3) }}
              </span>
            </div>

            <div v-if="map.mapVetoType === 'pick'" class="mt-2 truncate text-[13px] text-white/65">
              by {{ pickMeta(map).pickTeam }}
            </div>
            <div v-else class="mt-2 truncate text-[13px] text-white/65">
              {{ deciderMeta(map).label }}
            </div>
          </div>

          <div class="text-right flex flex-row items-end gap-1">
            <div class="text-sm font-bold text-white">
              {{ map.mapVetoType === 'pick' ? pickMeta(map).score : deciderMeta(map).score }}
            </div>
            <div v-if="map.mapVetoType === 'pick'" class="text-[12px]">
              {{ pickMeta(map).opponent }}
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.veto-card {
  transform: translateX(12px);
  will-change: transform, opacity, filter;
}

.veto-card-enter-active {
  transition:
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease,
    filter 260ms ease;
  transition-delay: calc(var(--veto-index, 0) * 45ms);
}

.veto-card-leave-active {
  transition:
    transform 240ms ease,
    opacity 180ms ease,
    filter 180ms ease;
}

.veto-card-enter-from,
.veto-card-leave-to {
  opacity: 0;
  transform: translateX(24px);
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .veto-card-enter-active,
  .veto-card-leave-active {
    transition: opacity 100ms ease;
    transition-delay: 0ms;
    will-change: auto;
  }

  .veto-card-enter-from,
  .veto-card-leave-to {
    transform: none;
    filter: none;
  }
}
</style>
