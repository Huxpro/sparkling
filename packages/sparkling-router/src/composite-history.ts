// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createMemoryHistory,
  type NavigateOptions,
  type RouterHistory,
} from '@tanstack/history'
import { getGlobalStackMirror } from './global-stack-mirror.js'
import { isPathOwnedBy, parseSearch, splitHref } from './path-match.js'
import type {
  ContainerIdentity,
  NativeStackProtocol,
  RouteManifest,
  StackChangedEvent,
} from './types.js'

export interface CompositeHistoryOptions {
  /** Identity of the container that owns this history instance. */
  container: ContainerIdentity
  /** Global route manifest used to classify soft vs hard navigation. */
  manifest: RouteManifest
  /** Stack protocol implementation (pipe-backed or in-memory). */
  stack: NativeStackProtocol
  /** Soft-nav bootstrap location (usually from `__path` queryItems). */
  initialEntries?: string[]
  /**
   * Gesture / hardware back = native pop of the whole container (iOS-like).
   * Soft `history.back()` still pops memory first, then native when at subtree root.
   * Default: true (RFC §10 Q1 tendency).
   */
  gesturePopsContainer?: boolean
}

/**
 * TanStack `RouterHistory` that delegates in-container navigations to memory
 * history (soft) and cross-boundary navigations to the native stack protocol (hard).
 */
export function createCompositeHistory(options: CompositeHistoryOptions): RouterHistory {
  const ownedRoutes =
    options.container.ownedRoutes.length > 0
      ? options.container.ownedRoutes
      : options.manifest.containers.find((c) => c.bundle === options.container.bundle)?.routes.map(
          (r) => r.path,
        ) ?? []

  const memory = createMemoryHistory({
    initialEntries: options.initialEntries?.length ? options.initialEntries : ['/'],
  })

  const subscribers = new Set<
    (opts: { location: RouterHistory['location']; action: any }) => void
  >()

  let destroyed = false
  let syncTimer: ReturnType<typeof setTimeout> | undefined

  const isSoft = (href: string): boolean => {
    const { pathname } = splitHref(href)
    return isPathOwnedBy(pathname, ownedRoutes)
  }

  const scheduleSyncOwnLocation = () => {
    if (syncTimer) {
      clearTimeout(syncTimer)
    }
    // Coalesce rapid soft navigations into one native write-back.
    syncTimer = setTimeout(() => {
      if (destroyed) {
        return
      }
      const { pathname, search } = splitHref(memory.location.href)
      options.stack.syncOwnLocation({
        path: pathname,
        search: parseSearch(search),
      })
    }, 0)
  }

  const notify = (action: { type: string; index?: number }) => {
    const payload = { location: memory.location, action }
    for (const cb of subscribers) {
      cb(payload)
    }
  }

  // Keep CompositeHistory subscribers in sync with soft memory changes.
  const unsubMemory = memory.subscribe(({ action }) => {
    notify(action)
    scheduleSyncOwnLocation()
  })

  const unsubMirror = getGlobalStackMirror().subscribe((event: StackChangedEvent) => {
    if (destroyed) {
      return
    }
    // Native-initiated pops (gesture / back button) — converge local state.
    if (
      event.reason === 'user-back-gesture' ||
      event.reason === 'user-back-button' ||
      event.reason === 'system' ||
      event.reason === 'pop' ||
      event.reason === 'reset'
    ) {
      const top = event.state.entries[event.state.entries.length - 1]
      if (!top || top.bundle !== options.container.bundle) {
        // This container is no longer on top (or gone). Soft history stays;
        // the Lynx runtime will be torn down with the native container.
        return
      }
      const targetHref = `${top.path}${serializeSearchLocal(top.search)}`
      if (memory.location.href !== targetHref && isSoft(targetHref)) {
        memory.replace(targetHref)
      }
    }
  })

  const history: RouterHistory = {
    get location() {
      return memory.location
    },
    get length() {
      return memory.length
    },
    subscribers,
    subscribe(cb) {
      subscribers.add(cb)
      return () => {
        subscribers.delete(cb)
      }
    },
    push(path: string, state?: any, navigateOpts?: NavigateOptions) {
      if (isSoft(path)) {
        memory.push(path, state, navigateOpts)
        return
      }
      const { pathname, search } = splitHref(path)
      void options.stack.push({
        path: pathname,
        search: parseSearch(search),
        presentation: options.manifest.containers.find((c) =>
          isPathOwnedBy(
            pathname,
            c.routes.map((r) => r.path),
          ),
        )?.presentation,
      })
    },
    replace(path: string, state?: any, navigateOpts?: NavigateOptions) {
      if (isSoft(path)) {
        memory.replace(path, state, navigateOpts)
        return
      }
      const { pathname, search } = splitHref(path)
      void options.stack.replace({
        path: pathname,
        search: parseSearch(search),
      })
    },
    go(index: number, navigateOpts?: NavigateOptions) {
      memory.go(index, navigateOpts)
    },
    back(navigateOpts?: NavigateOptions) {
      // Soft back while memory has depth; otherwise hard pop.
      if (memory.canGoBack()) {
        memory.back(navigateOpts)
        return
      }
      void options.stack.pop({ animated: true })
    },
    forward(navigateOpts?: NavigateOptions) {
      memory.forward(navigateOpts)
    },
    canGoBack() {
      return memory.canGoBack() || getGlobalStackMirror().getState().entries.length > 1
    },
    createHref(href: string) {
      return memory.createHref(href)
    },
    block(blocker) {
      return memory.block(blocker)
    },
    flush() {
      memory.flush()
    },
    destroy() {
      destroyed = true
      if (syncTimer) {
        clearTimeout(syncTimer)
      }
      unsubMemory()
      unsubMirror()
      subscribers.clear()
      memory.destroy()
    },
    notify(action) {
      memory.notify(action)
    },
  }

  // Expose policy for tests / future gesture bridge wiring.
  ;(history as RouterHistory & { __gesturePopsContainer?: boolean }).__gesturePopsContainer =
    options.gesturePopsContainer !== false

  return history
}

function serializeSearchLocal(search: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    params.append(key, value)
  }
  const encoded = params.toString().replace(/\+/g, '%20')
  return encoded ? `?${encoded}` : ''
}
