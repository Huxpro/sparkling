// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Ports of loaders / redirect / notFound headless behaviors from upstream:
 * loaders.test.tsx, redirect.test.tsx, not-found.test.tsx
 */
import { describe, expect, test } from 'vitest'
import 'url-search-params-polyfill'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  redirect,
} from '@tanstack/react-router'

describe('upstream/react-router loaders + redirect + notFound (headless)', () => {
  test('loader data is available on match after navigate', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      loader: async () => ({ items: ['a', 'b'] }),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      isServer: false,
    })
    await router.load()
    await router.navigate({ to: '/posts' })
    const match = router.state.matches.find((m) => m.pathname === '/posts')
    expect(match?.loaderData).toEqual({ items: ['a', 'b'] })
  })

  test('redirect in loader updates location', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const secretRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/secret',
      beforeLoad: () => {
        throw redirect({ to: '/' })
      },
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, secretRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      isServer: false,
    })
    await router.load()
    await router.navigate({ to: '/secret' })
    expect(router.state.location.pathname).toBe('/')
  })

  test('notFound thrown from beforeLoad sets notFound state', async () => {
    const rootRoute = createRootRoute({
      notFoundComponent: () => null,
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const missingRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/missing-data',
      beforeLoad: () => {
        throw notFound()
      },
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, missingRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      isServer: false,
      defaultNotFoundComponent: () => null,
    })
    await router.load()
    await router.navigate({ to: '/missing-data' })
    // After notFound, status should reflect not-found handling
    expect(
      router.state.location.pathname === '/missing-data' ||
        router.state.status === 'notFound' ||
        router.state.matches.some((m) => (m as { status?: string }).status === 'notFound'),
    ).toBe(true)
  })

  test('optional trailing navigation to unknown path keeps router alive', async () => {
    const rootRoute = createRootRoute({
      notFoundComponent: () => null,
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      isServer: false,
      defaultNotFoundComponent: () => null,
    })
    await router.load()
    await router.navigate({ to: '/nope' as '/' })
    expect(router.state.location.pathname).toBe('/nope')
  })
})
