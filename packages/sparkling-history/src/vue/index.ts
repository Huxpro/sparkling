// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createRouter,
  type NavigationFailure,
  type RouteLocationRaw,
  type Router,
  type RouterHistory,
  type RouterOptions,
} from 'vue-router'
import { createHybridHistory } from '../history'
import { createSparklingSchemeCodec } from '../codec'
import {
  fillPattern,
  findByName,
  type RouteManifest,
} from '../manifest'
import type {
  HistoryState,
  HybridRouterHistory,
  NavigationHost,
  SchemeCodec,
} from '../types'
import { createSparklingNavigationHost } from '../hosts/sparkling'

/**
 * vue-router adapter.
 *
 * `createSparklingRouter` builds a standard vue-router `Router` whose history
 * is a {@link HybridRouterHistory}. Navigations that stay within this page
 * bundle behave exactly like a normal (memory-history) vue-router SPA:
 * nested routes, guards, `router-view` — everything runs in this heap.
 *
 * Navigations that RESOLVE TO A ROUTE OWNED BY ANOTHER PAGE BUNDLE (per the
 * shared route manifest) are diverted to the platform: `router.push('/x')`
 * becomes a sparkling `router.open` that stacks a new native container. The
 * current page keeps its state underneath — this is MPA navigation, so the
 * local router does NOT transition (its guards do not run for the new page;
 * the new page's own router runs its own guards on startup, exactly like a
 * fresh document would in a browser MPA).
 */

export interface SparklingRouterOptions extends Omit<RouterOptions, 'history'> {
  /** The shared route manifest (generated via `sparkling-history/codegen`). */
  manifest: RouteManifest
  /** Platform host. Defaults to the Sparkling container host. */
  host?: NavigationHost
  /** URL codec. Defaults to the sparkling scheme codec over `manifest`. */
  codec?: SchemeCodec
  /** Pre-built history. Overrides `host`/`codec` when provided. */
  history?: HybridRouterHistory
}

export interface SparklingRouter extends Router {
  /** The underlying hybrid history, exposing `depth`, `onRestore`, etc. */
  readonly hybridHistory: HybridRouterHistory
}

export function createSparklingRouter(
  options: SparklingRouterOptions
): SparklingRouter {
  const { manifest, host, codec, history, ...routerOptions } = options

  const resolvedCodec =
    codec ?? createSparklingSchemeCodec(manifest)
  const resolvedHistory =
    history ??
    createHybridHistory({
      host:
        host ??
        createSparklingNavigationHost({ scheme: manifest.scheme }),
      codec: resolvedCodec,
    })

  const router = createRouter({
    ...routerOptions,
    // HybridRouterHistory is structurally compatible with RouterHistory;
    // the cast bridges vue-router's enum-typed NavigationInformation.
    history: resolvedHistory as unknown as RouterHistory,
  }) as SparklingRouter

  Object.defineProperty(router, 'hybridHistory', {
    enumerable: true,
    get: () => resolvedHistory,
  })

  const ownBundle = resolvedHistory.bundle

  /**
   * Resolve `to` far enough to decide ownership. Returns null when the
   * navigation should stay local (own bundle, unknown routes, hash-only...).
   */
  function resolveCrossPage(
    to: RouteLocationRaw
  ): { fullPath: string; state?: HistoryState } | null {
    let fullPath: string | null = null
    let state: HistoryState | undefined

    if (typeof to === 'object' && to !== null) {
      state = (to as { state?: HistoryState }).state
    }

    // Named route living in another bundle: local matcher can't resolve it,
    // so fill the pattern straight from the manifest.
    const name = typeof to === 'object' && to && 'name' in to ? to.name : null
    if (name != null && !router.hasRoute(name as never)) {
      const named = findByName(manifest, String(name))
      if (named && named.page.bundle !== ownBundle) {
        const target = to as {
          params?: Record<string, string | number>
          query?: Record<string, unknown>
          hash?: string
        }
        fullPath = fillPattern(named.pattern, target.params)
        const query = stringifyQuery(target.query)
        if (query) fullPath += '?' + query
        if (target.hash) fullPath += target.hash
        return { fullPath, state }
      }
      return null // unknown name: let vue-router throw its usual error
    }

    let resolved
    try {
      resolved = router.resolve(to)
    } catch {
      return null
    }
    const owner = resolvedCodec.ownerOf(resolved.fullPath)
    if (owner === null || owner === ownBundle) return null
    return { fullPath: resolved.fullPath, state }
  }

  const originalPush = router.push.bind(router)
  const originalReplace = router.replace.bind(router)

  router.push = (to: RouteLocationRaw) => {
    const crossPage = resolveCrossPage(to)
    if (crossPage) {
      return resolvedHistory
        .pushExternal(crossPage.fullPath, crossPage.state)
        .then(() => undefined as unknown as NavigationFailure | void)
    }
    return originalPush(to)
  }

  router.replace = (to: RouteLocationRaw) => {
    const crossPage = resolveCrossPage(to)
    if (crossPage) {
      return resolvedHistory
        .pushExternal(crossPage.fullPath, crossPage.state, { replace: true })
        .then(() => undefined as unknown as NavigationFailure | void)
    }
    return originalReplace(to)
  }

  return router
}

function stringifyQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  return Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const values = Array.isArray(value) ? value : [value]
      return values
        .map(
          v =>
            `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`
        )
        .join('&')
    })
    .join('&')
}
