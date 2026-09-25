<script setup lang="ts">
/**
 * 滑块 + 右侧等宽读数。
 *
 * 读数是这个面板的签名元素：广播场景要求参数能被精确复述，
 * 所以数值用 `tabular-nums` 等宽显示，拖动时实时刷新。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step: number;
    /** 读数后缀，例如 px / × / u。 */
    unit?: string;
    precision?: number;
  }>(),
  { unit: "", precision: 0 },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const display = computed(() => `${props.modelValue.toFixed(props.precision)}${props.unit}`);
</script>

<template>
  <div class="flex w-full items-center gap-3">
    <USlider
      class="flex-1"
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @update:model-value="emit('update:modelValue', Number($event))"
    />

    <span class="w-14 shrink-0 text-right text-[13.5px] font-semibold tabular-nums text-highlighted">
      {{ display }}
    </span>
  </div>
</template>
