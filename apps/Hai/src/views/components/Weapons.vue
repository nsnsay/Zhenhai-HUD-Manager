<script setup lang="ts">
import type { Player, Weapon } from '@zhenhai/csgogsi/types'
import { formatWeaponName } from '../utils/formatWeaponName.ts'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    player: Player
    size?: string
    isolateImage?: boolean
    showNumber?: boolean
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
  }>(),
  {
    size: '64px',
    isolateImage: false,
  },
)

const currentWeaponIndex = computed(() => {
  if (props.player?.primaryweapon) {
    return 1
  }
  if (props.player?.secondaryweapon?.state) {
    return 2
  }
  if (props.player?.knifeweapon?.state) {
    return 3
  }
  return 4
})

const getCurrentWeapon = computed<Weapon | null>(() => {
  return props.player?.primaryweapon ||
    props.player?.secondaryweapon ||
    props.player?.knifeweapon ||
    null
})
</script>

<template v-if="player">
  <div class="weapons relative" :class="[{ 'isolate-image': isolateImage }, player?.team.side, customClassName]">
    <img :class="{ 'opacity-70': !['active', 'reloading'].includes(getCurrentWeapon.state) }" v-if="getCurrentWeapon"
      :src="`./equipment/${formatWeaponName(getCurrentWeapon.name)}.svg`" />
  </div>
</template>

<style scoped lang="scss">
.weapons {
  width: v-bind(size);
  aspect-ratio: 2/1;

  &.isolate-image {
    transform: scaleX(-1);
  }
}
</style>
