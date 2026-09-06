<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'

const props = withDefaults(
  defineProps<{
    defusekit: boolean
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
    imageSize?: string
  }>(),
  {
    imageSize: '3rem',
  },
)
</script>

<template>
  <div class="defusekit" :class="[customClassName]">
    <SvgIcon v-if="defusekit" :size="imageSize" name="icon-equipment-defuser" />
  </div>
</template>

<style scoped lang="scss">
.defusejut {
  transition: filter 0.4s ease;
  height: v-bind(imageSize);
  height: v-bind(imageSize);
}
</style>
