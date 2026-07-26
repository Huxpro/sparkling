// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  getState as navGetState,
  pop as navPop,
  popTo as navPopTo,
  prefetch as navPrefetch,
  push as navPush,
  replace as navReplace,
  reset as navReset,
  subscribeStackChanged,
  syncOwnLocation as navSyncOwnLocation,
  type NativeStackProtocol as NavProtocol,
  type StackChangedEvent as NavStackChangedEvent,
  type StackState as NavStackState,
} from 'sparkling-navigation'
import { getGlobalStackMirror } from './global-stack-mirror.js'
import type { NativeStackProtocol, StackChangedEvent, StackState } from './types.js'

/**
 * Pipe-backed NativeStackProtocol that talks to sparkling-navigation stack methods.
 * Also wires stack-changed events into GlobalStackMirror.
 */
export function createPipeStackProtocol(): NativeStackProtocol {
  let unsubscribe: (() => void) | undefined

  const ensureSubscription = () => {
    if (unsubscribe) {
      return
    }
    try {
      unsubscribe = subscribeStackChanged((event: NavStackChangedEvent) => {
        getGlobalStackMirror().apply(event as StackChangedEvent)
      })
    } catch {
      // Lynx GlobalEventEmitter unavailable (unit tests / web without polyfill).
    }
  }

  ensureSubscription()

  const protocol: NativeStackProtocol = {
    push: (req) => navPush(req),
    pop: (req) => navPop(req),
    popTo: (req) => navPopTo(req),
    replace: (req) => navReplace(req),
    reset: (req) => navReset(req),
    getState: async () => {
      const state = (await navGetState()) as NavStackState
      return state as StackState
    },
    prefetch: (req) => navPrefetch(req),
    syncOwnLocation: (req) => {
      navSyncOwnLocation(req)
    },
  }

  // Retain type alignment with navigation package protocol.
  void (protocol as unknown as NavProtocol)

  return protocol
}
