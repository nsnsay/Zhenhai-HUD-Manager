<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, toRaw, watch } from "vue";
import ShortcutInput from "@renderer/components/ShortcutInput.vue";
import { useOverlaysStore } from "@renderer/stores/useOverlaysStore";
import type { OverlaySettingsPayload } from "../../../../shared/ipc";

const props = defineProps<{ open: boolean; overlayId: string }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const { t } = useI18n();
const toast = useToast();
const overlays = useOverlaysStore();

const payload = ref<OverlaySettingsPayload | null>(null);
const draft = ref<Record<string, unknown>>({});
const bindings = ref<Record<string, string>>({});
const saving = ref(false);

interface SettingsField {
  path: string;
  value: unknown;
  kind: "boolean" | "number" | "string" | "readonly";
}

function kindOf(value: unknown): SettingsField["kind"] {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "readonly";
}

function expand(source: Record<string, unknown> | undefined, user: Record<string, unknown> | undefined): SettingsField[] {
  const fields: SettingsField[] = [];

  for (const [key, value] of Object.entries(source ?? {})) {
    if (key === "extras" && value && typeof value === "object" && !Array.isArray(value)) {
      const userExtras = (user?.extras ?? {}) as Record<string, unknown>;

      for (const [extraKey, extraValue] of Object.entries(value as Record<string, unknown>)) {
        fields.push({ path: `extras.${extraKey}`, value: userExtras[extraKey] ?? extraValue, kind: kindOf(extraValue) });
      }

      continue;
    }

    fields.push({ path: key, value: user?.[key] ?? value, kind: kindOf(value) });
  }

  return fields;
}

const fields = computed<SettingsField[]>(() => {
  const next = expand(payload.value?.manifest.settings, payload.value?.settings);

  return next.map((field) => ({ ...field, value: draft.value[field.path] ?? field.value }));
});

const forced = computed(() => expand(payload.value?.manifest.override, undefined));
const warnings = computed(() => payload.value?.warnings ?? []);
const shortcuts = computed(() => payload.value?.manifest?.shortcuts ?? []);
const canEdit = computed(() => payload.value?.canEdit === true);

async function load(): Promise<void> {
  payload.value = null;

  if (!props.overlayId) return;

  const result = await overlays.getSettings(props.overlayId);

  if (!result) return;

  payload.value = result;

  for (const field of expand(result.manifest.settings, result.settings)) {
    draft.value[field.path] = field.value;
  }

  bindings.value = { ...result.shortcutBindings };
}

watch(
  () => [props.open, props.overlayId],
  ([open]) => {
    if (open) {
      draft.value = {};
      bindings.value = {};
      void load();
    }
  },
  { immediate: true },
);

function buildNested(): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(draft.value)) {
    if (path.startsWith("extras.")) {
      extras[path.slice("extras.".length)] = value;
    } else {
      settings[path] = value;
    }
  }

  if (Object.keys(extras).length > 0) settings.extras = extras;

  // 去掉响应式代理，避免把 Proxy 交给 IPC（结构化克隆会失败）。
  return JSON.parse(JSON.stringify(toRaw(settings))) as Record<string, unknown>;
}

function errorFor(shortcutId: string): string | undefined {
  return payload.value?.shortcutResults.find((item) => item.id === shortcutId)?.error;
}

async function save(): Promise<void> {
  saving.value = true;

  try {
    const results = await overlays.saveSettings(props.overlayId, {
      settings: buildNested(),
      shortcutBindings: JSON.parse(JSON.stringify(toRaw(bindings.value))) as Record<string, string>,
    });

    if (!results) {
      toast.add({ title: t("overlays.settingsSaveFailed"), description: t("overlays.errorSettingsWrite"), color: "error", icon: "i-lucide-alert-triangle" });
      return;
    }

    if (payload.value) payload.value.shortcutResults = results;

    toast.add({ title: t("overlays.settingsSaved"), icon: "i-lucide-check" });
  } finally {
    saving.value = false;
  }
}

