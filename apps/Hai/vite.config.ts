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
    /**
     * 只写项目内 dist/：内置默认 Overlay 由 `bun run pack` 安装到
     * apps/Zhen/resources/overlay，避免两个 Overlay 项目互相覆盖产物。
     */
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
