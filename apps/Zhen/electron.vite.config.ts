import { resolve } from "path";
import { defineConfig } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import devtools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";
import ui from "@nuxt/ui/vite";

console.log(__dirname);

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
    plugins: [
      vue(),
      devtools() as any,
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
              label: "text-[12px] text-muted",
              hint: "text-[11px]",
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
    ],
  },
});