async function reset(): Promise<void> {
  if (!(await overlays.resetSettings(props.overlayId))) {
    toast.add({ title: t("overlays.settingsSaveFailed"), description: t("overlays.errorSettingsWrite"), color: "error", icon: "i-lucide-alert-triangle" });
    return;
  }

  draft.value = {};
  bindings.value = {};
  await load();
  toast.add({ title: t("overlays.settingsResetDone"), icon: "i-lucide-undo-2" });
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="t('overlays.settingsTitle')"
    :ui="{ content: 'max-w-2xl', footer: 'justify-between' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="payload" class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 scrollbar-none">
        <section v-if="payload.manifest.name || payload.manifest.version || payload.manifest.author || payload.manifest.homepage">
          <h3 class="text-sm font-semibold">{{ t("overlays.settingsInfo") }}</h3>
          <div class="mt-1 flex flex-col gap-0.5 text-xs text-muted">
            <span v-if="payload.manifest.name">{{ payload.manifest.name }}</span>
            <span v-if="payload.manifest.version">{{ t("overlays.settingsVersion", { version: payload.manifest.version }) }}</span>
            <span v-if="payload.manifest.author">{{ payload.manifest.author }}</span>
            <span v-if="payload.manifest.homepage" class="truncate font-mono">{{ payload.manifest.homepage }}</span>
            <span v-if="payload.manifest.description">{{ payload.manifest.description }}</span>
          </div>
        </section>

        <section v-if="warnings.length">
          <h3 class="text-sm font-semibold">{{ t("overlays.settingsWarnings") }}</h3>
          <ul class="mt-1 list-disc pl-4 text-xs text-dimmed">
            <li v-for="(warning, index) in warnings" :key="index">{{ warning }}</li>
          </ul>
        </section>

        <section>
          <h3 class="text-sm font-semibold">{{ t("overlays.settingsEditable") }}</h3>
          <p v-if="!fields.length" class="mt-1 text-xs text-dimmed">{{ t("overlays.settingsEmpty") }}</p>
          <div v-else class="mt-2 flex flex-col gap-3">
            <UFormField v-for="field in fields" :key="field.path" :label="field.path">
              <USwitch
                v-if="field.kind === 'boolean'"
                :model-value="Boolean(draft[field.path])"
                :disabled="!canEdit"
                @update:model-value="draft[field.path] = $event"
              />
              <UInput
                v-else-if="field.kind === 'number'"
                type="number"
                :model-value="String(draft[field.path] ?? '')"
                :disabled="!canEdit"
                class="w-full"
                @update:model-value="draft[field.path] = Number($event)"
              />
              <UInput
                v-else-if="field.kind === 'string'"
                :model-value="String(draft[field.path] ?? '')"
                :disabled="!canEdit"
                class="w-full"
                @update:model-value="draft[field.path] = $event"
              />
              <code v-else class="text-xs text-dimmed">{{ JSON.stringify(field.value) }}</code>
            </UFormField>
          </div>
          <p v-if="!canEdit" class="mt-2 text-xs text-muted">{{ t("overlays.settingsReadOnly") }}</p>
        </section>

        <section v-if="forced.length">
          <h3 class="text-sm font-semibold">{{ t("overlays.settingsForced") }}</h3>
          <p class="mt-1 text-xs text-muted">{{ t("overlays.settingsForcedHint") }}</p>
          <div class="mt-2 flex flex-col gap-1">
            <div v-for="field in forced" :key="field.path" class="flex items-center gap-2 text-xs">
              <UIcon name="i-lucide-lock" class="h-3.5 w-3.5 shrink-0 text-muted" />
              <span class="font-mono">{{ field.path }}</span>
              <span class="truncate text-dimmed">{{ JSON.stringify(field.value) }}</span>
            </div>
          </div>
        </section>

        <section v-if="shortcuts.length">
          <h3 class="text-sm font-semibold">{{ t("overlays.settingsShortcuts") }}</h3>
          <p class="mt-1 text-xs text-muted">{{ t("overlays.settingsShortcutsHint") }}</p>
          <div class="mt-2 flex flex-col gap-3">
            <UFormField v-for="shortcut in shortcuts" :key="shortcut.id" :label="shortcut.name" :error="errorFor(shortcut.id)">
              <ShortcutInput v-model="bindings[shortcut.id]" :disabled="!canEdit" />
            </UFormField>
          </div>
        </section>
      </div>

      <p v-else class="py-6 text-center text-xs text-muted">{{ t("common.loading") }}</p>
    </template>

    <template #footer>
      <UButton :label="t('overlays.settingsReset')" color="neutral" variant="outline" :disabled="!canEdit" @click="reset" />
      <UButton :label="t('overlays.settingsSave')" color="primary" :loading="saving" :disabled="!canEdit" @click="save" />
    </template>
  </UModal>
</template>