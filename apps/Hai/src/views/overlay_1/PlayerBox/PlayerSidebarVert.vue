<script setup lang="ts">
import ArmorHelmet from '@/views/components/ArmorHelmet.vue'
import PlayerAvatar from '@/views/components/PlayerAvatar.vue'
import Grenades from '@/views/components/Grenades.vue'
import HealthBar from '@/views/components/HealthBar.vue'
import Weapons from '@/views/components/Weapons.vue'
import DefuseKit from '@/views/components/DefuseKit.vue'
import Bomb from '@/views/components/Bomb.vue'
import type { Player } from '@zhenhai/csgogsi'
import { LocateFixed, Skull } from 'lucide-vue-next'

const props = defineProps<{
  player: Player
}>()
</script>

<template>
  <div class="flex relative w-auto h-auto">
    <div :class="[{ isDead: player.isDead, 'outline-2': player.isFocused }]"
      class="player-info-box flex flex-col w-80 h-22 rounded-(--hai-radius) relative">
      <div class="absolute inset-0 w-full flex flex-row z-10 overflow-hidden group-[&.T]:flex-row-reverse">
        <div class="w-26 h-full relative z-20">
          <PlayerAvatar class="w-full mask-b-from-30% absolute inset-0 z-10 aspect-square scale-125 translate-y-3"
            :player="player" size="both" />
        </div>
        <div class="flex-1 flex flex-col w-full h-full group-[&.T]:items-end">
          <div class="flex flex-row justify-start items-center w-full h-7 gap-1 group-[&.T]:flex-row-reverse">
            <Bomb v-if="player.isBomb" image-size="20px" :bomb="player.isBomb" />
            <DefuseKit v-if="player.state.defusekit" image-size="20px" :defusekit="player.state.defusekit" />
            <div class="font-semibold text-shadow-pri text-shadow-xs text-ellipsis text-nowrap">
              {{ player._db?.playerName || player.name }}
            </div>
          </div>
          <div
            class="text-sm text-(--main-100) font-semibold mt-1 flex items-center justify-start gap-0.5 text-shadow-pri text-shadow-xs">
            $
            {{ player.state.money }}
          </div>
          <div
            class="flex flex-row w-full h-5 justify-between items-center gap-2 mt-1 font-semibold text-(--main-100) group-[&.T]:flex-row-reverse">
            <div class="flex-1 flex flex-row justify-between items-center gap-2">
              <div class="flex flex-row justify-start items-center flex-1 w-full h-full">
                <LocateFixed class="" :size="18" :stroke-width="3" />
                <div class="flex-1 w-full h-full">{{ player.stats.kills }}</div>
              </div>
              <div class="flex flex-row justify-start items-center flex-1 w-full h-full">
                <Skull class="drop-shadow-pri drop-shadow-sm" :size="18" :stroke-width="3" />
                <div class="w-4 h-full">
                  {{ player.stats.deaths }}
                </div>
              </div>
            </div>
            <div class="flex flex-row justify-start items-center flex-1 w-full h-full">
              <div v-if="player.state.round_kills"
                class="flex items-center justify-center w-6 h-full outline rounded-(--hai-radius)">
                {{ player.state.round_kills }}k
              </div>
            </div>
          </div>
        </div>
        <div v-if="!player.isDead" class="w-20 h-full flex flex-col items-center justify-center relative translate-y-3">
          <Weapons class="flex items-center justify-center" :player="player" :isolate-image="player.team.side === 'T'"
            size="64px" />
          <Grenades class="flex items-center justify-center" :grenades="player.grenades" size="16px" />
        </div>

        <div v-if="player.isDead" class="w-10"></div>
      </div>
      <div class="flex-1 w-full h-7 absolute left-0 top-0 overflow-hidden rounded-(--hai-radius)">
        <HealthBar :custom-class-name="['z-1! bg-pri/30! group-[&.T]:flex group-[&.T]:justify-end']"
          direction="left-right" :player="player" />
        <div v-if="!player.isDead"
          class="z-20 absolute inset-0 flex flex-row items-center justify-end px-3 gap-1 group-[&.T]:flex-row-reverse">
          <ArmorHelmet size="20px" :player="player" disable-armor-value />
          <div class="text-shadow-pri text-shadow-sm text-md font-bold">
            {{ player.state.health }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.player-info-box {
  background: var(--pr-85);
  transition: width 0.5s ease;

  &.isDead {
    width: 250px;
    transition: width 0.5s ease;
  }
}
</style>
