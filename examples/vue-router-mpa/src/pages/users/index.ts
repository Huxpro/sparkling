// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createApp } from 'vue-lynx'
import App from './App.vue'
import UserList from './views/UserList.vue'
import UserDetail from './views/UserDetail.vue'
import { createPageRouter } from '../../shared/router'

const router = createPageRouter([
  { path: '/users', name: 'users', component: UserList },
  // Dynamic segment + a per-route guard: both run entirely in this heap.
  {
    path: '/users/:id',
    name: 'user-detail',
    component: UserDetail,
    beforeEnter: to => {
      console.log(`[users] beforeEnter /users/${String(to.params.id)}`)
      return true
    },
  },
])

const app = createApp(App)
app.use(router)
app.mount()
