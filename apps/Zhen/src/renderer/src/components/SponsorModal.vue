<script setup lang="ts">
import sponsorUrl from "../assets/sponsor.jpg";

const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <UModal
    v-model:open="open"
    title="Support ZhenHai"
    description="If ZhenHai helps your streams and broadcasts, a small WeChat tip would be appreciated."
    :dismissible="true"
    :close="true"
    :ui="{
      content: 'max-w-md',
      body: 'p-0',
      footer: 'justify-end',
    }"
  >
    <template #body>
      <div class="flex flex-col items-center gap-4 bg-elevated/30 p-6">
        <div class="overflow-hidden rounded-lg bg-white p-2 shadow-lg ring-1 ring-black/10">
          <img
            :src="sponsorUrl"
            alt="WeChat donation QR code"
            class="block h-64 w-64 object-contain"
          />
        </div>
        <p class="max-w-xs text-center text-sm leading-6 text-muted">
          Scan the QR code with WeChat to support the development of ZhenHai HUD Manager.
        </p>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton label="Close" color="primary" @click="close" />
    </template>
  </UModal>
</template>

<style scoped lang="scss"></style>
