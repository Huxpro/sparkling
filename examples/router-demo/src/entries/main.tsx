// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import 'url-search-params-polyfill'
import { root } from '@lynx-js/react'
import {
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  createSparklingHistory,
  resolveContainerIdentity,
  type RouteManifest,
} from 'sparkling-router'
import { routeTree } from '../routeTree.gen'
import manifestJson from '../route-manifest.gen.json'
import '../styles.css'

const manifest = manifestJson as RouteManifest

// S0 runs the full route tree in one container with an in-memory stack.
// Cross-boundary navigations are exercised in unit tests / later native S4.
const runtime = createSparklingHistory({
  manifest,
  container: {
    bundle: 'main',
    ownedRoutes: manifest.containers.flatMap((c) => c.routes.map((r) => r.path)),
    presentation: 'push',
  },
  memoryStack: true,
  queryItems:
    typeof lynx !== 'undefined'
      ? (lynx as { __globalProps?: { queryItems?: Record<string, string> } }).__globalProps
          ?.queryItems
      : undefined,
})

const router = createRouter({
  routeTree,
  history: runtime.history,
  isServer: false,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

void resolveContainerIdentity

root.render(<RouterProvider router={router} />)
