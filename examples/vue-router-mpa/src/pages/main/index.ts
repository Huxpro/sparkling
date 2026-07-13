// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createApp } from 'vue-lynx'
import App from './App.vue'
import Home from './views/Home.vue'
import Features from './views/Features.vue'
import { createPageRouter } from '../../shared/router'

const router = createPageRouter([
  { path: '/', name: 'home', component: Home },
  { path: '/features', name: 'features', component: Features },
])

// Global guards run for LOCAL (in-container) navigations, like any SPA.
// Cross-page navigations don't run them here — the target page's own
// router runs its guards when its heap boots (MPA semantics).
router.beforeEach((to, from) => {
  console.log(`[main] beforeEach: ${from.fullPath} -> ${to.fullPath}`)
  return true
})

const app = createApp(App)
app.use(router)
app.mount()
