import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface ContextTarget {
  label: string;
  edit?: () => void | Promise<void>;
  delete?: () => void | Promise<void>;
}

export const useContextMenuStore = defineStore("context-menu", () => {
  const target = ref<ContextTarget | null>(null);

  const hasContext = computed(() => target.value !== null);

  function setContext(t: ContextTarget | null) {
    target.value = t;
  }

  function clearContext() {
    target.value = null;
  }

  return { target, hasContext, setContext, clearContext };
});
