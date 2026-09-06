<script setup lang="ts">
import type { Weapon } from '@zhenhai/csgogsi/types'
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { formatWeaponName } from '../utils/formatWeaponName.ts'

const props = withDefaults(
  defineProps<{
    grenades: Weapon[] | null
    size?: string
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
  }>(),
  {
    size: '24px',
  },
)

const grenadeSlots = computed(() => {
  const grenades = props.grenades || []

  const he = grenades.find((g) => g.name === 'weapon_hegrenade') || null

  const flash = grenades.find((g) => g.name === 'weapon_flashbang') || null

  const smoke = grenades.find((g) => g.name === 'weapon_smokegrenade') || null

  let fire =
    grenades.find((g) => g.name === 'weapon_molotov' || g.name === 'weapon_incgrenade') || null

  if (!fire) {
    fire =
      grenades.find(
        (g) => !['weapon_hegrenade', 'weapon_flashbang', 'weapon_smokegrenade'].includes(g.name),
      ) || null
  }

  return [{ grenade: he }, { grenade: flash }, { grenade: smoke }, { grenade: fire }]
})
</script>

<template v-if="grenades">
  <div class="grenades" :class="[customClassName]">
    <div v-for="(slot, index) in grenadeSlots" :key="index"
      :class="['grenade', slot.grenade ? slot.grenade.state : 'empty']">
      <SvgIcon :size="size" v-if="slot.grenade" :drop-shadow="slot.grenade.state === 'active'"
        :name="`icon-equipment-${formatWeaponName(slot.grenade.name)}`" />
      <div v-else class="empty-dot-container">
        <div class="empty-dot"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.grenades {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  height: v-bind(size);
  width: calc(v-bind(size) * 4);

  .grenade {
    height: 100%;

    &.active {
      .svg-icon {
        opacity: 1;
      }
    }

    .svg-icon {
      height: v-bind(size);
      width: v-bind(size);
      opacity: 0.8;
    }

    .empty-dot-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: v-bind(size);
      height: 100%;

      .empty-dot {
        width: calc(v-bind(size) / 3);
        height: calc(v-bind(size) / 3);
        background: var(--pr-30);
        border-radius: var(--radius-xl);
      }
    }
  }
}
</style>
