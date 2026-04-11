import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import ReaderPage from '../pages/ReaderPage.vue'

const routes = [
  { path: '/', name: 'home', component: HomePage },
  {
    path: '/:filename',
    name: 'reader',
    component: ReaderPage,
    props: true,
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
