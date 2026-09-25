<script setup lang="ts">
/**
 * 设置分组：分组标题 + 实色卡片 + 页脚说明。
 *
 * 内容层一律用实色（`bg-elevated`），模糊只留给模态背板 —— 见 apple-design 的
 * `liquid-glass.md`：半透明材质属于浮层，不该铺进内容区。
 */
defineProps<{
  title?: string;
  hint?: string;
}>();
</script>

<template>
  <section class="flex flex-col gap-2">
    <h3 v-if="title" class="text-[13.5px] font-semibold text-toned">{{ title }}</h3>

    <div class="overflow-hidden rounded-lg border border-default bg-elevated">
      <slot />
    </div>

    <p v-if="hint" class="text-[13px] leading-5 text-toned">{{ hint }}</p>
  </section>
</template>
