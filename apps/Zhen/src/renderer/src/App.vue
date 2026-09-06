<script setup lang="ts">
import { onMounted, ref, provide, nextTick, watch } from "vue";
import { useExtrasStore, type ExtrasRecord } from "./stores/useExtrasStore";
import { useMatchsStore } from "./stores/useMatchsStore";
import { usePlayersStore } from "./stores/usePlayersStore";
import { useTeamsStore } from "./stores/useTeamsStore";
import { useTournamentsStore } from "./stores/useTournamentsStore";
import AppView from "./views/AppView.vue";
import StartModal from "./components/StartModal.vue";
import SponsorModal from "./components/SponsorModal.vue";
import GlobalContextMenu from "@renderer/components/GlobalContextMenu.vue";
import { rendererLogger } from "@renderer/utils/logger";

const startModalOpen = ref(false);
const sponsorModalOpen = ref(false);
const shouldRunWizardAfterSponsor = ref(false);

function openStartModal() {
  startModalOpen.value = true;
}

provide("openStartModal", openStartModal);

watch(sponsorModalOpen, (isOpen) => {
  if (!isOpen && shouldRunWizardAfterSponsor.value && !startModalOpen.value) {
    startModalOpen.value = true;
  }
});

onMounted(async () => {
  await Promise.allSettled([
    usePlayersStore().init(),
    useTeamsStore().init(),
    useMatchsStore().init(),
    useTournamentsStore().init(),
    useExtrasStore().init(),
  ]);

  await nextTick();

  const extrasStore = useExtrasStore();

  const settingsRecord = extrasStore.items.find((item) => item.configType === "app-settings") as
    | ExtrasRecord
    | undefined;

  const firstStartFinished = settingsRecord?.settings?.firstStartFinished === true;
  document.body.dataset.windowMaterial = settingsRecord?.settings?.windowMaterial ?? "none";

  rendererLogger.info("AppBootstrap", "Initial stores loaded", {
    players: usePlayersStore().items.length,
    teams: useTeamsStore().items.length,
    matchs: useMatchsStore().items.length,
    tournaments: useTournamentsStore().items.length,
    firstStartFinished,
  });

  if (!firstStartFinished) {
    shouldRunWizardAfterSponsor.value = true;
  }

  sponsorModalOpen.value = true;
  rendererLogger.info("AppBootstrap", "Sponsor modal shown");
});
</script>

<template>
  <UApp>
    <GlobalContextMenu>
      <AppView />
      <StartModal v-model:open="startModalOpen" />
      <SponsorModal v-model:open="sponsorModalOpen" />
    </GlobalContextMenu>
  </UApp>
</template>
