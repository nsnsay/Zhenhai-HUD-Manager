<script setup lang="ts">
import type { Team, Player, Bomb } from '@zhenhai/csgogsi/types'
import { useHaiSettings } from '@/utils/useHaiSettings'
import TeamAvatar from '@/views/components/TeamAvatar.vue'
import { useGsiStore, useGsiEvent } from '@zhenhai/csgogsi/gsi-vue'
import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

const props = defineProps<{
  team: Team
}>()

const { teamAttrs } = useHaiSettings()
const gsi = useGsiStore()
const roundEndObject = ref()

const MAX_TIMER = {
  planting: 3,
  defuse_kit: 5,
  defuse_nokit: 10,
  bomb: 40,
} as const

const PROGRESS_TRANSITION = 'width 300ms ease'
const PROGRESS_DURATION = 320

const CT_CALIBRATION_THRESHOLD = 0.12
const T_CALIBRATION_THRESHOLD = 0.25

/**
 * phase 进入这些状态时，如果进度条正在工作，则强制重置。
 *
 * 注意：
 * 安装炸弹通常发生在 live 阶段，
 * 所以 `planting` 状态下遇到 `live` 不重置，
 * 否则安装炸弹进度条会刚启动就被重置。
 */
const PROGRESS_RESET_PHASES: ReadonlySet<string> = new Set([
  'freezetime',
  'warmup',
  'live',
  'over',
  'timeout_ct',
  'timeout_t',
])

/**
 * 后续业务可能用到的值。
 *
 * 真实事件名是 `bombExplode`，不是 `bombExploded`。
 */
const defuseSecondsLeft = ref(0)
const explodeSecondsLeft = ref(0)

const ctBar = ref<HTMLDivElement | null>(null)
const tBar = ref<HTMLDivElement | null>(null)

type TProgressMode = 'idle' | 'planting' | 'planted'

type PhaseSnapshot = {
  phase?: string
  phase_ends_in: number
}

interface BarController {
  set(percent: number): void
  animateToFull(callback?: (() => void) | null): void
  clearTransition(): void
  isTransitioning(): boolean
  destroy(): void
}

/**
 * 通用进度条控制器。
 *
 * 负责：
 * - 直接设置宽度百分比
 * - 播放重置到 100% 的过渡动画
 * - 取消过渡动画
 *
 * 不依赖 Vue 响应式做每帧更新，避免高频触发组件渲染。
 */
function createBarController(elRef: Ref<HTMLDivElement | null>): BarController {
  let lastPercent = 100
  let transitionTimer: ReturnType<typeof setTimeout> | null = null
  let transitionCallback: (() => void) | null = null

  const clearTransition = (): void => {
    if (transitionTimer !== null) {
      clearTimeout(transitionTimer)
      transitionTimer = null
    }

    transitionCallback = null

    const el = elRef.value

    if (el) {
      el.style.transition = 'none'
    }
  }

  const set = (percent: number): void => {
    const el = elRef.value

    if (!el) {
      return
    }

    if (transitionTimer !== null) {
      clearTransition()
    }

    if (percent === lastPercent) {
      return
    }

    lastPercent = percent
    el.style.width = `${percent}%`
  }

  const animateToFull = (callback: (() => void) | null = null): void => {
    clearTransition()

    const el = elRef.value

    if (!el) {
      callback?.()
      return
    }

    el.style.transition = PROGRESS_TRANSITION

    /**
     * 强制 reflow，确保 transition 从旧宽度开始生效。
     */
    void el.offsetWidth

    el.style.width = '100%'
    lastPercent = 100

    transitionCallback = callback

    transitionTimer = setTimeout(() => {
      el.style.transition = 'none'

      const cb = transitionCallback

      transitionTimer = null
      transitionCallback = null

      cb?.()
    }, PROGRESS_DURATION)
  }

  const isTransitioning = (): boolean => transitionTimer !== null

  const destroy = (): void => {
    clearTransition()
  }

  return {
    set,
    animateToFull,
    clearTransition,
    isTransitioning,
    destroy,
  }
}

const ctBarController = createBarController(ctBar)
const tBarController = createBarController(tBar)

let isDefuseActive = false

