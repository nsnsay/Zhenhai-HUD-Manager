<script setup lang="ts">
import type { Team } from '@zhenhai/csgogsi'
import CTAvatar from '@/assets/game_icons/default_ct.png'
import TAvatar from '@/assets/game_icons/default_t.png'
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'

const props = withDefaults(
  defineProps<{
    team: Team
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
    size: 'width' | 'height' | 'both' | 'imageSize'
    imageSize?: string
  }>(),
  {
    imageSize: '4rem',
  },
)
</script>

<template>
  <div class="teamAvatar" :class="[customClassName, size]">
    <img
      v-if="team._db?.teamLogo"
      class="teamAvatar-img"
      :class="[size]"
      :src="team._db?.teamLogo"
      alt=""
    />
    <SvgIcon v-if="!team._db?.teamLogo && team.side === 'T'" :size="size" name="icon-ui-t_logo" />
    <SvgIcon v-if="!team._db?.teamLogo && team.side === 'CT'" :size="size" name="icon-ui-ct_logo" />
  </div>
</template>

<style scoped lang="scss">
.teamAvatar {
  transition: filter 0.4s ease;

  .teamAvatar-img {
    &.width {
      width: 100%;
    }

    &.height {
      height: 100%;
    }

    &.both {
      width: 100%;
      height: 100%;
    }

    &.imageSize {
      width: unset;
      height: v-bind(imageSize);
    }
  }
}
</style>
