<script setup lang="ts">
import type { CSGO } from '@zhenhai/csgogsi/types';
import MatchBoxTeamInfo from './MatchBoxTeamInfo.vue';
import MatchBoxRoundInfo from './MatchBoxRoundInfo.vue';
const props = defineProps<{
  gsi: CSGO
}>()
</script>

<template>
  <div class="fixed top-(--hai-safe-y) left-1/2 -translate-x-1/2 flex flex-col rounded-(--hai-radius) gap-1">
    <div class="w-full h-8 bg-pri/50 rounded flex flex-row">
      <div class="flex-1 flex items-center justify-center font-semibold">{{ gsi.matchinfo?.tournament?.tournamentName }}
      </div>
      <div class="w-24 h-full flex items-center justify-center relative">
        <img class="absolute bottom-0 h-10" :src="gsi.matchinfo?.tournament?.tournamentLogo" />
      </div>
      <div class="flex-1 flex items-center justify-center font-semibold">{{ gsi.matchinfo?.matchType }}</div>
    </div>
    <div class="flex flex-row w-165 h-16 gap-2">
      <MatchBoxTeamInfo :team="gsi?.map.team_ct" :phase="gsi?.phase_countdowns" />
      <MatchBoxRoundInfo :gsi="gsi" />
      <MatchBoxTeamInfo :team="gsi?.map.team_t" :phase="gsi?.phase_countdowns" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
