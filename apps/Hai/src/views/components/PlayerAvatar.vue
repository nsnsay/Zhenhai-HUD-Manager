<script setup lang="ts">
import type { Player } from '@zhenhai/csgogsi'
import CTAvatar from '@/assets/game_icons/default_ct.png'
import TAvatar from '@/assets/game_icons/default_t.png'
import { computed } from 'vue'
import { useRecentDamage } from '@/utils/useRecentDamage'

const props = withDefaults(
  defineProps<{
    player: Player
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
    size: 'width' | 'height' | 'both' | 'imageSize'
    imageSize?: string
  }>(),
  {
    imageSize: '4rem',
  },
)

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

const { damageAmount, damageVisible } = useRecentDamage(() => props.player)
</script>

<template>
  <div
    class="avatar"
    :class="[customClassName, size, { 'grayscale-100 duration-400 transition': player.isDead }]"
  >
    <img class="avatar-img" :class="[size]" :src="avatar" alt="" />
    <Transition name="avatar-damage">
      <span v-if="damageVisible && damageAmount > 0" class="avatar-damage-label">
        -{{ damageAmount }} hp
      </span>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.avatar {
  transition: filter 0.4s ease;

  .avatar-img {
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

  .avatar-damage-label {
    position: absolute;
    top: 10%;
    left: 50%;
    z-index: 20;
    color: white;
    font-size: 16px;
    font-weight: 800;
    line-height: 1;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .avatar-damage-enter-active {
    transition:
      opacity 180ms ease,
      transform 240ms cubic-bezier(0.22, 1, 0.36, 1),
      filter 180ms ease;
    will-change: opacity, transform, filter;
  }

  .avatar-damage-leave-active {
    transition:
      opacity 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
      filter 220ms ease;
    will-change: opacity, transform, filter;
  }

  .avatar-damage-enter-from {
    opacity: 0;
    transform: translate(-50%, -6px) scale(0.96);
    filter: blur(2px);
  }

  .avatar-damage-leave-to {
    opacity: 0;
    transform: translate(-50%, -2px);
    filter: blur(1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .avatar-damage-enter-active,
    .avatar-damage-leave-active {
      transition: opacity 100ms ease !important;
      will-change: auto;
    }

    .avatar-damage-enter-from,
    .avatar-damage-leave-to {
      transform: translateX(-50%);
      filter: none;
    }
  }
}
</style>
