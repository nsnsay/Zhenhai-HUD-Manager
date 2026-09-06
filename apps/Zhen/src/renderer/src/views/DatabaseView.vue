<script setup lang="ts">
import { useRoute } from "vue-router";
import DatabaseOverview from "./DatabaseView/DatabaseOverview.vue";

const router = useRoute();
</script>

<template>
  <div class="h-full min-h-0 w-full">
    <RouterView v-if="router.path !== '/'" v-slot="{ Component }">
      <Transition name="child-route" mode="out-in">
        <component :is="Component" class="h-full min-h-0 w-full" />
      </Transition>
    </RouterView>
    <DatabaseOverview v-else class="h-full min-h-0 w-full" />
  </div>
</template>
