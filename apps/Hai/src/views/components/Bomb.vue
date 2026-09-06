<script setup lang="ts">
import SvgIcon from './SvgIcon.vue';


const props = withDefaults(
  defineProps<{
    bomb: boolean
    customClassName?: string | Record<string, boolean> | (string | Record<string, boolean>)[]
    imageSize?: string
  }>(),
  {
    imageSize: '3rem',
  },
)

</script>

<template>
  <div class="bomb" :class="[customClassName]">
    <SvgIcon v-if="bomb" :size="imageSize" name="icon-equipment-c4" />
  </div>
</template>

<style scoped lang="scss">
.bomb {
  transition: filter 0.4s ease;
  height: v-bind(imageSize);
  height: v-bind(imageSize);
}
</style>
