<script setup lang="ts">
defineOptions({ name: 'SvgIcon', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    name: string
    size?: string
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
    dropShadow?: boolean
  }>(),
  {
    size: '32px',
    dropShadow: true,
  },
)
</script>

<template>
  <svg :class="[customClassName]" class="svg-icon" aria-hidden="true"
    :style="dropShadow ? { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.75))' } : {}">
    <use :href="`#${name}`" />
  </svg>
</template>

<style scoped lang="scss">
.svg-icon {
  fill: currentColor;
  overflow: hidden;
  height: v-bind(size) !important;
  width: v-bind(size) !important;
}
</style>
