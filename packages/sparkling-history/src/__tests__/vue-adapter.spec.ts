// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Real vue-router instances driving the shim: one Router per simulated
 * container, exactly how one Router lives in each Lynx heap in production.
 */

import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createSparklingRouter } from '../vue'
import { createHybridHistory } from '../history'
import { createSparklingSchemeCodec } from '../codec'
import { defineRouteManifest } from '../manifest'
import {
  createMemoryNavigationEnvironment,
  type MemoryNavigationEnvironment,
  type SimulatedContainer,
} from '../hosts/memory'

const Page = defineComponent({ template: '<div/>' })

const manifest = defineRouteManifest({
  pages: [
    { bundle: 'main', routes: ['/', '/main/nested'] },
    { bundle: 'detail', routes: [{ path: '/detail/:id', name: 'detail' }] },
    { bundle: 'settings', routes: ['/settings'] },
  ],
})
const codec = createSparklingSchemeCodec(manifest)

/** Boot a router inside a container, like a page bundle would on startup. */
async function bootRouter(
  container: SimulatedContainer,
  routes: Parameters<typeof createSparklingRouter>[0]['routes']
) {
  const history = createHybridHistory({ host: container.host, codec })
  const router = createSparklingRouter({ manifest, history, routes })
  await router.push(history.location) // initial navigation (install does this)
  return router
}

const mainRoutes = [
  { path: '/', component: Page },
  { path: '/main/nested', component: Page },
]
const detailRoutes = [{ path: '/detail/:id', name: 'detail', component: Page }]

function openRoot(env: MemoryNavigationEnvironment) {
  return env.open(codec.encode('/', { depth: 0 })!)
}

describe('createSparklingRouter', () => {
  it('keeps same-bundle navigation local (SPA within the container)', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    await router.push('/main/nested')

    expect(router.currentRoute.value.fullPath).toBe('/main/nested')
    expect(env.stack).toHaveLength(1) // no native navigation happened
  })

  it('runs guards for local navigations', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    const guard = vi.fn(() => true)
    router.beforeEach(guard)
    await router.push('/main/nested')

    expect(guard).toHaveBeenCalledTimes(1)
  })

  it('diverts cross-bundle push to a native open', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    await router.push('/detail/42')

    expect(env.stack).toHaveLength(2)
    // the opener's route did NOT change: the page stays alive underneath
    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('does not run local guards for cross-bundle navigations (MPA semantics)', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    const guard = vi.fn(() => true)
    router.beforeEach(guard)
    await router.push('/detail/42')

    expect(guard).not.toHaveBeenCalled()
  })

  it('boots the target page router at the pushed route, running ITS guards', async () => {
    const env = createMemoryNavigationEnvironment()
    const mainRouter = await bootRouter(openRoot(env), mainRoutes)
    await mainRouter.push('/detail/42?tab=posts')

    // ── new heap ──
    const detailContainer = env.top!
    const detailHistory = createHybridHistory({
      host: detailContainer.host,
      codec,
    })
    const detailRouter = createSparklingRouter({
      manifest,
      history: detailHistory,
      routes: detailRoutes,
    })
    const guard = vi.fn(() => true)
    detailRouter.beforeEach(guard)
    await detailRouter.push(detailHistory.location)

    expect(detailRouter.currentRoute.value.fullPath).toBe('/detail/42?tab=posts')
    expect(detailRouter.currentRoute.value.params.id).toBe('42')
    expect(guard).toHaveBeenCalledTimes(1)
  })

  it('supports cross-bundle named routes via the manifest', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    await router.push({ name: 'detail', params: { id: '7' }, query: { ref: 'home' } })

    expect(env.stack).toHaveLength(2)
    const detailHistory = createHybridHistory({ host: env.top!.host, codec })
    expect(detailHistory.location).toBe('/detail/7?ref=home')
  })

  it('replace() swaps the native container for cross-bundle targets', async () => {
    const env = createMemoryNavigationEnvironment()
    openRoot(env)
    const settings = env.open(codec.encode('/settings', { depth: 1 })!)
    const router = await bootRouter(settings, [
      { path: '/settings', component: Page },
    ])

    await router.replace('/detail/1')

    expect(env.stack).toHaveLength(2)
    const top = createHybridHistory({ host: env.top!.host, codec })
    expect(top.location).toBe('/detail/1')
    expect(top.depth).toBe(1)
  })

  it('passes navigation state to the next heap', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    await router.push({ path: '/detail/1', state: { fromList: true } })

    const detailHistory = createHybridHistory({ host: env.top!.host, codec })
    expect(detailHistory.state).toEqual({ fromList: true })
  })

  it('router.back() beyond local history closes the container', async () => {
    const env = createMemoryNavigationEnvironment()
    openRoot(env)
    const detail = env.open(codec.encode('/detail/5', { depth: 1 })!)
    const router = await bootRouter(detail, detailRoutes)

    router.back()

    expect(env.stack).toHaveLength(1)
  })

  it('exposes the hybrid history for restore hooks', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    const restore = vi.fn()
    router.hybridHistory.onRestore(restore)

    await router.push('/detail/1')
    expect(restore).toHaveBeenCalledWith({ visible: false })

    const detailHistory = createHybridHistory({ host: env.top!.host, codec })
    detailHistory.go(-1)
    expect(restore).toHaveBeenLastCalledWith({ visible: true })
  })

  it('rejects unknown named routes with vue-router error (not a native open)', async () => {
    const env = createMemoryNavigationEnvironment()
    const router = await bootRouter(openRoot(env), mainRoutes)

    // vue-router throws synchronously for unresolvable names
    expect(() => router.push({ name: 'does-not-exist' })).toThrow(/No match/)
    expect(env.stack).toHaveLength(1)
  })
})
