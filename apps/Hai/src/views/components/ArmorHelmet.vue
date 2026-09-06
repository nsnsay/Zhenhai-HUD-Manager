<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import SvgIcon from './SvgIcon.vue'
import { useHaiSettings } from '@/utils/useHaiSettings'
const { teamAttrs } = useHaiSettings()

const props = withDefaults(
  defineProps<{
    player: Player
    enableColor?: boolean
    size?: string
    disableArmorValue?: boolean
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
  }>(),
  {
    size: '32px',
    enableColor: false,
  },
)
</script>

<template>
  <div v-if="player" class="armors relative" :class="[{ 'color-pure': !enableColor }, customClassName]"
    :style="`width: ${size}`">
    <SvgIcon custom-class-name="armor_helmet" v-if="player?.isArmorHelmet" :size="size" name="icon-hud-armor_helmet" />
    <SvgIcon custom-class-name="armor" v-if="player?.isArmor" :size="size" name="icon-hud-armor" drop-shadow />
    <div v-if="player?.state.armor && !disableArmorValue" class="armors-value">
      {{ player?.state.armor }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.armors {
  .svg-icon {
    color: var(--main-50);
    filter: drop-shadow(0 0 8px var(--pr-100));

    &.armor {
      transform: translateY(calc(v-bind(size) / 11)) scale(0.9);
    }
  }

  .armors-value {
    position: absolute;
    inset: 0;
    top: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: calc(v-bind(size) / 3.4);
    color: var(--main-80);
    font-weight: 600;
    text-shadow: 0px 0px 10px var(--pr-100);
  }

  &.color-pure {
    .svg-icon {
      color: currentColor;
    }

    .armors-value {
      color: currentColor;
    }
  }
}
</style>
