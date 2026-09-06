import { createRouter, createWebHistory } from 'vue-router'
import Overlay1 from '../views/overlay_1/Overlay.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Overlay1',
      component: Overlay1,
      props: true,
    },
  ],
})

export default router
