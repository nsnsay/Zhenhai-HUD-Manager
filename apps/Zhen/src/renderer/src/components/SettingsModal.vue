<script setup lang="ts">
import { ref, watch } from "vue";
import { inject } from "vue";
import {
  APP_SETTINGS_CONFIG_TYPE,
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  type AppSettings,
  type ExtrasRecord,
  useExtrasStore,
} from "@renderer/stores/useExtrasStore";
import { rendererLogger } from "@renderer/utils/logger";

const props = defineProps<{
  open: boolean;
}>();
const emit = defineEmits(["update:open"]);
const openStartModal = inject<() => void>("openStartModal");

const toast = useToast();
const extrasStore = useExtrasStore();
const isLoading = ref(false);
const isSaving = ref(false);
const isCheckingUpdate = ref(false);
const recordId = ref<string | null>(null);

const formData = ref<AppSettings>(mergeAppSettings(null));
const existingSettings = ref<Partial<AppSettings>>({});
const extrasJson = ref("{}");

const modeOptions = [
  { label: "Disabled", value: false },
  { label: "Mode 1", value: "mode1" },
  { label: "Mode 2", value: "mode2" },
];

const colorFields = [
  { key: "ctDefaultColor", label: "CT Default Color" },
  { key: "tDefaultColor", label: "T Default Color" },
  { key: "primaryDefaultColor", label: "Primary Color" },
  { key: "secondaryDefaultColor", label: "Secondary Color" },
] as const;

const modeFields = [
  { key: "overlayPlayerSidebarMode", label: "Player Sidebar" },
  { key: "overlayPlayerFocusedMode", label: "Player Focused" },
  { key: "overlayMatchBarMode", label: "Match Bar" },
  { key: "overlayMatchInfoMode", label: "Match Info" },
  { key: "overlayRadarMode", label: "Radar" },
  { key: "overlayKillfeedMode", label: "Killfeed" },
] as const;

const windowMaterialOptions: Array<{
  label: string;
  value: AppSettings["windowMaterial"];
}> = [
  { label: "Off", value: "none" },
  { label: "Acrylic", value: "acrylic" },
  { label: "Mica", value: "mica" },
];

function applyWindowMaterialBody(material: AppSettings["windowMaterial"]) {
  document.body.dataset.windowMaterial = material;
}

async function loadSettings() {
  isLoading.value = true;

  try {
    await extrasStore.init();
    const existing = extrasStore.items.find(
      (item) => item.configType === APP_SETTINGS_CONFIG_TYPE,
    ) as ExtrasRecord | undefined;

    if (existing) {
      recordId.value = existing.id;
      existingSettings.value = existing.settings ?? {};

      formData.value = mergeAppSettings(existing.settings);

      extrasJson.value = JSON.stringify(formData.value.extras || {}, null, 2);

      parseShortcut(
        formData.value.overlayRefreshShortcut || DEFAULT_APP_SETTINGS.overlayRefreshShortcut,
      );
    } else {
      recordId.value = null;
      existingSettings.value = {};

      formData.value = mergeAppSettings(null);

      extrasJson.value = JSON.stringify(formData.value.extras || {}, null, 2);

      parseShortcut(DEFAULT_APP_SETTINGS.overlayRefreshShortcut);
    }
    rendererLogger.info("SettingsModal", "Settings loaded", {
      recordId: recordId.value,
    });
    applyWindowMaterialBody(formData.value.windowMaterial);
  } catch (e) {
    rendererLogger.error("SettingsModal", "Failed to load settings", e);
  } finally {
    isLoading.value = false;
  }
}

async function saveSettings() {
  isSaving.value = true;
  try {
    let parsedExtras = {};
    try {
      parsedExtras = extrasJson.value ? JSON.parse(extrasJson.value) : {};
    } catch {
      rendererLogger.warn("SettingsModal", "Extras JSON is invalid");
      toast.add({
        title: "JSON Error",
        description: "Invalid JSON in extras field.",
        color: "error",
        icon: "i-lucide-alert-triangle",
      });
      isSaving.value = false;
      return;
    }

    const shortcut = buildShortcut();
    formData.value.overlayRefreshShortcut = shortcut;

    const payload: AppSettings = {
      ...existingSettings.value,
      ...formData.value,
      extras: parsedExtras,
    };

    const dataToSave = {
      configType: APP_SETTINGS_CONFIG_TYPE,
      settings: payload,
    };

    let result;
    if (recordId.value) {
      result = await extrasStore.update(recordId.value, dataToSave);
    } else {
      result = await extrasStore.create(dataToSave);
    }

    if (result.success) {
      await window.api.shortcut.register(shortcut);
      rendererLogger.info("SettingsModal", "Settings saved", {
        recordId: recordId.value,
        shortcut,
      });
      toast.add({
        title: "Settings Saved",
        description: "Your preferences have been updated.",
        icon: "i-lucide-check",
      });
      await window.api.setWindowMaterial(formData.value.windowMaterial);
      applyWindowMaterialBody(formData.value.windowMaterial);
      emit("update:open", false);
    } else {
      rendererLogger.error("SettingsModal", "Settings save failed", result.error);
      toast.add({
        title: "Save Failed",
        description: result.error || "Unknown error",
        color: "error",
        icon: "i-lucide-x-circle",
      });
    }
  } finally {
    isSaving.value = false;
  }
}