const ct = {
  active: false,
  maxTime: MAX_TIMER.defuse_nokit as number,
  endTime: 0,
}

const t = {
  mode: 'idle' as TProgressMode,
  maxTime: MAX_TIMER.planting as number,
  endTime: 0,
}

let rafId: number | null = null
let lastPhase: string | undefined
let lastBombState: Bomb['state'] | undefined

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function isFinitePositive(value: unknown): boolean {
  const num = Number(value)

  return Number.isFinite(num) && num > 0
}

function renderCt(now: number): boolean {
  if (!ct.active) {
    return false
  }

  const remaining = Math.max(0, (ct.endTime - now) / 1000)
  const progress = ct.maxTime > 0 ? clamp01(remaining / ct.maxTime) : 0

  ctBarController.set(progress * 100)

  return remaining > 0
}

function renderT(now: number): boolean {
  /**
   * T 进度条在播放过渡动画期间不渲染，
   * 否则 rAF 会直接覆盖过渡动画。
   */
  if (t.mode === 'idle' || tBarController.isTransitioning()) {
    return false
  }

  const remaining = Math.max(0, (t.endTime - now) / 1000)
  const progress = t.maxTime > 0 ? clamp01(remaining / t.maxTime) : 0

  tBarController.set(progress * 100)

  return remaining > 0
}

function tick(now: number): void {
  rafId = null

  const needCt = renderCt(now)
  const needT = renderT(now)

  if (needCt || needT) {
    rafId = requestAnimationFrame(tick)
  }
}

function ensureRaf(): void {
  if (rafId !== null) {
    return
  }

  if (!ct.active && (t.mode === 'idle' || tBarController.isTransitioning())) {
    return
  }

  rafId = requestAnimationFrame(tick)
}

function stopRafIfIdle(): void {
  if (
    rafId !== null &&
    !ct.active &&
    (t.mode === 'idle' || tBarController.isTransitioning())
  ) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function getDefuseMaxTime(player: Player): number {
  return player.state.defusekit
    ? MAX_TIMER.defuse_kit
    : MAX_TIMER.defuse_nokit
}

function getInitialDefuseSeconds(maxTime: number): number {
  const phase = gsi.data?.phase_countdowns

  if (phase?.phase === 'defuse' && isFinitePositive(phase.phase_ends_in)) {
    return Number(phase.phase_ends_in)
  }

  return maxTime
}

function startCtCountdown(player: Player): void {
  const maxTime = getDefuseMaxTime(player)
  const seconds = getInitialDefuseSeconds(maxTime)

  ct.maxTime = maxTime
  ct.endTime = performance.now() + seconds * 1000
  ct.active = true

  renderCt(performance.now())
  ensureRaf()
}

function resetCtProgress(): void {
  ct.active = false
  ct.maxTime = MAX_TIMER.defuse_nokit
  ct.endTime = 0

  ctBarController.animateToFull(null)
  stopRafIfIdle()
}

function startTCountdown(
  mode: TProgressMode,
  seconds: number,
  animate = false,
): void {
  tBarController.clearTransition()

  t.mode = mode
  t.maxTime = seconds

  /**
   * 安装炸弹成功后，从 planting 进度过渡到 bomb 进度 100%。
   *
   * 过渡期间暂停 T 进度条渲染。
   * 过渡结束后再开始炸弹爆炸倒计时。
   */
  if (animate && tBar.value) {
    t.endTime =
      performance.now() + (seconds + PROGRESS_DURATION / 1000) * 1000

    tBarController.animateToFull(() => {
      if (t.mode === mode) {
        renderT(performance.now())
        ensureRaf()
      }
    })

    return
  }

  t.endTime = performance.now() + seconds * 1000

  renderT(performance.now())
  ensureRaf()
}

function resetTProgress(): void {
  t.mode = 'idle'
  t.maxTime = MAX_TIMER.planting
  t.endTime = 0

  tBarController.animateToFull(null)
  stopRafIfIdle()
}

function getCurrentExplosionSecondsLeft(): number {
  if (t.mode === 'planted') {
    const remaining = Math.max(0, (t.endTime - performance.now()) / 1000)

    if (remaining > 0) {
      return remaining
    }
  }

  const phase = gsi.data?.phase_countdowns

  if (phase?.phase === 'bomb' && isFinitePositive(phase.phase_ends_in)) {
    return Number(phase.phase_ends_in)
  }

  return 0
}

function calibrateCt(phase?: PhaseSnapshot): void {
  if (!ct.active || !phase || phase.phase !== 'defuse') {
    return
  }

  const seconds = Number(phase.phase_ends_in)

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return
  }

  const currentRemaining = Math.max(
    0,
    (ct.endTime - performance.now()) / 1000,
  )

  if (Math.abs(currentRemaining - seconds) >= CT_CALIBRATION_THRESHOLD) {
    ct.endTime = performance.now() + seconds * 1000

    renderCt(performance.now())
    ensureRaf()
  }
}

