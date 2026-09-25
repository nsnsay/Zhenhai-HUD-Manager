<script setup lang="ts">
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import { useColorMode } from "@vueuse/core";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import { useAppSettings } from "@renderer/composables/useAppSettings";
import type { AppSettings } from "@renderer/stores/useExtrasStore";
import type { NativeThemeSource, WindowMaterial } from "../../../../shared/ipc";

const { t } = useI18n();
const { settings, setValue, extrasJson, extrasInvalid, setExtrasJson } = useAppSettings();
const colorMode = useColorMode();
const openStartModal = inject<() => void>("openStartModal");
const closeSettings = inject<() => void>("closeSettings");

const languageOptions = computed(() => [
  { label: t("settings.languageSystem"), value: "system" },
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
]);

const themeOptions = computed<Array<{ label: string; value: NativeThemeSource }>>(() => [
  { label: t("settings.themeSystem"), value: "system" },
  { label: t("settings.themeLight"), value: "light" },
  { label: t("settings.themeDark"), value: "dark" },
]);

/** @vueuse 的 colorMode 用 "auto" 表示跟随系统，这里映射成设置里展示的三种取值。 */
const theme = computed<NativeThemeSource>({
  get: () => {
    const current = colorMode.value;
    return current === "dark" || current === "light" ? current : "system";
  },
  set: (value) => {
    colorMode.value = value === "system" ? "auto" : value;
    void window.api.setThemeSource(value);
  },
});

const windowMaterialOptions = computed<Array<{ label: string; value: WindowMaterial }>>(() => [
  { label: t("settings.materialNone"), value: "none" },
  { label: t("settings.materialAcrylic"), value: "acrylic" },
  { label: t("settings.materialMica"), value: "mica" },
]);

/**
 * 所有改动都要过 `setValue`：它负责落库与副作用，
 * 直接 v-model 到 settings 只会改内存、不会保存。
 */
const language = computed({
  get: () => settings.value.language,
  set: (value: AppSettings["language"]) => setValue("language", value),
});

const windowMaterial = computed({
  get: () => settings.value.windowMaterial,
  set: (value: WindowMaterial) => setValue("windowMaterial", value),
});

function rerunWizard(): void {
  openStartModal?.();
  closeSettings?.();
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <SettingsGroup>
      <SettingsRow :label="t('settings.language')" :hint="t('settings.languageHint')" control="wide">
        <USelect
          v-model="language"
          :items="languageOptions"
          value-key="value"
          class="w-full"
        />
      </SettingsRow>

      <SettingsRow :label="t('settings.theme')" :hint="t('settings.themeHint')" control="wide">
        <USelect v-model="theme" :items="themeOptions" value-key="value" class="w-full" />
      </SettingsRow>

      <SettingsRow
        :label="t('settings.windowMaterial')"
        :hint="t('settings.windowMaterialHint')"
        control="wide"
      >
        <USelect
          v-model="windowMaterial"
          :items="windowMaterialOptions"
          value-key="value"
          class="w-full"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup>
      <SettingsRow :label="t('settings.firstRunTitle')" :hint="t('settings.firstRunHint')">
        <UButton
          :label="t('settings.rerunWizard')"
          icon="i-lucide-wand-2"
          color="neutral"
          variant="outline"
          size="md"
          @click="rerunWizard"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('settings.advancedTitle')" :hint="t('settings.extrasHint')">
      <SettingsRow :label="t('settings.extras')" control="full">
        <div class="w-full">
          <UTextarea
            :model-value="extrasJson"
            :rows="5"
            placeholder="{}"
            class="w-full font-mono text-[13px]"
            @update:model-value="setExtrasJson"
          />

          <p v-if="extrasInvalid" class="mt-1 text-[13px] text-error">
            {{ t("settings.jsonErrorBody") }}
          </p>
        </div>
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>
