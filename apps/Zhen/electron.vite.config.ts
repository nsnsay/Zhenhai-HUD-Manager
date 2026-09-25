import { resolve } from "path";
import { defineConfig } from "electron-vite";
import type { PluginOption } from "vite";
import vue from "@vitejs/plugin-vue";
import devtools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";
import ui from "@nuxt/ui/vite";


export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: [
          "lowdb",
          "electron-updater",
          "@esbuild/win32-x64",
          "@tailwindcss/oxide-win32-x64-msvc",
          "bufferutil",
          "utf-8-validate",
          "lightningcss-win32-x64-msvc",
        ],
      },
    },
  },
  preload: {},
  renderer: {
    base: "./",
    resolve: {
      alias: {
        "@renderer": resolve("./src/renderer/src"),
      },
      dedupe: ["vue", "vue-router", "pinia"],
    },
    // @tailwindcss/vite 与 vite-plugin-vue-devtools 的类型来自各自携带的 vite 8，
    // 而 electron-vite 使用 vite 7；两套 PluginOption 定义不兼容，因此在数组层面统一做类型适配
    // （运行时仍是同一批插件实例）。
    plugins: [
      vue(),
      devtools(),
      tailwindcss(),
      ui({
        root: resolve("./"),
        router: true,
        ui: {
          colors: {
            neutral: "zinc",
            primary: "sky",
          },
          dropdownMenu: {
            slots: {
              content: "z-[100]",
            },
          },
          button: {
            slots: {
              base: "cursor-pointer",
            },
          },
          formField: {
            slots: {
              /**
               * 桌面端标签不再低于 13.5px：Apple 的桌面最小字号是 10pt（≈13.3px），
               * 原来的 12px / 11px 只相当于 9pt 左右。
               */
              label: "text-[13.5px] text-toned",
              hint: "text-[13px] text-toned",
            },
          },
          select: {
            slots: {
              viewport: "scrollbar-none",
            },
          },
          modal: {
            slots: {
              body: "gap-1",
              content: "bg-default/70 backdrop-blur-md",
            },
          },
          fileUpload: {
            slots: {
              avatar: "object-contain",
            },
          },
          avatar: {
            slots: {
              image: "object-contain",
            },
          },
        },
      }),
    ] as unknown as PluginOption[],
  },
});
