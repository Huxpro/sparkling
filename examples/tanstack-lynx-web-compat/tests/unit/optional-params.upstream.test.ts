// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Ports inspired by optional-path-params.test.tsx + useCanGoBack.test.tsx
 */
import { describe, expect, test } from 'vitest'
import 'url-search-params-polyfill'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

describe('upstream/react-router optional params + canGoBack (headless)', () => {
  test('optional path param present and absent', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}',
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      isServer: false,
    })
    await router.load()
    await router.navigate({ to: '/posts/$category', params: { category: 'tech' } as never })
    expect(router.state.location.pathname).toMatch(/\/posts/)
    await router.navigate({ to: '/posts/$category', params: { category: undefined } as never })
    expect(router.state.location.pathname).toContain('/posts')
  })

  test('history.canGoBack mirrors upstream useCanGoBack substrate', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    expect(history.canGoBack()).toBe(false)
    history.push('/a')
    expect(history.canGoBack()).toBe(true)
    history.back()
    expect(history.canGoBack()).toBe(false)
  })

  test('relative navigate to parent', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
    const postsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/posts' })
    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/$postId',
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute, postRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      isServer: false,
    })
    await router.load()
    await router.navigate({ to: '/posts/$postId', params: { postId: '1' } })
    await router.navigate({ to: '..' })
    expect(router.state.location.pathname).toBe('/posts')
  })
})
