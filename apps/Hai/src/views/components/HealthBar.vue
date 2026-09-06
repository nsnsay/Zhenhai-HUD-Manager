<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import { computed } from 'vue'
import { useRecentDamage } from '@/utils/useRecentDamage'

const props = withDefaults(
  defineProps<{
    player: Player
    direction: 'left-right' | 'top-bottom'
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
    borderRadiusForFocusedPlayer?: boolean
  }>(),
  {},
)

const { health, damageAmount, damageVisible } = useRecentDamage(() => props.player)

const HealthBarDirection = computed(() => {
  if (props.direction === 'top-bottom') {
    return { height: `${health.value}%`, width: '100%' }
  }
  if (props.direction === 'left-right') {
    return { height: '100%', width: `${health.value}%` }
  } else return ''
})

const damagePercent = computed(() =>
  Math.min(100, Math.max(0, damageAmount.value)),
)

const damageStyle = computed(() => {
  if (props.direction === 'top-bottom') {
    return {
      width: '100%',
      height: `${damagePercent.value}%`,
      bottom: `${health.value}%`,
    }
  }

  if (props.player.team?.side === 'T') {
    return {
      height: '100%',
      width: `${damagePercent.value}%`,
      right: `${health.value}%`,
    }
  }

  return {
    height: '100%',
    width: `${damagePercent.value}%`,
    left: `${health.value}%`,
  }
})

</script>

<template>
  <div class="HealthBar_Container" :class="[direction, customClassName]">
    <div class="HealthBar" :class="[{ '!': borderRadiusForFocusedPlayer }]" :style="HealthBarDirection">
    </div>
    <div class="HealthBar_Damage" :class="{ 'is-visible': damageVisible && damageAmount > 0 }" :style="damageStyle" />
  </div>
</template>

<style scoped lang="scss">
.HealthBar_Container {
  position: absolute;
  inset: 0;
  background: var(--pr-70);
  z-index: -1;

  .HealthBar {
    background: var(--main-90);
    border-radius: 0 var(--hai-radius) var(--hai-radius) 0;
    transition:
      width 0.3s ease,
      height 0.3s ease;
  }

  .HealthBar_Damage {
    position: absolute;
    background: rgba(255, 214, 64, 0.28);
    box-shadow:
      inset 0 0 0 1px rgba(255, 214, 64, 0.16),
      0 0 10px rgba(255, 214, 64, 0.12);
    opacity: 0;
    transition:
      opacity 320ms ease,
      width 260ms cubic-bezier(0.22, 1, 0.36, 1),
      height 260ms cubic-bezier(0.22, 1, 0.36, 1),
      left 260ms cubic-bezier(0.22, 1, 0.36, 1),
      right 260ms cubic-bezier(0.22, 1, 0.36, 1),
      bottom 260ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: opacity, width, height, left, right, bottom;

    &.is-visible {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {

    .HealthBar,
    .HealthBar_Damage {
      transition: none !important;
      will-change: auto;
    }
  }
}
</style>
