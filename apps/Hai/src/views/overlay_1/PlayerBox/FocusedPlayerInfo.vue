<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import { useHaiSettings } from '@/utils/useHaiSettings'
import SvgIcon from '@/views/components/SvgIcon.vue'
import HealthBar from '@/views/components/HealthBar.vue'
import CTAvatar from '@/assets/game_icons/default_ct.png'
import TAvatar from '@/assets/game_icons/default_t.png'
import { computed } from 'vue'
import PlayerAvatar from '@/views/components/PlayerAvatar.vue'
import TeamAvatar from '@/views/components/TeamAvatar.vue'
const { teamAttrs } = useHaiSettings()

const props = defineProps<{
  player: Player
}>()

const avatar = computed(() => {
  if (props.player?._db?.playerAvatar) {
    return props.player?._db?.playerAvatar
  }
  if (props.player?.team.side === 'CT') {
    return CTAvatar
  }
  if (props.player?.team.side === 'T') {
    return TAvatar
  } else {
    return ''
  }
})
</script>

<template>


  <div class="flex flex-col w-72">
    <PlayerAvatar
      custom-class-name="relative flex items-center justify-center w-full h-full aspect-video bg-pri/40 rounded-t-(--hai-radius) rounded-b-none"
      :player="player" size="height" />
    <div id="focusedPlayerInfo"
      class="grid grid-cols-3 gap-1 justify-center items-center p-2 w-full rounded-t-none! rounded-b-(--hai-radius) overflow-hidden relative"
      :class="[{ 'rounded-t-(--hai-radius)!': !player?._db?.playerAvatar }]">
      <HealthBar :player="player" direction="left-right" border-radius-for-focused-player />
      <TeamAvatar :team="player.team" size="imageSize" image-size="24px" />
      <div class="font-semibold text-center">{{ player?._db?.playerName || player.name }}</div>
      <div v-if="player?.activeweapon" class="flex flex-row items-center justify-end gap-1">
        <div v-if="!['Grenade', 'Knife', 'C4', undefined].includes(player?.activeweapon?.type)" class="font-extrabold">
          {{ player?.activeweapon?.ammo_clip || 0 }}
        </div>
        <div class="flex flex-row items-center justify-center">
          <SvgIcon v-if="!['Grenade', 'Knife', 'C4', undefined].includes(player?.activeweapon?.type)" size="16px"
            name="icon-hud-ammo_reserve_banana_mag" />
          <div v-if="player?.activeweapon?.type === 'Grenade'" class="font-bold pr-1">/</div>
          <div class="font-extrabold">{{ player?.activeweapon?.ammo_reserve }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
