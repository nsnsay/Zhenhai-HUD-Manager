<script setup lang="ts">
defineProps<{
  ready: boolean
  gsi: {
    data: unknown
  }
  countdown: number
}>()
</script>

<template>
  <Transition name="loading-exit" appear>
    <div v-if="!gsi.data || !ready" class="loading-scrim fixed inset-0 z-50 flex items-center justify-center">
      <div class="loading-card relative w-144 overflow-hidden rounded-[18px] p-8 text-white">
        <div class="loading-card__edge" />

        <div class="relative flex flex-col">
          <div class="flex items-center gap-4">
            <div class="loading-mark">
              <img src="/icon.png" alt="" class="h-12 w-12 object-contain" />
            </div>
            <div>
              <div class="text-[10px] font-semibold uppercase text-white/45">ZhenHai HUD</div>
              <h1 class="mt-0.5 text-2xl font-semibold leading-tight text-white">ZhenHai HUD Manager</h1>
            </div>
          </div>

          <div class="mt-8 flex items-center justify-between gap-6">
            <div class="min-w-0 flex-1">
              <Transition name="status-swap" mode="out-in">
                <div v-if="!gsi.data" key="waiting" class="status-copy">
                  <div class="flex items-center gap-2">
                    <span class="status-dot" />
                    <span class="text-sm font-medium text-white/70">Waiting for CS2 data</span>
                  </div>
                  <p class="mt-2 text-xs leading-5 text-white/40">
                    Game State Integration is not sending packets yet.
                  </p>
                </div>

                <div v-else key="connected" class="status-copy">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-white">Connected</span>
                    <span class="text-xs text-white/40">entering overlay</span>
                  </div>

                  <div class="countdown-row mt-2 flex items-center gap-2">
                    <span class="countdown-number" :key="countdown">{{ countdown }}</span>
                    <span class="text-xs text-white/45">seconds</span>
                  </div>
                </div>
              </Transition>
            </div>

            <div class="loading-indicator">
              <span class="loading-indicator__ring" />
              <span class="loading-indicator__core" />
            </div>
          </div>

          <div class="loading-track mt-7">
            <div class="loading-track__fill" :class="{ 'is-counting': gsi.data }"
              :style="{ width: gsi.data ? `${Math.min(100, Math.max(0, (5 - countdown) * 20))}%` : '0%' }" />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.loading-scrim {}

.loading-card {
  background: linear-gradient(160deg, rgba(22, 30, 48, 0.99), rgba(8, 12, 24, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 32px 90px rgba(0, 0, 0, 0.46),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.loading-card__edge {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.loading-mark {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #fbbf24;
  box-shadow: 0 0 18px rgba(251, 191, 36, 0.7);
  animation: statusPulse 1.8s ease-in-out infinite;
}

.countdown-row {
  min-height: 46px;
}

.countdown-number {
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  text-shadow: 0 2px 18px rgba(80, 160, 255, 0.28);
  animation: digitPop 420ms cubic-bezier(0.34, 1.45, 0.64, 1) both;
}

.loading-indicator {
  position: relative;
  width: 76px;
  height: 76px;
  flex: 0 0 auto;
}

.loading-indicator__ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: rgba(116, 190, 255, 0.9);
  border-right-color: rgba(116, 190, 255, 0.35);
  animation: spin 1s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

.loading-indicator__core {
  position: absolute;
  inset: 20px;
  border-radius: 999px;
  background: rgba(116, 190, 255, 0.16);
  filter: blur(8px);
}

.loading-track {
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.loading-track__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(116, 190, 255, 0.8), rgba(120, 240, 190, 0.8));
  box-shadow: 0 0 16px rgba(116, 190, 255, 0.4);
  transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.status-swap-enter-active,
.status-swap-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 180ms ease;
}

.status-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
  filter: blur(3px);
}

.status-swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  filter: blur(2px);
}

.loading-exit-enter-active {
  transition:
    opacity 400ms ease,
    transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 400ms ease;
}

.loading-exit-leave-active {
  transition:
    opacity 420ms ease,
    transform 480ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 420ms ease;
}

.loading-exit-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.98);
  filter: blur(5px);
}

.loading-exit-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.99);
  filter: blur(6px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes statusPulse {

  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.85);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes digitPop {
  from {
    opacity: 0;
    transform: translateY(12px) scale(1.15);
    filter: blur(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@media (prefers-reduced-motion: reduce) {

  .loading-scrim,
  .loading-card,
  .loading-card * {
    backdrop-filter: none;
  }

  .status-swap-enter-active,
  .status-swap-leave-active,
  .loading-exit-enter-active,
  .loading-exit-leave-active,
  .loading-track__fill {
    transition: opacity 120ms ease !important;
  }

  .status-swap-enter-from,
  .status-swap-leave-to,
  .loading-exit-enter-from,
  .loading-exit-leave-to {
    transform: none;
    filter: none;
  }

  .status-dot,
  .loading-indicator__ring,
  .countdown-number {
    animation: none;
  }
}
</style>
