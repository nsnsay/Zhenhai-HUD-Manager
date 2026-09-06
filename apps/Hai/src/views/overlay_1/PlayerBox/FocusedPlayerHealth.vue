<script setup lang="ts">
import ArmorHelmet from '@/views/components/ArmorHelmet.vue'
import type { Player } from '@zhenhai/csgogsi/types'
import { useHaiSettings } from '@/utils/useHaiSettings'

const props = defineProps<{
  player: Player
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-1 h-12">
    <ArmorHelmet :enable-color="true" size="42px" :player="player" />
    <div class="flex justify-center items-center flex-col w-12">
      <div
        class="health font-extrabold text-[22px] text-shadow-lg text-shadow-pri/50 text-(--main-80)"
      >
        {{ player?.state.health }}
      </div>
      <div class="w-full h-1 bg-(--main-80) shadow-sm shadow-pri/50"></div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