function calibrateT(phase?: PhaseSnapshot): void {
  if (props.team.side !== 'T') {
    return
  }

  if (t.mode !== 'planted' || tBarController.isTransitioning()) {
    return
  }

  if (!phase || phase.phase !== 'bomb') {
    return
  }

  const seconds = Number(phase.phase_ends_in)

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return
  }

  const currentRemaining = Math.max(
    0,
    (t.endTime - performance.now()) / 1000,
  )

  if (Math.abs(currentRemaining - seconds) >= T_CALIBRATION_THRESHOLD) {
    t.endTime = performance.now() + seconds * 1000

    renderT(performance.now())
    ensureRaf()
  }
}

function handlePhaseChange(phase?: string): void {
  if (phase === lastPhase) {
    return
  }

  const hadLastPhase = lastPhase !== undefined

  const previousPhase = lastPhase
  lastPhase = phase

  if (previousPhase === 'over' && phase !== 'over') {
    roundEndObject.value = undefined
  }

  if (!phase || !hadLastPhase) {
    return
  }

  if (!PROGRESS_RESET_PHASES.has(phase)) {
    return
  }

  if (isDefuseActive) {
    isDefuseActive = false
  }

  if (ct.active) {
    resetCtProgress()
  }

  if (t.mode !== 'idle') {
    if (t.mode === 'planting' && phase === 'live') {
      return
    }

    resetTProgress()
  }
}

function handleBombStateChange(state?: Bomb['state']): void {
  if (state === lastBombState) {
    return
  }

  lastBombState = state

  if (state === 'defused' || state === 'exploded') {
    isDefuseActive = false

    resetCtProgress()
    resetTProgress()
  }
}

/**
 * 合并为一个 data watcher：
 * - phase 重置
 * - CT 拆包校准
 * - T 炸弹爆炸校准
 * - bomb.state 兜底重置
 */
watch(
  () => gsi.data,
  (data) => {
    if (!data) {
      return
    }

    const phase = data.phase_countdowns

    handlePhaseChange(phase?.phase)
    calibrateCt(phase)
    calibrateT(phase)
    handleBombStateChange(data.bomb?.state)
  },
  { immediate: true },
)

useGsiEvent('defuseStart', (player) => {
  isDefuseActive = true

  if (props.team.side === 'CT') {
    startCtCountdown(player)
  }
})

useGsiEvent('defuseStop', () => {
  isDefuseActive = false

  if (props.team.side === 'CT') {
    resetCtProgress()
  }
})

useGsiEvent('bombPlantStart', () => {
  if (props.team.side !== 'T') {
    return
  }

  startTCountdown('planting', MAX_TIMER.planting)
})

useGsiEvent('bombPlantStop', () => {
  if (props.team.side !== 'T') {
    return
  }

  resetTProgress()
})

useGsiEvent('bombPlant', () => {
  if (props.team.side !== 'T') {
    return
  }

  const shouldAnimate = t.mode === 'planting'

  startTCountdown('planted', MAX_TIMER.bomb, shouldAnimate)
})

useGsiEvent('bombDefuse', () => {
  isDefuseActive = false

  if (props.team.side === 'T') {
    explodeSecondsLeft.value = getCurrentExplosionSecondsLeft()
  }

  resetCtProgress()
  resetTProgress()
})

