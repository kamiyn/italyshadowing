import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import ReaderPage from '../pages/ReaderPage.vue'

// Filenames in data/ are repository-managed and follow a strict naming
// convention (alphanumerics, hyphen, underscore). Constraining the route
// parameter at the routing layer means decoded `%2F` or other unexpected
// characters never reach `fetchLesson()`, where they could otherwise be
// concatenated into a URL and produce path-traversal-shaped requests.
// Anything that fails to match falls through to the catch-all redirect below.
const FILENAME_PATTERN = '[A-Za-z0-9_-]+'

const routes = [
  { path: '/', name: 'home', component: HomePage },
  {
    path: `/:filename(${FILENAME_PATTERN})`,
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
