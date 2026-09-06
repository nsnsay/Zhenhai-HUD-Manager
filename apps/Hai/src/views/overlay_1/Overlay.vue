<script setup lang="ts">
import type { CSGO } from '@zhenhai/csgogsi/types'
import Weapons from '../components/Weapons.vue'
import Grenades from '../components/Grenades.vue'
import FocusedPlayer from './PlayerBox/FocusedPlayer.vue'
import ArmorHelmet from '../components/ArmorHelmet.vue'
import PlayersContainer from './PlayerBox/PlayerSidebarContainer.vue'
import { LexoRadars } from './LexoRadars'
import MatchBoxContainer from './MatchBox/MatchBoxContainer.vue'
import MatchTournamentMap from './MatchBox/MatchTournamentMap.vue'

const props = defineProps<{
  ready: boolean
  gsi: CSGO
}>()
</script>

<template>
  <div class="ZHENHAI__OVERLAY__MAIN__1 transition-opacity duration-200" :class="[{ 'opacity-0': !ready }]">
    <Transition name="overlay-panel" appear>
      <div v-if="gsi.settings?.overlayPlayerFocusedMode">
        <FocusedPlayer :players="gsi.players" />
      </div>
    </Transition>
    <Transition name="overlay-panel" appear>
      <div v-if="gsi.settings?.overlayPlayerSidebarMode">
        <PlayersContainer :gsi="gsi" />
      </div>
    </Transition>
    <Transition name="overlay-panel" appear>
      <div v-if="gsi.settings?.overlayRadarMode">
        <LexoRadars :data="gsi" />
      </div>
    </Transition>
    <Transition name="overlay-panel" appear>
      <div v-if="gsi.settings?.overlayMatchBarMode">
        <MatchBoxContainer :gsi="gsi" />
      </div>
    </Transition>
    <Transition name="overlay-panel" appear>
      <div v-if="gsi.settings?.overlayMatchInfoMode">
        <MatchTournamentMap :gsi="gsi" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss"></style>
