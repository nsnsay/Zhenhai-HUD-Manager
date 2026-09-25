<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ViewMode } from "@renderer/composables/useViewMode";

const model = defineModel<ViewMode>({ required: true });
const { t } = useI18n();

const options = computed<Array<{ value: ViewMode; label: string; icon: string }>>(() => [
  { value: "list", label: t("database.viewList"), icon: "i-lucide-list" },
  { value: "table", label: t("database.viewTable"), icon: "i-lucide-table" },
]);
</script>

<template>
  <div
    class="flex items-center gap-0.5 rounded-lg border border-default p-0.5"
    role="group"
    :aria-label="t('database.viewMode')"
  >
    <UButton
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :icon="option.icon"
      size="md"
      :color="model === option.value ? 'primary' : 'neutral'"
      :variant="model === option.value ? 'solid' : 'ghost'"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    />
  </div>
</template>
