// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Evidence that createSparklingRouter leaves vue-router's IN-HEAP feature set
 * intact. The adapter only wraps push/replace to divert CROSS-bundle targets;
 * everything that resolves within the current bundle must behave exactly like
 * a stock vue-router. These cases mirror vue-router's own guide features
 * (dynamic matching, nested routes, named views, redirect, alias, guards,
 * dynamic routing) and back the compatibility matrix in the package README.
 */

import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createSparklingRouter } from '../vue'
import { createHybridHistory } from '../history'
import { createSparklingSchemeCodec } from '../codec'
import { defineRouteManifest } from '../manifest'
import { createMemoryNavigationEnvironment } from '../hosts/memory'

const Stub = defineComponent({ render: () => h('div') })

// One bundle "app" owns every route here so nothing diverts to native — we are
// testing the in-heap pass-through. A second bundle exists only to prove the
// interception boundary still fires.
const manifest = defineRouteManifest({
  pages: [
    { bundle: 'app', routes: ['/', '/users/:id', '/parent', '/dashboard', '/home', '/root-alias'] },
    { bundle: 'other', routes: ['/other'] },
  ],
})
const codec = createSparklingSchemeCodec(manifest)

function bootRouter(routes: RouteRecordRaw[]) {
  const env = createMemoryNavigationEnvironment()
  const container = env.open(codec.encode('/', { depth: 0 })!)
  const history = createHybridHistory({ host: container.host, codec })
  const router = createSparklingRouter({ manifest, history, routes })
  return { router, env }
}

describe('vue-router in-heap features pass through the adapter', () => {
  it('dynamic route matching resolves params', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub },
      { path: '/users/:id', component: Stub },
    ])
    await router.push('/users/42')
    expect(router.currentRoute.value.params.id).toBe('42')
  })

  it('nested routes build the matched chain', async () => {
    const { router } = bootRouter([
      {
        path: '/parent',
        component: Stub,
        children: [{ path: 'child', component: Stub }],
      },
    ])
    await router.push('/parent/child')
    expect(router.currentRoute.value.matched).toHaveLength(2)
    expect(router.currentRoute.value.fullPath).toBe('/parent/child')
  })

  it('named views resolve multiple components for one record', async () => {
    const { router } = bootRouter([
      {
        path: '/dashboard',
        components: { default: Stub, sidebar: Stub },
      },
    ])
    await router.push('/dashboard')
    const record = router.currentRoute.value.matched[0]
    expect(Object.keys(record.components ?? {}).sort()).toEqual([
      'default',
      'sidebar',
    ])
  })

  it('redirect (string) follows through', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub },
      { path: '/home', redirect: '/' },
    ])
    await router.push('/home')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirect (function) can rewrite to a query', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub },
      { path: '/users/:id', component: Stub },
      { path: '/parent', redirect: () => ({ path: '/users/7' }) },
    ])
    await router.push('/parent')
    expect(router.currentRoute.value.path).toBe('/users/7')
  })

  it('alias matches the aliased path', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub, alias: '/root-alias' },
    ])
    await router.push('/root-alias')
    const record = router.currentRoute.value.matched[0]
    // the alias resolves and links back to the original '/' record
    expect(record.aliasOf?.path).toBe('/')
    expect(record.components?.default).toBe(Stub)
  })

  it('a global guard returning false aborts the navigation', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub },
      { path: '/users/:id', component: Stub },
    ])
    router.beforeEach(to => (to.path === '/users/1' ? false : true))
    const failure = await router.push('/users/1')
    expect(failure).toBeTruthy() // NavigationFailure
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('a guard can redirect', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub },
      { path: '/dashboard', component: Stub },
      { path: '/home', component: Stub },
    ])
    router.beforeEach(to => (to.path === '/home' ? '/dashboard' : true))
    await router.push('/home')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('afterEach runs for in-heap navigations', async () => {
    const { router } = bootRouter([
      { path: '/', component: Stub },
      { path: '/users/:id', component: Stub },
    ])
    const spy = vi.fn()
    router.afterEach(spy)
    await router.push('/users/9')
    expect(spy).toHaveBeenCalled()
  })

  it('dynamic routing via addRoute works in-heap', async () => {
    const { router } = bootRouter([{ path: '/', component: Stub }])
    router.addRoute({ path: '/users/:id', name: 'u', component: Stub })
    await router.push('/users/5')
    expect(router.currentRoute.value.name).toBe('u')
    router.removeRoute('u')
    expect(router.hasRoute('u')).toBe(false)
  })

  it('the interception boundary still diverts cross-bundle targets', async () => {
    const { router, env } = bootRouter([{ path: '/', component: Stub }])
    await router.push('/other')
    // did NOT resolve locally; opened a native container instead
    expect(router.currentRoute.value.path).toBe('/')
    expect(env.stack).toHaveLength(2)
  })
})
