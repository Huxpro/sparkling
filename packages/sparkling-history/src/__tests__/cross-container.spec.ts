// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Cross-container (MPA) behavior: each container is a separate JS heap in
 * production. The memory environment simulates the native stack; a fresh
 * HybridHistory is created per container from nothing but its URL — the
 * same constraint real heaps have.
 */

import { describe, expect, it, vi } from 'vitest'
import { createHybridHistory } from '../history'
import { createSparklingSchemeCodec } from '../codec'
import { defineRouteManifest } from '../manifest'
import {
  createMemoryNavigationEnvironment,
  type SimulatedContainer,
} from '../hosts/memory'

const manifest = defineRouteManifest({
  pages: [
    { bundle: 'main', routes: ['/'] },
    { bundle: 'detail', routes: [{ path: '/detail/:id', name: 'detail' }] },
    { bundle: 'settings', routes: ['/settings', '/settings/about'], params: { hide_nav_bar: true } },
  ],
})
const codec = createSparklingSchemeCodec(manifest)

function historyFor(container: SimulatedContainer) {
  return createHybridHistory({ host: container.host, codec })
}

describe('cross-container navigation', () => {
  it('pushExternal stacks a new container without touching local history', async () => {
    const env = createMemoryNavigationEnvironment()
    const root = env.open(codec.encode('/', { depth: 0 })!)
    const history = historyFor(root)

    await history.pushExternal('/detail/42')

    // native stack grew...
    expect(env.stack).toHaveLength(2)
    // ...but the opener's local history did not move (MPA semantics)
    expect(history.location).toBe('/')

    // the new heap reconstructs its history purely from its URL
    const detailHistory = historyFor(env.top!)
    expect(detailHistory.location).toBe('/detail/42')
    expect(detailHistory.depth).toBe(1)
    expect(detailHistory.bundle).toBe('detail')
  })

  it('passes history state across heaps through the URL', async () => {
    const env = createMemoryNavigationEnvironment()
    const root = env.open(codec.encode('/', { depth: 0 })!)
    const history = historyFor(root)

    await history.pushExternal('/detail/1', { from: 'home', count: 2 })

    const detailHistory = historyFor(env.top!)
    expect(detailHistory.state).toEqual({ from: 'home', count: 2 })
  })

  it('pushExternal with replace swaps the current container', async () => {
    const env = createMemoryNavigationEnvironment()
    env.open(codec.encode('/', { depth: 0 })!)
    const second = env.open(codec.encode('/settings', { depth: 1 })!)
    const history = historyFor(second)

    await history.pushExternal('/detail/9', undefined, { replace: true })

    expect(env.stack).toHaveLength(2)
    const replacedHistory = historyFor(env.top!)
    expect(replacedHistory.location).toBe('/detail/9')
    // replace keeps the depth of the replaced container
    expect(replacedHistory.depth).toBe(1)
  })

  it('rejects pushExternal for routes no page owns', async () => {
    const env = createMemoryNavigationEnvironment()
    const root = env.open(codec.encode('/', { depth: 0 })!)
    const history = historyFor(root)

    await expect(history.pushExternal('/nowhere')).rejects.toThrow(
      /no page in the route manifest owns/
    )
    expect(env.stack).toHaveLength(1)
  })

  it('go(-n) crossing the boundary pops native containers', async () => {
    const env = createMemoryNavigationEnvironment()
    const root = env.open(codec.encode('/', { depth: 0 })!)
    await historyFor(root).pushExternal('/settings')
    const settings = env.top!
    const settingsHistory = historyFor(settings)

    // two local entries + the container itself
    settingsHistory.push('/settings/about')
    expect(settingsHistory.location).toBe('/settings/about')

    // -1 consumed locally, remaining -1 pops the container
    settingsHistory.go(-2)
    expect(env.stack).toHaveLength(1)
    expect(env.top!).toBe(root)
  })

  it('restore fires when a covering container closes (pageshow-like)', async () => {
    const env = createMemoryNavigationEnvironment()
    const root = env.open(codec.encode('/', { depth: 0 })!)
    const rootHistory = historyFor(root)

    const restoreSpy = vi.fn()
    rootHistory.onRestore(restoreSpy)

    await rootHistory.pushExternal('/detail/1')
    expect(restoreSpy).toHaveBeenCalledWith({ visible: false })

    const detailHistory = historyFor(env.top!)
    detailHistory.go(-1) // closes the detail container

    expect(restoreSpy).toHaveBeenLastCalledWith({ visible: true })
    // the revealed container's own location never changed — no popstate,
    // matching browser MPA semantics (bfcache restore fires pageshow)
    expect(rootHistory.location).toBe('/')
  })
})

describe('scheme codec', () => {
  it('encodes owned routes with bundle + route + depth', () => {
    const url = codec.encode('/detail/42?tab=posts#bio', { depth: 3 })!
    expect(url).toContain('bundle=detail.lynx.bundle')
    expect(url).toContain('__hs_depth=3')
    expect(url).toContain(encodeURIComponent('/detail/42?tab=posts#bio'))
  })

  it('appends per-page container params from the manifest', () => {
    const url = codec.encode('/settings')!
    expect(url).toContain('hide_nav_bar=true')
  })

  it('returns null for unowned routes', () => {
    expect(codec.encode('/nope')).toBeNull()
    expect(codec.ownerOf('/nope')).toBeNull()
  })

  it('round-trips locations losslessly', () => {
    const location = '/detail/hello%20world?q=a%26b#frag'
    const decoded = codec.decode(codec.encode(location, { depth: 1 })!)
    expect(decoded?.location).toBe(location)
    expect(decoded?.depth).toBe(1)
  })

  it('decodes plain deeplinks to the page default route with extras', () => {
    const decoded = codec.decode(
      'hybrid://lynxview_page?bundle=settings.lynx.bundle&ref=push&title=Settings'
    )
    // `title` is a reserved container param; `ref` forwards to the route
    expect(decoded?.location).toBe('/settings?ref=push')
    expect(decoded?.bundle).toBe('settings')
  })

  it('decodes dev-server url= deeplinks', () => {
    const decoded = codec.decode(
      'hybrid://lynxview_page?url=http%3A%2F%2Flocalhost%3A5969%2Fdetail.lynx.bundle'
    )
    expect(decoded?.bundle).toBe('detail')
    // dynamic-only page has no static default: falls back to '/'
    expect(decoded?.location).toBe('/')
  })

  it('returns null for undecodable urls', () => {
    expect(codec.decode('hybrid://lynxview_page?foo=1')).toBeNull()
  })
})