async function checkForUpdates() {
  if (isCheckingUpdate.value) return;
  isCheckingUpdate.value = true;

  try {
    const result = await window.api.updater.checkForUpdates();

    if (result.success && !result.updateAvailable) {
      toast.add({
        title: "Up to Date",
        description: "No new ZhenHai updates are available.",
        icon: "i-lucide-check-circle",
        color: "success",
      });
    } else if (!result.success) {
      toast.add({
        title: "Update Check Failed",
        description: result.error || "Unable to reach GitHub releases.",
        icon: "i-lucide-alert-triangle",
        color: "error",
      });
    }
  } finally {
    isCheckingUpdate.value = false;
  }
}

const shortcutMod1 = ref("CommandOrControl");
const shortcutMod2 = ref("Alt");
const shortcutKey = ref("I");

const modOptions = [
  { label: "None", value: "none" },
  { label: "Ctrl", value: "Ctrl" },
  { label: "Shift", value: "Shift" },
  { label: "Alt", value: "Alt" },
  { label: "Cmd / Ctrl", value: "CommandOrControl" },
];

const keyOptions = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => ({ label: c, value: c })),
  ..."0123456789".split("").map((c) => ({ label: c, value: c })),
  ...Array.from({ length: 12 }, (_, i) => ({ label: `F${i + 1}`, value: `F${i + 1}` })),
];

function parseShortcut(shortcut: string) {
  const parts = shortcut.split("+");
  if (parts.length >= 3) {
    shortcutMod1.value = parts[0];
    shortcutMod2.value = parts[1];
    shortcutKey.value = parts[2];
  } else if (parts.length === 2) {
    shortcutMod1.value = parts[0];
    shortcutMod2.value = "none";
    shortcutKey.value = parts[1];
  } else if (parts.length === 1) {
    shortcutMod1.value = "none";
    shortcutMod2.value = "none";
    shortcutKey.value = parts[0];
  }
}

function buildShortcut(): string {
  const parts: string[] = [];
  if (shortcutMod1.value && shortcutMod1.value !== "none") parts.push(shortcutMod1.value);
  if (shortcutMod2.value && shortcutMod2.value !== "none") parts.push(shortcutMod2.value);
  if (shortcutKey.value && shortcutKey.value !== "none") parts.push(shortcutKey.value);
  return parts.join("+");
}

