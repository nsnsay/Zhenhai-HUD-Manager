import './assets/main.css'
import 'virtual:svg-icons-register'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { haiLogger } from './utils/haiLogger'

function errorMeta(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { value: String(error) }
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

window.addEventListener('error', (event) => {
  haiLogger.error('HaiRenderer', 'Uncaught window error', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    error: errorMeta(event.error),
  })
})

window.addEventListener('unhandledrejection', (event) => {
  haiLogger.error('HaiRenderer', 'Unhandled promise rejection', {
    reason: errorMeta(event.reason),
  })
})

app.mount('#app')

const root = document.getElementById('app')!
const scale = Math.min(innerWidth / 1920, innerHeight / 1080)
root.style.transform = `scale(${scale})`

addEventListener('resize', () => {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080)
  root.style.transform = `scale(${s})`
})

haiLogger.info('HaiApp', 'HUD application mounted')
