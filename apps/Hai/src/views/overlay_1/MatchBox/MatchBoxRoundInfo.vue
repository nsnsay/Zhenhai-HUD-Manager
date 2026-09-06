<script setup lang="ts">
import type { CSGO } from '@zhenhai/csgogsi/types';
import SvgIcon from '@/views/components/SvgIcon.vue';
import { computed } from 'vue';

const props = defineProps<{
  gsi: CSGO
}>()

function secondToTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  totalSeconds = Math.max(0, totalSeconds)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const formattedTime = computed(() => {
  let totalSeconds = props.gsi?.phase_countdowns.phase_ends_in;
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  totalSeconds = Math.max(0, totalSeconds)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
})
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-pri/70 ring-2 ring-sec/30 rounded-(--hai-radius)">
    <div v-if="gsi.phase_countdowns.phase !== 'bomb'" class="font-semibold text-2xl">{{ formattedTime }}</div>
    <SvgIcon v-else size="32px" name="icon-ui-bomb_c4" />
    <div class="flex flex-row items-center justify-center gap-1 text-sec/60">
      <div class="font-semibold text-xs">Round</div>
      <div class="font-semibold text-xs">{{ gsi.map.round }}/24</div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