useGsiEvent('bombExplode', () => {
  if (isDefuseActive) {
    const rawSeconds = Number(gsi.data?.phase_countdowns?.phase_ends_in ?? 0)

    defuseSecondsLeft.value = Number.isFinite(rawSeconds)
      ? Math.max(0, rawSeconds)
      : 0
  }

  isDefuseActive = false

  resetCtProgress()
  resetTProgress()
})


useGsiEvent('roundEnd', (score) => {
  roundEndObject.value = score
  console.log(score)
})

const showRoundWinner = computed(() => {
  const result = roundEndObject.value
  const currentMap = gsi.data?.map

  if (!result || !currentMap) return false

  const isWinner = result.winner.side === props.team.side

  return isWinner
})

const seriesIndicatorCount = computed(() => {
  const matchLength = Number(gsi.data?.matchinfo?.matchLength ?? 0)

  if (!matchLength) return 0
  if (matchLength <= 1) return 1
  if (matchLength <= 3) return 2
  return 3
})

const seriesScore = computed(() => {
  const matchInfo = gsi.data?.matchinfo
  const dbTeamId = props.team._db?.id

  if (!matchInfo || !dbTeamId) return 0

  if (matchInfo.teamA?.id === dbTeamId) {
    return Number(matchInfo.matchTeamAScore ?? 0)
  }

  if (matchInfo.teamB?.id === dbTeamId) {
    return Number(matchInfo.matchTeamBScore ?? 0)
  }

  return Number(props.team._db?.matchTeamScore ?? 0)
})

onMounted(() => {
  const now = performance.now()

  renderCt(now)
  renderT(now)
  ensureRaf()
})

onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  ctBarController.destroy()
  tBarController.destroy()
})
</script>

<template>
  <div v-bind="teamAttrs(team.side)" class="flex-2 w-full h-full flex flex-col">
    <div
      class="flex-1 flex flex-row group-[&.T]:flex-row-reverse w-full h-full bg-pri/70 ring-2 ring-sec/40 rounded-(--hai-radius) overflow-hidden relative">
      <TeamAvatar
        custom-class-name="rounded-(--hai-radius) w-full h-full flex-1 flex items-center justify-center aspect-square z-2"
        :team="team" size="imageSize" image-size="3rem" />

      <div
        class="flex-2 w-full h-full flex items-center justify-center font-bold text-2xl text-sec/90 text-shadow-sm text-shadow-pri z-1">
        {{ team._db?.teamShortName }}
      </div>

      <div
        class="flex-1 w-full h-full flex items-center justify-center font-bold text-3xl text-sec rounded-(--hai-radius) z-1">
        {{ team.score }}
      </div>

      <div id="score" class="flex flex-col h-full gap-1 py-2 absolute group-[.CT]:right-2 group-[.T]:left-2">
        <div
          v-for="index in seriesIndicatorCount"
          :key="index"
          class="flex-1 w-1 rounded-(--hai-radius)"
          :class="index <= seriesScore ? 'bg-(--main-100)' : 'bg-sec/25'"
        ></div>
      </div>

      <div v-if="team.side === 'T'"
        class="absolute w-3/4 h-full z-0 flex items-center justify-start bg-pri/40 group-[&.T]:justify-end rounded-(--hai-radius) overflow-hidden">
        <div ref="tBar" class="progress-bar bg-(--main-90)"></div>
      </div>

      <div v-if="team.side === 'CT'"
        class="absolute w-3/4 h-full z-0 flex items-center justify-start bg-pri/40 rounded-(--hai-radius) overflow-hidden">
        <div ref="ctBar" class="progress-bar bg-(--main-90)"></div>
      </div>

      <div
        class="absolute z-1 w-0 px-0 opacity-0 h-full flex justify-end items-center bg-(--main-100) rounded-(--hai-radius) overflow-hidden group-[&.T]:justify-start transition-all duration-300"
        :class="[{ 'w-full px-8 opacity-100': showRoundWinner }]">
        <div class="text-xl font-bold text-sec/90 text-shadow-xs text-shadow-pri">Round Winner</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.progress-bar {
  width: 100%;
  height: 100%;
  border-radius: var(--hai-radius);
  transition: none;
  will-change: width;
}
</style>
