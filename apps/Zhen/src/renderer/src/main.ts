import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import ui from "@nuxt/ui/vue-plugin";

import App from "./App.vue";
import router from "./router";
import { rendererLogger } from "./utils/logger";

function toErrorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ui);

window.addEventListener("error", (event) => {
  rendererLogger.error("ZhenRenderer", "Uncaught window error", {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    error: toErrorMeta(event.error),
  });
});

window.addEventListener("unhandledrejection", (event) => {
  rendererLogger.error("ZhenRenderer", "Unhandled promise rejection", {
    reason: toErrorMeta(event.reason),
  });
});

app.config.errorHandler = (error, _instance, info) => {
  rendererLogger.error("ZhenRenderer", `Vue error: ${info}`, toErrorMeta(error));
};

app.mount("#app");
