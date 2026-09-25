<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import SettingsGroup from "./SettingsGroup.vue";
import SettingsRow from "./SettingsRow.vue";
import ShortcutInput from "@renderer/components/ShortcutInput.vue";
import { useAppSettings } from "@renderer/composables/useAppSettings";
import {
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
  type ShortcutBindings,
} from "../../../../shared/shortcuts";

const { t } = useI18n();
const { shortcutBindings, applyShortcuts } = useAppSettings();

const bindings = ref<ShortcutBindings>({ ...shortcutBindings.value });
const errors = ref<Partial<Record<ShortcutAction, string>>>({});
const ignoreMouseEvents = ref(true);

let unsubscribe: (() => void) | null = null;

onMounted(async () => {
  unsubscribe = window.api.onOverlayIgnoreMouseChanged((enabled) => {
    ignoreMouseEvents.value = enabled;
  });

  ignoreMouseEvents.value = await window.api.overlayGetIgnoreMouseEvents();
});

onUnmounted(() => {
  unsubscribe?.();
  unsubscribe = null;
});

watch(shortcutBindings, (next) => {
  bindings.value = { ...next };
});

async function commit(action: ShortcutAction, value: string): Promise<void> {
  bindings.value = { ...bindings.value, [action]: value };

  const result = await applyShortcuts({ ...bindings.value });

  if (result.ok) {
    errors.value = {};
    return;
  }

  errors.value = result.errors;
  // 注册失败：回滚到真正生效的组合键，界面不显示一组没生效的键
  bindings.value = { ...shortcutBindings.value };
}
</script>

<template>
  <SettingsGroup
    :hint="
      t('settings.mouseEventsState', {
        state: ignoreMouseEvents ? t('settings.mousePassThrough') : t('settings.mouseInteractive'),
      })
    "
  >
    <SettingsRow :label="t('settings.refreshOverlay')" control="full">
      <div class="w-full">
        <ShortcutInput
          :model-value="bindings.overlayRefresh"
          :default-value="DEFAULT_SHORTCUTS.overlayRefresh"
          :placeholder="t('settings.shortcutPlaceholder')"
          @update:model-value="(value) => commit('overlayRefresh', value)"
        />

        <p
          v-if="errors.overlayRefresh"
          class="mt-1 text-[13px] text-error"
          :title="errors.overlayRefresh"
        >
          {{ t("settings.shortcutConflict") }}
        </p>
      </div>
    </SettingsRow>

    <SettingsRow :label="t('settings.toggleMouseEvents')" control="full">
      <div class="w-full">
        <ShortcutInput
          :model-value="bindings.overlayToggleMouseEvents"
          :default-value="DEFAULT_SHORTCUTS.overlayToggleMouseEvents"
          :placeholder="t('settings.shortcutPlaceholder')"
          @update:model-value="(value) => commit('overlayToggleMouseEvents', value)"
        />

        <p
          v-if="errors.overlayToggleMouseEvents"
          class="mt-1 text-[13px] text-error"
          :title="errors.overlayToggleMouseEvents"
        >
          {{ t("settings.shortcutConflict") }}
        </p>
      </div>
    </SettingsRow>
  </SettingsGroup>
</template>
