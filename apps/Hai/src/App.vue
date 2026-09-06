<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useGsiStore } from '@zhenhai/csgogsi/gsi-vue'
import LoadingPage from './components/LoadingPage.vue'
import { HaiSettings } from './utils/useHaiSettings/index.ts'
import { haiLogger } from './utils/haiLogger'
import { apiUrl } from './utils/apiUrl.ts'

const gsi = useGsiStore()

const ready = ref(false)

const countdown = ref(5)

let timer: number | null = null

function clearTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function startCountdown() {
  if (ready.value || timer !== null) return

  countdown.value = 5

  timer = window.setInterval(() => {
    countdown.value -= 1

    if (countdown.value <= 0) {
      ready.value = true
      clearTimer()
    }
  }, 1000)
}

watch(
  () => Boolean(gsi.data),
  (hasData) => {
    if (hasData) {
      startCountdown()
    } else {
      ready.value = false
      countdown.value = 5
      clearTimer()
    }
  },
  { immediate: true },
)

onMounted(() => {
  gsi.connect({ autoRefresh: true, url: apiUrl() })
  haiLogger.info('HaiApp', 'Socket connection requested')
})

onUnmounted(() => {
  clearTimer()
  gsi.disconnect()
})

watch(
  () => gsi.connected,
  (connected) => {
    haiLogger.info('HaiApp', connected ? 'Socket connected' : 'Socket disconnected')
  },
)
</script>

<template>
  <LoadingPage :ready="ready" :gsi="gsi" :countdown="countdown" />
  <HaiSettings v-if="gsi.data" :settings="gsi.data?.settings">
    <router-view v-slot="{ Component }">
      <component :is="Component" :ready="ready" :gsi="gsi.data" />
    </router-view>
  </HaiSettings>
</template>
