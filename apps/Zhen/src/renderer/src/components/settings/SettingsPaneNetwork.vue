<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import { useAppSettings } from "@renderer/composables/useAppSettings";

const { t } = useI18n();
const { settings, setValue, networkBinding, networkError } = useAppSettings();

const allowLan = computed({
  get: () => settings.value.allowLanAccess === true,
  set: (value: boolean) => setValue("allowLanAccess", value),
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <SettingsGroup :hint="t('settings.networkHint', { binding: networkBinding })">
      <SettingsRow :label="t('settings.allowLan')">
        <USwitch v-model="allowLan" />
      </SettingsRow>
    </SettingsGroup>

    <p v-if="networkError" class="text-[13px] text-error" :title="networkError">
      {{ t("settings.networkFailedBody") }}
    </p>
  </div>
</template>
