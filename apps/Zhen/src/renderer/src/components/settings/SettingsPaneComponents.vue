<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ComponentMode } from "@zhenhai/csgogsi/types";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import { useAppSettings } from "@renderer/composables/useAppSettings";

const { t } = useI18n();
const { settings, setValue } = useAppSettings();

const modeOptions = computed(() => [
  { label: t("settings.disabled"), value: false },
  { label: t("settings.mode1"), value: "mode1" },
  { label: t("settings.mode2"), value: "mode2" },
]);

/**
 * 雷达有独立的「雷达」页（含开关与全部参数），所以这里只列其余五个组件，
 * 避免同一个开关出现在两个地方。
 */
const modeFields = computed(
  () =>
    [
      { key: "overlayPlayerSidebarMode", label: t("settings.componentPlayerSidebar") },
      { key: "overlayPlayerFocusedMode", label: t("settings.componentPlayerFocused") },
      { key: "overlayMatchBarMode", label: t("settings.componentMatchBar") },
      { key: "overlayMatchInfoMode", label: t("settings.componentMatchInfo") },
      { key: "overlayKillfeedMode", label: t("settings.componentKillfeed") },
    ] as const,
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <SettingsGroup :title="t('settings.modesTitle')" :hint="t('settings.modesHint')">
      <SettingsRow
        v-for="field in modeFields"
        :key="field.key"
        :label="field.label"
        control="wide"
      >
        <USelect
          :model-value="settings[field.key]"
          :items="modeOptions"
          value-key="value"
          class="w-full"
          @update:model-value="(value) => setValue(field.key, value as ComponentMode)"
          :ui="{'content': 'z-100'}"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('settings.geometryTitle')" :hint="t('settings.geometryHint')">
      <SettingsRow :label="t('settings.borderRadius')">
        <UInputNumber
          :model-value="settings.overlayBorderRadius"
          :min="0"
          :max="32"
          class="w-24"
          @update:model-value="(value) => setValue('overlayBorderRadius', Number(value ?? 0))"
        />
      </SettingsRow>

      <SettingsRow :label="t('settings.safeZoneX')">
        <UInputNumber
          :model-value="settings.overlaySafeZoneX"
          :min="0"
          :max="128"
          class="w-24"
          @update:model-value="(value) => setValue('overlaySafeZoneX', Number(value ?? 0))"
        />
      </SettingsRow>

      <SettingsRow :label="t('settings.safeZoneY')">
        <UInputNumber
          :model-value="settings.overlaySafeZoneY"
          :min="0"
          :max="128"
          class="w-24"
          @update:model-value="(value) => setValue('overlaySafeZoneY', Number(value ?? 0))"
        />
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>
