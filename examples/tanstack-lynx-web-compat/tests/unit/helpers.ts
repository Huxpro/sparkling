// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import 'url-search-params-polyfill'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import {
  createCompositeHistory,
  createInMemoryStackProtocol,
  __setGlobalStackMirrorForTests,
  GlobalStackMirror,
  type RouteManifest,
} from 'sparkling-router'

export const FEED_MANIFEST: RouteManifest = {
  version: '1',
  scheme: { base: 'hybrid://lynxview_page' },
  containers: [
    {
      bundle: 'home',
      presentation: 'push',
      routes: [{ path: '/' }, { path: '/about' }, { path: '/posts' }, { path: '/posts/$postId' }],
    },
    {
      bundle: 'settings',
      presentation: 'modal',
      routes: [{ path: '/settings' }],
    },
  ],
}

export function resetMirror() {
  __setGlobalStackMirrorForTests(new GlobalStackMirror())
}

/** Headless TanStack router (upstream-style) with memory history + isServer:false. */
export function createHeadlessRouter(initial = '/') {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    validateSearch: (s: Record<string, unknown>) => ({
      from: typeof s.from === 'string' ? s.from : undefined,
    }),
  })
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
  })
  const postRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/$postId',
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
  })

  const history = createMemoryHistory({ initialEntries: [initial] })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      aboutRoute,
      postsRoute,
      postRoute,
      settingsRoute,
    ]),
    history,
    isServer: false,
  })
  return { router: router as AnyRouter, history }
}

/** Same tree, but history is CompositeHistory (Sparkling soft/hard boundary). */
export function createCompositeRouter(initial = '/') {
  resetMirror()
  const stack = createInMemoryStackProtocol({
    manifest: FEED_MANIFEST,
    initial: { path: '/' },
  })
  const history = createCompositeHistory({
    container: {
      bundle: 'home',
      ownedRoutes: ['/', '/about', '/posts', '/posts/$postId'],
      presentation: 'push',
    },
    manifest: FEED_MANIFEST,
    stack,
    initialEntries: [initial],
  })

  const rootRoute = createRootRoute()
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    validateSearch: (s: Record<string, unknown>) => ({
      from: typeof s.from === 'string' ? s.from : undefined,
    }),
  })
  const postsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/posts' })
  const postRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/$postId',
  })
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      aboutRoute,
      postsRoute,
      postRoute,
      settingsRoute,
    ]),
    history,
    isServer: false,
  })
  return { router: router as AnyRouter, history, stack }
}

export async function settle(ms = 0) {
  await new Promise((r) => setTimeout(r, ms))
}
