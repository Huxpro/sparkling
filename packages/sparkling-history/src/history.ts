// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  HistoryLocation,
  HistoryState,
  HybridRouterHistory,
  NavigationCallback,
  NavigationDirection,
  NavigationHost,
  NavigationInformation,
  SchemeCodec,
} from './types'

export interface HybridHistoryOptions {
  host: NavigationHost
  codec: SchemeCodec
  /**
   * Base prepended to hrefs of locations no page owns. Kept for
   * RouterHistory compatibility; sparkling schemes ignore it. Default `''`.
   */
  base?: string
  /** Fallback location when the initial URL cannot be decoded. Default `/`. */
  fallbackLocation?: HistoryLocation
}

/**
 * A history for one container (one JS heap) of an MPA-style hybrid app.
 *
 * Within the container it behaves like vue-router's memory history — pushes
 * and replaces mutate a local queue, `go()` walks it and notifies listeners
 * (the `popstate` equivalent). At the container boundary it delegates to the
 * {@link NavigationHost}:
 *
 * - `pushExternal()` opens ANOTHER container via the host (native push)
 * - `go(-n)` beyond the local queue pops native containers via `host.close`
 * - the initial location/state/depth are decoded from `host.initialUrl`,
 *   which is how a fresh heap joins a navigation session it shares with
 *   other heaps only through URLs.
 */
export function createHybridHistory(
  options: HybridHistoryOptions
): HybridRouterHistory {
  const { host, codec } = options
  // normalize like vue-router: no trailing slash, so `base + fullPath` works
  const base = (options.base ?? '').replace(/\/+$/, '')

  const decoded = codec.decode(host.initialUrl)
  const initialLocation =
    decoded?.location ?? options.fallbackLocation ?? '/'
  const depth = decoded?.depth ?? 0
  const bundle = decoded?.bundle ?? codec.ownerOf(initialLocation)

  let listeners: NavigationCallback[] = []
  let restoreListeners: Array<(info: { visible: boolean }) => void> = []
  let queue: Array<[url: HistoryLocation, state: HistoryState]> = [
    [initialLocation, decoded?.state ?? {}],
  ]
  let position = 0
  let teardownVisibility: (() => void) | undefined

  function setLocation(location: HistoryLocation, state: HistoryState = {}) {
    position++
    if (position !== queue.length) {
      // we are in the middle: drop the forward part of the queue
      queue.splice(position)
    }
    queue.push([location, state])
  }

  function triggerListeners(
    to: HistoryLocation,
    from: HistoryLocation,
    { direction, delta }: Pick<NavigationInformation, 'direction' | 'delta'>
  ): void {
    const info: NavigationInformation = { direction, delta, type: 'pop' }
    for (const callback of listeners.slice()) {
      callback(to, from, info)
    }
  }

  function ensureVisibilitySubscription() {
    if (teardownVisibility || !host.onVisibilityChange) return
    teardownVisibility = host.onVisibilityChange(visible => {
      for (const callback of restoreListeners.slice()) {
        callback({ visible })
      }
    })
  }

  const routerHistory: HybridRouterHistory = {
    // rewritten by Object.defineProperty below
    location: initialLocation,
    // rewritten by Object.defineProperty below
    state: {},
    base,
    depth,
    bundle,

    createHref(to) {
      return codec.encode(to, { depth: depth + 1 }) ?? base + to
    },

    push(to, state?: HistoryState) {
      setLocation(to, state)
    },

    replace(to, state?: HistoryState) {
      queue.splice(position--, 1)
      setLocation(to, state)
    },

    go(delta, shouldTrigger = true) {
      const from = this.location
      const target = position + delta

      if (target < 0) {
        // Crossing the container boundary backwards: pop native containers.
        // Each container counts as ONE entry regardless of its local queue.
        // No listeners fire — this container is about to be dismissed, the
        // revealed container gets a restore (pageshow-like) event instead.
        position = 0
        const count = -target
        void host.close({ count }).catch(err => {
          console.error('[sparkling-history] host.close failed:', err)
        })
        return
      }

      if (target > queue.length - 1) {
        console.warn(
          `[sparkling-history] go(${delta}) exceeds the local history queue. ` +
            'Forward navigation cannot re-enter closed containers (MPA limitation); clamping.'
        )
      }

      const direction: NavigationDirection = delta < 0 ? 'back' : 'forward'
      position = Math.max(0, Math.min(target, queue.length - 1))
      if (shouldTrigger) {
        triggerListeners(this.location, from, { direction, delta })
      }
    },

    pushExternal(to, data?: HistoryState, opts?: { replace?: boolean }) {
      const replace = opts?.replace ?? false
      const url = codec.encode(to, {
        state: data,
        depth: replace ? depth : depth + 1,
      })
      if (!url) {
        return Promise.reject(
          new Error(
            `[sparkling-history] no page in the route manifest owns "${to}"`
          )
        )
      }
      return host.open(url, { replace })
    },

    listen(callback) {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      }
    },

    onRestore(callback) {
      ensureVisibilitySubscription()
      restoreListeners.push(callback)
      return () => {
        const index = restoreListeners.indexOf(callback)
        if (index > -1) restoreListeners.splice(index, 1)
      }
    },

    destroy() {
      listeners = []
      restoreListeners = []
      teardownVisibility?.()
      teardownVisibility = undefined
      queue = [[initialLocation, {}]]
      position = 0
    },
  }

  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => queue[position][0],
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => queue[position][1],
  })

  return routerHistory
}
