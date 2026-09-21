<script setup lang="ts">
import type { GameState } from '@zhenhai/csgogsi/types'
import SvgIcon from '@/views/components/SvgIcon.vue'
import { computed, onUnmounted, ref } from 'vue'
import { useGsiEvent } from '@zhenhai/csgogsi/gsi-vue'

const props = defineProps<{
  gsi: GameState
}>()

const DEFAULT_REGULATION_MR = 12
const DEFAULT_OVERTIME_MR = 3
const ROUND_PULSE_MS = 240

function secondToTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  totalSeconds = Math.max(0, totalSeconds)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const formattedTime = computed(() => {
  let totalSeconds = props.gsi?.phase_countdowns.phase_ends_in
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  totalSeconds = Math.max(0, totalSeconds)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
})

/**
 * map.round 是「已结束回合数」：常规情况 +1，gameover 时保持原值，
 * 与 Zhen 端 DatabaseOverview 的口径保持一致。
 */
const currentRound = computed(() => {
  const map = props.gsi?.map

  if (!map) {
    return 1
  }

  return map.phase === 'gameover' ? map.round : map.round + 1
})

const regulationMR = computed(() => props.gsi?.map?.regularMR ?? DEFAULT_REGULATION_MR)
const overtimeMR = computed(() => props.gsi?.map?.overtimeMR ?? DEFAULT_OVERTIME_MR)

/**
 * 常规 2 * regulationMR 回合；进入加时后按 2 * overtimeMR 一段递增。
 */
const totalRounds = computed(() => {
  const regulationRounds = regulationMR.value * 2
  const round = currentRound.value

  if (round <= regulationRounds) {
    return regulationRounds
  }

  const overtimeRounds = Math.max(1, overtimeMR.value) * 2
  const overtimes = Math.ceil((round - regulationRounds) / overtimeRounds)

  return regulationRounds + overtimes * overtimeRounds
})

const isOvertime = computed(() => currentRound.value > regulationMR.value * 2)

/**
 * roundStart 只用来触发数字切换动画；数值仍然是上面的派生计算结果，
 * 避免出现两套「当前回合」真源。
 */
const roundPulse = ref(false)
let pulseTimer: number | null = null

useGsiEvent('roundStart', () => {
  roundPulse.value = true

  if (pulseTimer !== null) {
    window.clearTimeout(pulseTimer)
  }

  pulseTimer = window.setTimeout(() => {
    roundPulse.value = false
    pulseTimer = null
  }, ROUND_PULSE_MS)
})

onUnmounted(() => {
  if (pulseTimer !== null) {
    window.clearTimeout(pulseTimer)
    pulseTimer = null
  }
})
</script>

<template>
  <div
    class="flex-1 flex flex-col items-center justify-center bg-pri/70 ring-2 ring-sec/30 rounded-(--hai-radius)"
  >
    <div v-if="gsi.phase_countdowns.phase !== 'bomb'" class="font-semibold text-2xl">
      {{ formattedTime }}
    </div>
    <SvgIcon v-else size="32px" name="icon-ui-bomb_c4" />
    <div class="flex flex-row items-center justify-center gap-1 text-sec/60">
      <div class="font-semibold text-xs">Round</div>
      <div
        class="round-counter font-semibold text-xs transition-transform duration-200 ease-out"
        :class="{ 'scale-110': roundPulse }"
      >
        {{ currentRound }}/{{ totalRounds }}
      </div>
      <div
        v-if="isOvertime"
        class="rounded-sm bg-sec/20 px-1 text-[10px] font-bold leading-4 text-sec/80"
      >
        OT
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .round-counter {
    transition: none;
  }
}
</style>