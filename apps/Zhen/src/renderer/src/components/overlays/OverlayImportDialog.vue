<script setup lang="ts">
import { useI18n } from "vue-i18n";

const props = defineProps<{
  open: boolean;
  importing: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [];
}>();

const { t } = useI18n();
</script>

<template>
  <UModal
    :open="props.open"
    :title="t('overlays.riskTitle')"
    :description="t('overlays.riskBody')"
    :ui="{ footer: 'justify-end' }"
    @update:open="emit('update:open', $event)"
  >
    <template #footer="{ close }">
      <UButton :label="t('common.cancel')" color="neutral" variant="outline" @click="close" />
      <UButton
        :label="t('overlays.riskConfirm')"
        color="primary"
        :loading="props.importing"
        @click="emit('confirm')"
      />
    </template>
  </UModal>
</template>