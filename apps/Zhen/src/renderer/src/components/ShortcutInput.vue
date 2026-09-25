<script setup lang="ts">
/**
 * 快捷键录制控件。
 *
 * 交互约定（旧版的问题：一聚焦就录制，并且把 Tab preventDefault 掉，
 * 键盘用户进来就出不去；清空还会触发「快捷键不能为空」的报错）：
 *
 * - 只有显式操作才进入录制态：点击输入框、点「更改」，或在输入框上按 Enter / Space；
 * - 录制中 Tab / Shift+Tab 照常移动焦点（视为取消），因此不存在键盘陷阱；
 * - Esc 取消并保留原值；Backspace / Delete 恢复默认值（有默认值时才提供）；
 * - 录制中实时回显按住的修饰键，凑成完整组合才提交；
 * - 只有「更改」这一件事会改变值，注册失败由上层回滚并就近报错。
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  acceleratorFromInput,
  formatAccelerator,
  isModifierKey,
  type ShortcutKeyInput,
} from "../../../shared/shortcuts";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    /** 默认组合键；设了才会出现「恢复默认」入口。 */
    defaultValue?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: "",
    defaultValue: "",
    placeholder: "",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();

const rootEl = ref<HTMLElement | null>(null);
const recording = ref(false);
const heldModifiers = ref("");
const invalid = ref(false);

/** 录制中显示按住的修饰键（`Ctrl + Alt + …`），空闲时显示格式化后的组合键。 */
const displayValue = computed(() => {
  if (!recording.value) {
    return formatAccelerator(props.modelValue);
  }

  return heldModifiers.value ? `${heldModifiers.value} + …` : "";
});

const canReset = computed(
  () => Boolean(props.defaultValue) && props.modelValue !== props.defaultValue,
);

function startRecording(): void {
  if (props.disabled || recording.value) {
    return;
  }

  recording.value = true;
  heldModifiers.value = "";
  invalid.value = false;
}

function stopRecording(): void {
  recording.value = false;
  heldModifiers.value = "";
  invalid.value = false;
}

/**
 * 提交一个组合键。
 *
 * `allowEmpty` 用于「没有默认值」的场景（第三方 Overlay 的清单快捷键）：
 * 那里空串是有意义的，表示交回清单声明的默认键。
 */
function commit(accelerator: string, allowEmpty = false): void {
  const next = accelerator.trim();

  if (next || allowEmpty) {
    emit("update:modelValue", next);
  }

  stopRecording();
}

function modifierLabel(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");

  return parts.join(" + ");
}

function handleKeydown(event: KeyboardEvent): void {
  if (!recording.value) {
    // 空闲态只接管 Enter / Space；其余按键（含 Tab）保持浏览器默认行为
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startRecording();
    }

    return;
  }

  // Tab 永不拦截：录制中按 Tab 视为取消，焦点照常走出去
  if (event.key === "Tab") {
    stopRecording();
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    stopRecording();
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    if (props.defaultValue) {
      commit(props.defaultValue);
    } else {
      commit("", true);
    }

    return;
  }

  // 只按修饰键时继续等待真正的按键，并把已按住的键显示出来
  if (isModifierKey(event.key)) {
    heldModifiers.value = modifierLabel(event);
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
    invalid.value = true;
    return;
  }

  commit(accelerator);
}

/** 焦点落到本组件自己的按钮上时保持录制，点到别处才取消。 */
function handleFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;

  if (next instanceof Node && rootEl.value?.contains(next)) {
    return;
  }

  stopRecording();
}
</script>

<template>
  <div ref="rootEl" class="w-full" @focusout="handleFocusOut" @keyup="heldModifiers = ''">
    <div class="flex items-center gap-2">
      <UInput
        :model-value="displayValue"
        :placeholder="placeholder || t('settings.shortcutPlaceholder')"
        :disabled="disabled"
        readonly
        class="flex-1"
        :class="recording ? 'ring-2 ring-primary' : ''"
        :aria-invalid="invalid || undefined"
        @click="startRecording"
        @keydown="handleKeydown"
      />

      <UButton
        :label="recording ? t('settings.shortcutCancel') : t('settings.shortcutChange')"
        color="neutral"
        :variant="recording ? 'subtle' : 'outline'"
        size="md"
        :disabled="disabled"
        @click="recording ? stopRecording() : startRecording()"
      />

      <UButton
        v-if="canReset"
        :label="t('settings.shortcutReset')"
        icon="i-lucide-undo-2"
        color="neutral"
        variant="ghost"
        size="md"
        :disabled="disabled || recording"
        @click="commit(defaultValue)"
      />
    </div>

    <p v-if="recording" class="mt-1 text-[13px] text-toned" aria-live="polite">
      {{ t("settings.shortcutRecordingHint") }}
    </p>
    <p v-else-if="invalid" class="mt-1 text-[13px] text-error" aria-live="polite">
      {{ t("settings.shortcutInvalid") }}
    </p>
  </div>
</template>
