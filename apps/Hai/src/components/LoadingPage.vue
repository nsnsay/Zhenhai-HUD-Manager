<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  ready: boolean
  gsi: {
    data: unknown
  }
  countdown: number
}>()

/** 倒计时总秒数，与 App.vue 的节奏保持一致，仅用于把剩余时间换算成进度。 */
const COUNTDOWN_SECONDS = 5

const connected = computed(() => Boolean(props.gsi.data))

/** 有数据之前显示等待态，倒计时结束后整块淡出。 */
const visible = computed(() => !connected.value || !props.ready)

/** 0 → 1：未知时长时保持 0（进度条走不确定态），拿到数据后线性推进到 1。 */
const progress = computed(() => {
  if (!connected.value) return 0

  const elapsed = COUNTDOWN_SECONDS - props.countdown

  return Math.min(1, Math.max(0, elapsed / COUNTDOWN_SECONDS))
})

const statusLabel = computed(() => (connected.value ? 'Connected' : 'Waiting for CS2 data'))

const secondsLeft = computed(() => String(Math.max(1, props.countdown)))
</script>

<template>
  <Transition name="stage" appear>
    <div v-if="visible" class="stage">
      <section class="plate">
        <header class="plate__brand">
          <img class="plate__icon" src="/icon.png" alt="" width="34" height="34" />
          <span class="plate__name">ZhenHai HUD</span>
        </header>

        <div class="plate__meta">
          <span class="plate__status" role="status" aria-live="polite">
            <Transition name="copy" mode="out-in" :duration="{ enter: 220, leave: 180 }">
              <span :key="connected ? 'live' : 'waiting'">{{ statusLabel }}</span>
            </Transition>
          </span>

          <Transition name="tick" mode="out-in" :duration="{ enter: 200, leave: 160 }">
            <span v-if="connected" :key="countdown" class="plate__seconds">
              {{ secondsLeft }}<span class="plate__unit">s</span>
            </span>
          </Transition>
        </div>

        <div
          class="meter"
          role="progressbar"
          aria-label="Overlay start"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="connected ? Math.round(progress * 100) : undefined"
        >
          <span v-if="!connected" class="meter__sweep" />
          <span class="meter__fill" :style="{ transform: `scaleX(${progress})` }" />
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
/*
 * 广播加载板：只保留「品牌、状态、进度」三件事。
 * 背景是不透明的深色面，状态改变由文案 + 进度条共同表达，不使用颜色单独表意。
 */
.stage {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.plate {
  display: grid;
  gap: 18px;
  width: 420px;
  padding: 26px 28px 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: rgba(11, 16, 32, 0.94);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}

.plate__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plate__icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: contain;
}

.plate__name {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #ffffff;
}

.plate__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-height: 20px;
}

.plate__status {
  font-size: 14px;
  font-weight: 500;
  color: #a9b4c7;
}

.plate__seconds {
  min-width: 34px;
  text-align: right;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}

.plate__unit {
  margin-left: 1px;
  font-size: 11px;
  font-weight: 500;
  color: #8b95a7;
}

.meter {
  position: relative;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.meter__fill,
.meter__sweep {
  position: absolute;
  border-radius: inherit;
}

/* 确定性进度：拿到数据后从 0 推进到 1，与倒计时同步。 */
.meter__fill {
  inset: 0;
  background: #74beff;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* 不确定进度：时长未知时只有一段扫光在走，告知「还在等」。 */
.meter__sweep {
  inset: 0 auto 0 0;
  width: 32%;
  background: rgba(255, 255, 255, 0.28);
  animation: meter-sweep 1.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

/* 整体进场 / 退场：容器淡入淡出，纸板只做很短的位移与缩放。 */
.stage-enter-active {
  transition: opacity 260ms ease-out;
}

.stage-leave-active {
  transition: opacity 300ms ease-in;
}

.stage-enter-from,
.stage-leave-to {
  opacity: 0;
}

.stage-enter-active .plate,
.stage-leave-active .plate {
  will-change: transform, opacity;
}

.stage-enter-active .plate {
  animation: plate-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.stage-leave-active .plate {
  animation: plate-out 320ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

.copy-enter-active,
.copy-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.copy-enter-from {
  opacity: 0;
  transform: translate3d(0, 6px, 0);
}

.copy-leave-to {
  opacity: 0;
  transform: translate3d(0, -5px, 0);
}

.tick-enter-active {
  transition:
    opacity 160ms ease,
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tick-leave-active {
  transition:
    opacity 130ms ease,
    transform 160ms cubic-bezier(0.4, 0, 0.2, 1);
}

.tick-enter-from {
  opacity: 0;
  transform: translate3d(0, 8px, 0);
}

.tick-leave-to {
  opacity: 0;
  transform: translate3d(0, -8px, 0);
}

@keyframes plate-in {
  from {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes plate-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  to {
    opacity: 0;
    transform: translate3d(0, -10px, 0) scale(1.008);
  }
}

@keyframes meter-sweep {
  from {
    transform: translate3d(-100%, 0, 0);
  }

  to {
    transform: translate3d(312%, 0, 0);
  }
}

/* 降低动态效果：只保留淡入淡出，去掉位移、缩放与循环动画。 */
@media (prefers-reduced-motion: reduce) {
  .stage-enter-active,
  .stage-leave-active {
    transition-duration: 120ms;
  }

  .stage-enter-active .plate,
  .stage-leave-active .plate {
    animation: none;
    will-change: auto;
  }

  .copy-enter-active,
  .copy-leave-active,
  .tick-enter-active,
  .tick-leave-active {
    transition: opacity 100ms ease;
  }

  .copy-enter-from,
  .copy-leave-to,
  .tick-enter-from,
  .tick-leave-to {
    transform: none;
  }

  .meter__fill {
    transition: none;
  }

  .meter__sweep {
    display: none;
  }
}
</style>
