// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createCompositeHistory } from '../composite-history'
import { __setGlobalStackMirrorForTests, GlobalStackMirror } from '../global-stack-mirror'
import { createInMemoryStackProtocol } from '../in-memory-stack'
import type { RouteManifest } from '../types'

const manifest: RouteManifest = {
  version: '1',
  scheme: { base: 'hybrid://lynxview_page' },
  containers: [
    {
      bundle: 'home',
      presentation: 'push',
      routes: [{ path: '/' }],
    },
    {
      bundle: 'feed',
      presentation: 'push',
      routes: [{ path: '/feed' }, { path: '/feed/$postId' }],
    },
  ],
}

describe('createCompositeHistory', () => {
  beforeEach(() => {
    __setGlobalStackMirrorForTests(new GlobalStackMirror())
  })

  afterEach(() => {
    __setGlobalStackMirrorForTests(undefined)
  })

  it('keeps in-container navigations soft (memory)', async () => {
    const stack = createInMemoryStackProtocol({
      manifest,
      initial: { path: '/feed' },
    })
    const history = createCompositeHistory({
      container: {
        bundle: 'feed',
        ownedRoutes: ['/feed', '/feed/$postId'],
        presentation: 'push',
      },
      manifest,
      stack,
      initialEntries: ['/feed'],
    })

    const before = (await stack.getState()).entries.length
    history.push('/feed/42')
    expect(history.location.pathname).toBe('/feed/42')
    const after = (await stack.getState()).entries.length
    expect(after).toBe(before)

    history.destroy()
  })

  it('translates cross-boundary push into stack protocol', async () => {
    const stack = createInMemoryStackProtocol({
      manifest,
      initial: { path: '/' },
    })
    const history = createCompositeHistory({
      container: {
        bundle: 'home',
        ownedRoutes: ['/'],
        presentation: 'push',
      },
      manifest,
      stack,
      initialEntries: ['/'],
    })

    history.push('/feed')
    // allow microtask for async protocol
    await new Promise((r) => setTimeout(r, 0))
    const state = await stack.getState()
    expect(state.entries.map((e) => e.bundle)).toEqual(['home', 'feed'])

    history.destroy()
  })

  it('pops native stack when soft history is exhausted', async () => {
    const stack = createInMemoryStackProtocol({
      manifest,
      initial: { path: '/' },
    })
    await stack.push({ path: '/feed' })

    const history = createCompositeHistory({
      container: {
        bundle: 'feed',
        ownedRoutes: ['/feed', '/feed/$postId'],
        presentation: 'push',
      },
      manifest,
      stack,
      initialEntries: ['/feed'],
    })

    expect(history.canGoBack()).toBe(true)
    history.back()
    await new Promise((r) => setTimeout(r, 0))
    const state = await stack.getState()
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0]!.bundle).toBe('home')

    history.destroy()
  })
})
