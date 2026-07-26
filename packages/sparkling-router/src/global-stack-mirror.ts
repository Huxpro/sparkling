// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { StackChangedEvent, StackState } from './types.js'

export type StackMirrorListener = (event: StackChangedEvent) => void

const EMPTY_STATE: StackState = { version: 0, entries: [] }

/**
 * Read-only mirror of the native navigation stack.
 * Populated by stack-changed events; never mutated by local soft navigation.
 */
export class GlobalStackMirror {
  private state: StackState = EMPTY_STATE
  private readonly listeners = new Set<StackMirrorListener>()

  getState(): StackState {
    return this.state
  }

  subscribe(listener: StackMirrorListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Apply a native (or test) stack-changed event. Ignores stale versions. */
  apply(event: StackChangedEvent): void {
    if (event.state.version < this.state.version) {
      return
    }
    this.state = {
      version: event.state.version,
      entries: event.state.entries.map((entry) => ({
        ...entry,
        search: { ...entry.search },
      })),
    }
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  reset(): void {
    this.state = EMPTY_STATE
    this.listeners.clear()
  }
}

let sharedMirror: GlobalStackMirror | undefined

export function getGlobalStackMirror(): GlobalStackMirror {
  if (!sharedMirror) {
    sharedMirror = new GlobalStackMirror()
  }
  return sharedMirror
}

/** Test helper — replace the process-wide mirror. */
export function __setGlobalStackMirrorForTests(mirror?: GlobalStackMirror): void {
  sharedMirror = mirror
}
