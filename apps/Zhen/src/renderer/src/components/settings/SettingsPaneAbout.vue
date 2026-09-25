<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import UpdateProgressCard from "@renderer/components/UpdateProgressCard.vue";
import { useUpdaterStore } from "@renderer/stores/useUpdaterStore";

const { t } = useI18n();
const toast = useToast();
const updater = useUpdaterStore();

const version = ref("");
const repositoryUrl = "https://github.com/nsnsay/Zhenhai-HUD-Manager";

onMounted(async () => {
  version.value = await window.api.app.getVersion();
});

async function checkForUpdates(): Promise<void> {
  if (updater.isChecking || updater.isDownloading) return;

  const result = await updater.checkForUpdates();

  if (result.success && !result.updateAvailable) {
    toast.add({
      title: t("settings.upToDateTitle"),
      description: t("settings.upToDateBody"),
      icon: "i-lucide-check-circle",
      color: "success",
    });
  } else if (!result.success) {
    toast.add({
      title: t("settings.checkFailedTitle"),
      description: result.error || t("settings.checkFailedBody"),
      icon: "i-lucide-alert-triangle",
      color: "error",
    });
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <SettingsGroup>
      <SettingsRow :label="t('settings.version')">
        <span class="text-[13.5px] font-semibold tabular-nums text-highlighted">
          {{ version || t("common.loading") }}
        </span>
      </SettingsRow>

      <SettingsRow :label="t('settings.repository')" :hint="t('settings.repositoryHint')">
        <a
          class="text-[13.5px] font-medium text-primary hover:underline"
          :href="repositoryUrl"
          target="_blank"
          rel="noreferrer"
        >
          {{ t("settings.repositoryOpen") }}
        </a>
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('settings.updateTitle')" :hint="t('settings.updateHint')">
      <SettingsRow :label="t('settings.updateAction')">
        <UButton
          v-if="updater.isAvailable"
          :label="t('settings.downloadUpdate')"
          icon="i-lucide-download-cloud"
          color="primary"
          variant="subtle"
          size="md"
          @click="void updater.downloadUpdate()"
        />
        <UButton
          v-else-if="updater.isDownloaded"
          :label="t('settings.restartAndInstall')"
          icon="i-lucide-refresh-cw"
          color="primary"
          variant="subtle"
          size="md"
          @click="void updater.installUpdate()"
        />
        <UButton
          v-else
          :label="t('settings.checkForUpdates')"
          icon="i-lucide-refresh-cw"
          color="primary"
          variant="subtle"
          size="md"
          :loading="updater.isChecking"
          :disabled="updater.isDownloading"
          @click="checkForUpdates"
        />
      </SettingsRow>
    </SettingsGroup>

    <UpdateProgressCard />
  </div>
</template>
