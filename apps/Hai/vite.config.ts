import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons-ng'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    tailwindcss(),
    createSvgIconsPlugin({
      iconDirs: ['src/assets/game_icons', 'public/'],
    }),
  ],
  server: {
    port: 1467,
  },
  base: '/overlay/',
  publicDir: './public',
  build: {
    outDir: '../Zhen/resources/overlay',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
