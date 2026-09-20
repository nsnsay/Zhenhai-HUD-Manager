<script setup lang="ts">
import { computed, ref } from "vue";
import {
  acceleratorFromInput,
  formatAccelerator,
  isModifierKey,
  type ShortcutKeyInput,
} from "../../../shared/shortcuts";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    placeholder: "Click and press a shortcut",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const recording = ref(false);
const hint = ref<string | null>(null);

const displayValue = computed(() => {
  if (recording.value) {
    return "Press shortcut… (Esc cancels, Backspace clears)";
  }

  return formatAccelerator(props.modelValue ?? "");
});

function startRecording(): void {
  if (props.disabled) {
    return;
  }

  recording.value = true;
  hint.value = null;
}

function stopRecording(): void {
  recording.value = false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (!recording.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    stopRecording();
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    emit("update:modelValue", "");
    stopRecording();
    return;
  }

  // 单独按修饰键时继续等待真正的按键。
  if (isModifierKey(event.key)) {
    return;
  }

  const input: ShortcutKeyInput = {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  };

  const accelerator = acceleratorFromInput(input);

  if (!accelerator) {
    hint.value = "需要 Ctrl / Alt / Super 之一，键名限字母、数字、F1-F24 或常见功能键。";
    return;
  }

  emit("update:modelValue", accelerator);
  stopRecording();
}
</script>

<template>
  <div
    class="w-full"
    @focusin="startRecording"
    @focusout="stopRecording"
    @keydown="handleKeydown"
  >
    <UInput
      :model-value="displayValue"
      :placeholder="placeholder"
      :disabled="disabled"
      readonly
      class="w-full"
    />

    <p v-if="recording" class="mt-1 text-xs text-muted">
      Press a combination to record, Esc to cancel, Backspace to clear.
    </p>
    <p v-else-if="hint" class="mt-1 text-xs text-error">{{ hint }}</p>
  </div>
</template>