watch(
  () => props.open,
  (val) => {
    if (val) loadSettings();
  },
);
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    title="Settings"
    description="Configure overlay and application preferences."
    :ui="{
      content: 'max-w-3xl rounded-2xl bg-elevated/80',
      header: 'px-6 pt-5 pb-4 border-b border-default/40',
      body: 'px-6 py-5',
      footer: 'px-6 py-4 border-t border-default/40',
    }"
  >
    <template #body>
      <div v-if="isLoading" class="flex justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 text-muted" />
      </div>

      <div v-else class="settings-scroll max-h-[62vh] overflow-y-auto pr-2 scrollbar-none">
        <!-- Colors Section -->
        <div class="settings-section">
          <div class="section-heading">
            <UIcon name="i-lucide-palette" class="h-4 w-4 text-primary" />
            <div>
              <h3 class="text-sm font-semibold">Base Settings</h3>
              <p class="text-xs text-muted">Color identity for team and focused player surfaces.</p>
            </div>
          </div>

          <div class="settings-panel border border-muted">
            <div class="settings-panel__label">Colors (HSL)</div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField v-for="field in colorFields" :key="field.key" :label="field.label">
                <UPopover>
                  <UButton color="neutral" variant="outline" class="w-full justify-between">
                    <span class="flex items-center gap-2">
                      <span
                        class="h-4 w-4 rounded-full border border-default shrink-0"
                        :style="{ backgroundColor: formData[field.key] }"
                      ></span>
                      <span class="truncate text-xs font-mono">{{ formData[field.key] }}</span>
                    </span>
                    <UIcon name="i-lucide-chevrons-up-down" class="text-muted shrink-0" />
                  </UButton>

                  <template #content>
                    <div class="p-3">
                      <UColorPicker v-model="formData[field.key]" format="hsl" />
                    </div>
                  </template>
                </UPopover>
              </UFormField>
            </div>
          </div>

          <div class="settings-panel border border-muted">
            <div class="settings-panel__label">Overlay Refresh Shortcut</div>
            <div class="flex flex-wrap items-center gap-2">
              <USelect v-model="shortcutMod1" :items="modOptions" value-key="value" class="w-36" />
              <USelect v-model="shortcutMod2" :items="modOptions" value-key="value" class="w-36" />
              <USelect v-model="shortcutKey" :items="keyOptions" value-key="value" class="w-24" />
            </div>
          </div>

          <div class="settings-panel border border-muted">
            <div class="settings-panel__label">Window Material</div>
            <p class="mt-1 text-xs text-muted">
              Acrylic and Mica are available on supported Windows versions.
            </p>
            <USelect
              v-model="formData.windowMaterial"
              :items="windowMaterialOptions"
              value-key="value"
              class="mt-3 w-full"
            />
          </div>

          <div class="settings-panel settings-panel--action">
            <div>
              <div class="settings-panel__label">Application Update</div>
              <p class="text-xs text-muted">Check GitHub releases for a newer version.</p>
            </div>
            <UButton
              label="Check for Updates"
              icon="i-lucide-refresh-cw"
              color="primary"
              variant="subtle"
              size="sm"
              :loading="isCheckingUpdate"
              @click="checkForUpdates"
            />
          </div>
        </div>

        <!-- Modes Section -->
        <div class="settings-section">
          <div class="section-heading">
            <UIcon name="i-lucide-layout-grid" class="h-4 w-4 text-primary" />
            <div>
              <h3 class="text-sm font-semibold">Overlay Components Mode</h3>
              <p class="text-xs text-muted">Control which HUD systems are rendered.</p>
            </div>
          </div>

          <div class="settings-panel border border-muted">
            <div class="grid grid-cols-2 gap-3">
              <UFormField v-for="field in modeFields" :key="field.key" :label="field.label">
                <USelect
                  v-model="formData[field.key]"
                  :items="modeOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </div>

        <!-- Misc Section -->
        <div class="settings-section">
          <div class="section-heading">
            <UIcon name="i-lucide-sliders-horizontal" class="h-4 w-4 text-primary" />
            <div>
              <h3 class="text-sm font-semibold">Miscellaneous</h3>
              <p class="text-xs text-muted">Overlay geometry and advanced developer settings.</p>
            </div>
          </div>

          <div class="settings-panel border border-muted">
            <div class="grid grid-cols-3 gap-3">
              <UFormField label="Overlay Border Radius (px)">
                <UInputNumber v-model="formData.overlayBorderRadius" :min="0" :max="32" />
              </UFormField>
              <UFormField label="Overlay Safezone X Axis">
                <UInputNumber v-model="formData.overlaySafeZoneX" :min="0" :max="128" />
              </UFormField>

              <UFormField label="Overlay Safezone Y Axis">
                <UInputNumber v-model="formData.overlaySafeZoneY" :min="0" :max="128" />
              </UFormField>
            </div>
            <UFormField class="mt-3" label="Extras (Custom JSON)" hint="Advanced configuration">
              <UTextarea
                v-model="extrasJson"
                :rows="5"
                placeholder="{}"
                class="w-full font-mono text-xs"
              />
            </UFormField>
          </div>

          <div class="settings-panel settings-panel--action">
            <div>
              <div class="settings-panel__label">First-run Wizard</div>
              <p class="text-xs text-muted">Reopen CS2 path and tournament setup flow.</p>
            </div>
            <UButton
              label="Re-run Wizard"
              icon="i-lucide-wand-2"
              color="neutral"
              variant="outline"
              size="sm"
              @click="
                openStartModal?.();
                emit('update:open', false);
              "
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton label="Save Changes" color="primary" :loading="isSaving" @click="saveSettings" />
    </template>
  </UModal>
</template>

<style scoped lang="scss">
.settings-scroll {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 2px;
}

.section-heading h3 {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.section-heading p {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.settings-panel {
  border-radius: var(--radius-md);
  padding: 14px;
}

.settings-panel--action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.settings-panel__label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.settings-panel__label + .text-xs {
  margin-top: 2px;
}

@media (prefers-reduced-transparency: reduce) {
  .settings-panel,
  .settings-scroll {
    backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-panel {
    transition: none;
  }
}
</style>
