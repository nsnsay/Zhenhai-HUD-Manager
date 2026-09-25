<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  RADAR_DOCK_OPTIONS,
  RADAR_SETTING_RANGES,
  RADAR_ZOOM_SOFT_LIMIT,
  type RadarDock,
} from "@zhenhai/csgogsi/radar-settings";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import SettingsSlider from "./SettingsSlider.vue";
import { useAppSettings } from "@renderer/composables/useAppSettings";

const { t } = useI18n();
const { settings, setValue } = useAppSettings();

/** 雷达只判断真假，mode2 对它没有语义，所以开关写 false / "mode1"。 */
const radarEnabled = computed({
  get: () => Boolean(settings.value.overlayRadarMode),
  set: (value: boolean) => setValue("overlayRadarMode", value ? "mode1" : false),
});

const autoZoom = computed({
  get: () => settings.value.overlayRadarAutoZoom === true,
  set: (value: boolean) => setValue("overlayRadarAutoZoom", value),
});

const dockLabels: Record<RadarDock, string> = {
  "top-left": "settings.radarDockTopLeft",
  "top-right": "settings.radarDockTopRight",
  "bottom-left": "settings.radarDockBottomLeft",
  "bottom-right": "settings.radarDockBottomRight",
};

const dockOptions = computed(() =>
  RADAR_DOCK_OPTIONS.map((dock) => ({ label: t(dockLabels[dock]), value: dock })),
);

const dock = computed({
  get: () => settings.value.overlayRadarDock,
  set: (value: RadarDock) => setValue("overlayRadarDock", value),
});

type RadarNumberKey =
  | "overlayRadarSize"
  | "overlayRadarZoomMax"
  | "overlayRadarFocusPadding"
  | "overlayRadarPlayerSize"
  | "overlayRadarSmokeSize"
  | "overlayRadarFireStroke";

const numberField = (key: RadarNumberKey) =>
  computed({
    get: () => settings.value[key],
    set: (value: number) => setValue(key, value),
  });

const radarSize = numberField("overlayRadarSize");
const zoomMax = numberField("overlayRadarZoomMax");
const focusPadding = numberField("overlayRadarFocusPadding");
const playerSize = numberField("overlayRadarPlayerSize");
const smokeSize = numberField("overlayRadarSmokeSize");
const fireStroke = numberField("overlayRadarFireStroke");

/** 超过清晰上限时把说明换成提示，但不禁止。 */
const zoomMaxHint = computed(() =>
  settings.value.overlayRadarZoomMax > RADAR_ZOOM_SOFT_LIMIT
    ? t("settings.radarZoomSoftWarn")
    : t("settings.radarZoomMaxHint"),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <SettingsGroup :hint="t('settings.radarPreviewHint')">
      <SettingsRow :label="t('settings.radarShow')" :hint="t('settings.radarShowHint')">
        <USwitch v-model="radarEnabled" />
      </SettingsRow>

      <SettingsRow :label="t('settings.radarDock')" control="wide">
        <URadioGroup
          v-model="dock"
          :items="dockOptions"
          value-key="value"
          orientation="horizontal"
          size="sm"
        />
      </SettingsRow>

      <SettingsRow :label="t('settings.radarSize')" control="wide">
        <SettingsSlider
          v-model="radarSize"
          v-bind="RADAR_SETTING_RANGES.overlayRadarSize"
          unit="px"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('settings.radarZoomTitle')" :hint="t('settings.radarZoomHint')">
      <SettingsRow :label="t('settings.radarAutoZoom')">
        <USwitch v-model="autoZoom" />
      </SettingsRow>

      <SettingsRow :label="t('settings.radarZoomMax')" :hint="zoomMaxHint" control="wide">
        <SettingsSlider
          v-model="zoomMax"
          v-bind="RADAR_SETTING_RANGES.overlayRadarZoomMax"
          unit="×"
          :precision="1"
        />
      </SettingsRow>

      <SettingsRow
        :label="t('settings.radarFocusPadding')"
        :hint="t('settings.radarFocusPaddingHint')"
        control="wide"
      >
        <SettingsSlider
          v-model="focusPadding"
          v-bind="RADAR_SETTING_RANGES.overlayRadarFocusPadding"
          unit="u"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('settings.radarElementsTitle')" :hint="t('settings.radarElementsHint')">
      <SettingsRow :label="t('settings.radarPlayerSize')" control="wide">
        <SettingsSlider
          v-model="playerSize"
          v-bind="RADAR_SETTING_RANGES.overlayRadarPlayerSize"
          unit="u"
        />
      </SettingsRow>

      <SettingsRow :label="t('settings.radarSmokeSize')" control="wide">
        <SettingsSlider
          v-model="smokeSize"
          v-bind="RADAR_SETTING_RANGES.overlayRadarSmokeSize"
          unit="u"
        />
      </SettingsRow>

      <SettingsRow :label="t('settings.radarFireStroke')" control="wide">
        <SettingsSlider
          v-model="fireStroke"
          v-bind="RADAR_SETTING_RANGES.overlayRadarFireStroke"
          unit="u"
        />
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>
