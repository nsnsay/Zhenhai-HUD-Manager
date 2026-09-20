<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref } from "vue";
import OverlayList from "./OverlayList.vue";
import type { DevOverlayInput, OverlayEntry } from "../../../../shared/ipc";

const props = defineProps<{
  entries: OverlayEntry[];
  selectedId: string;
}>();

const emit = defineEmits<{
  add: [input: DevOverlayInput];
  select: [overlayId: string];
  remove: [overlayId: string];
  reveal: [overlayId: string];
}>();

const { t } = useI18n();

const name = ref("");
const url = ref("");
const route = ref("");

function submit(): void {
  const trimmedUrl = url.value.trim();

  if (!trimmedUrl) {
    return;
  }

  emit("add", {
    name: name.value.trim() || trimmedUrl,
    url: trimmedUrl,
    route: route.value.trim() || undefined,
  });

  name.value = "";
  url.value = "";
  route.value = "";
}
</script>

<template>
  <div class="overlay-dev-panel">
    <div class="settings-panel rounded p-2 border border-muted">
      <p class="text-xs text-muted">{{ t("overlays.devHint") }}</p>

      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <UFormField :label="t('overlays.devName')">
          <UInput v-model="name" :placeholder="t('overlays.devNamePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('overlays.devUrl')">
          <UInput v-model="url" :placeholder="t('overlays.devUrlPlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('overlays.devRoute')">
          <UInput v-model="route" :placeholder="t('overlays.devRoutePlaceholder')" class="w-full" />
        </UFormField>
      </div>

      <div class="mt-3 flex justify-end">
        <UButton
          :label="t('overlays.devAddAction')"
          icon="i-lucide-plus"
          size="sm"
          color="primary"
          variant="subtle"
          :disabled="!url.trim()"
          @click="submit"
        />
      </div>
    </div>

    <div v-if="props.entries.length" class="mt-3">
      <OverlayList
        :entries="props.entries"
        :selected-id="props.selectedId"
        removable
        @select="emit('select', $event)"
        @remove="emit('remove', $event)"
        @reveal="emit('reveal', $event)"
      />
    </div>
  </div>
</template>