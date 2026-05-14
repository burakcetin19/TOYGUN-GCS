import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'ucus',
      component: () => import('@/views/UcusGorunumu.vue'),
      meta: { baslik: 'Uçuş' },
    },
    {
      path: '/gorev',
      name: 'gorev',
      component: () => import('@/views/GorevPlanlama.vue'),
      meta: { baslik: 'Görev Planlama' },
    },
    {
      path: '/ayarlar',
      name: 'ayarlar',
      component: () => import('@/views/Ayarlar.vue'),
      meta: { baslik: 'Ayarlar' },
    },
  ],
})

export default router
