// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Headless ports of high-signal cases from:
 * - packages/react-router/tests/useNavigate.test.tsx
 * - packages/react-router/tests/router.test.tsx
 * - packages/react-router/tests/useParams.test.tsx
 *
 * Driven via router.navigate / router.state (no DOM / RTL).
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  createCompositeRouter,
  createHeadlessRouter,
  resetMirror,
  settle,
} from './helpers'

describe('upstream/react-router navigate (headless, memory)', () => {
  test('navigating to /posts', async () => {
    const { router } = createHeadlessRouter('/')
    await router.load()
    await router.navigate({ to: '/posts' })
    expect(router.state.location.pathname).toBe('/posts')
  })

  test('navigating to /posts/$postId with params', async () => {
    const { router } = createHeadlessRouter('/')
    await router.load()
    await router.navigate({ to: '/posts/$postId', params: { postId: 'id1' } })
    expect(router.state.location.pathname).toBe('/posts/id1')
    const match = router.state.matches.find((m) => m.routeId.includes('postId'))
    expect(match?.params).toMatchObject({ postId: 'id1' })
  })

  test('navigating with search params', async () => {
    const { router } = createHeadlessRouter('/')
    await router.load()
    await router.navigate({ to: '/about', search: { from: 'index' } })
    expect(router.state.location.pathname).toBe('/about')
    expect(router.state.location.search).toMatchObject({ from: 'index' })
  })

  test('replace navigation does not grow history', async () => {
    const { router, history } = createHeadlessRouter('/')
    await router.load()
    await router.navigate({ to: '/posts' })
    const len = history.length
    await router.navigate({ to: '/about', replace: true })
    expect(router.state.location.pathname).toBe('/about')
    expect(history.length).toBe(len)
  })

  test('back after soft navigations', async () => {
    const { router, history } = createHeadlessRouter('/')
    await router.load()
    await router.navigate({ to: '/posts' })
    await router.navigate({ to: '/posts/$postId', params: { postId: '9' } })
    history.back()
    await settle(0)
    expect(history.location.pathname).toBe('/posts')
  })

  test('emoji / unicode path params (router.test encoding sample)', async () => {
    const { router } = createHeadlessRouter('/')
    await router.load()
    await router.navigate({ to: '/posts/$postId', params: { postId: '🚀' } })
    expect(router.state.location.pathname).toBe('/posts/🚀')
  })
})

describe('upstream/react-router navigate via CompositeHistory (Sparkling)', () => {
  beforeEach(() => resetMirror())
  afterEach(() => resetMirror())

  test('soft navigations stay in-container', async () => {
    const { router, stack } = createCompositeRouter('/')
    await router.load()
    const before = (await stack.getState()).entries.length
    await router.navigate({ to: '/posts' })
    await router.navigate({ to: '/posts/$postId', params: { postId: '42' } })
    expect(router.state.location.pathname).toBe('/posts/42')
    const after = (await stack.getState()).entries.length
    expect(after).toBe(before)
  })

  test('cross-boundary /settings triggers hard push', async () => {
    const { router, stack } = createCompositeRouter('/')
    await router.load()
    await router.navigate({ to: '/settings' })
    await settle(10)
    const state = await stack.getState()
    expect(state.entries.map((e) => e.bundle)).toContain('settings')
  })

  test('soft back then hard pop at subtree root', async () => {
    const home = createCompositeRouter('/')
    await home.stack.push({ path: '/settings' })
    // Soft history at '/' cannot go back; canGoBack should still be true via stack depth.
    expect(home.history.canGoBack()).toBe(true)
    home.history.back()
    await settle(10)
    const state = await home.stack.getState()
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0]!.bundle).toBe('home')
  })

  test('search params round-trip on soft nav', async () => {
    const { router } = createCompositeRouter('/')
    await router.load()
    await router.navigate({ to: '/about', search: { from: 'home' } })
    expect(router.state.location.search).toMatchObject({ from: 'home' })
  })
})
