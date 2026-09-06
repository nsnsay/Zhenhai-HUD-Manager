<script setup lang="ts"></script>

<template>
  <div class="toolbox-view h-full min-h-0 w-full">
    <RouterView v-slot="{ Component }">
      <Transition name="child-route" mode="out-in">
        <component :is="Component" class="h-full min-h-0 w-full" />
      </Transition>
    </RouterView>
  </div>
</template>
