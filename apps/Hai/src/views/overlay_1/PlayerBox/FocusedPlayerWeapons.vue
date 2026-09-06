<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import { useHaiSettings } from '@/utils/useHaiSettings'
import Grenades from '@/views/components/Grenades.vue'
import Weapons from '@/views/components/Weapons.vue'
import SvgIcon from '@/views/components/SvgIcon.vue'
import DefuseKit from '@/views/components/DefuseKit.vue'
import Bomb from '@/views/components/Bomb.vue'
const { teamAttrs } = useHaiSettings()

const props = defineProps<{
  player: Player
}>()
</script>

<template>
  <div v-if="player" class="flex flex-col justify-center items-start gap-3">
    <Bomb v-if="player.isBomb" :bomb="player.isBomb" image-size="32px" />
    <DefuseKit
      v-if="player.state.defusekit"
      :defusekit="player.state.defusekit"
      image-size="32px"
    />
    <Weapons size="75px" :player="player" show-number />
    <Grenades :grenades="player.grenades" />
  </div>
</template>

<style scoped lang="scss">
.svg-icon {
  opacity: 0.7;
}
</style>
