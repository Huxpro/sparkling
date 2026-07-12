// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createApp } from 'vue-lynx'
import App from './App.vue'
import Settings from './views/Settings.vue'
import { createPageRouter } from '../../shared/router'

const router = createPageRouter([
  { path: '/settings', name: 'settings', component: Settings },
])

const app = createApp(App)
app.use(router)
app.mount()
