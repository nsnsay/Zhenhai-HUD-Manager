import { inject } from "vue";
import { HAI_SETTINGS_KEY, type HaiSettingsContext } from "./types";

export function useHaiSettings(): HaiSettingsContext {
  const context = inject(HAI_SETTINGS_KEY);
  if (!context) {
    throw new Error("[useHaiSettings] must be used within a <HaiSettings> component");
  }
  return context;
}
