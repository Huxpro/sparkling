// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** One hard-navigation entry = one native container. */
export interface StackEntry {
  /** Native-generated stable ID (containerID). */
  id: string
  /** Current URL path for this container (may include soft-nav deep path). */
  path: string
  search: Record<string, string>
  /** Bundle loaded by this container (from manifest). */
  bundle: string
  presentation: 'push' | 'modal'
}

export interface StackState {
  /** Monotonic version for event dedupe / ordering. */
  version: number
  entries: StackEntry[]
}

export type NavResult =
  | { code: 1; entryId: string; msg?: string }
  | { code: number; msg: string; entryId?: string }

export type StackChangeReason =
  | 'push'
  | 'pop'
  | 'replace'
  | 'reset'
  | 'user-back-gesture'
  | 'user-back-button'
  | 'system'
  | 'sync'

export interface StackChangedEvent {
  state: StackState
  reason: StackChangeReason
  /** Pop result routed to the container that initiated the push. */
  result?: { forEntryId: string; value: unknown }
}

export interface NativeStackProtocol {
  push(req: {
    path: string
    search?: Record<string, string>
    presentation?: 'push' | 'modal'
    usePrefetched?: boolean
    animated?: boolean
  }): Promise<NavResult>

  pop(req?: { result?: unknown; animated?: boolean }): Promise<NavResult>
  popTo(req: { entryId: string; animated?: boolean }): Promise<NavResult>
  replace(req: {
    path: string
    search?: Record<string, string>
  }): Promise<NavResult>

  /** Atomically declare the desired stack shape; native diffs to a min push/pop sequence. */
  reset(req: {
    entries: Array<{
      path: string
      search?: Record<string, string>
      presentation?: 'push' | 'modal'
    }>
  }): Promise<NavResult>

  getState(): Promise<StackState>

  /** Pre-create container + preload bundle without presenting. TTL managed by native. */
  prefetch(req: {
    path: string
    search?: Record<string, string>
  }): Promise<{ code: number; msg?: string }>

  /** Soft-nav write-back so the stack mirror matches deep location. */
  syncOwnLocation(req: {
    path: string
    search: Record<string, string>
  }): void
}

export interface RouteManifestContainer {
  bundle: string
  presentation: 'push' | 'modal'
  /** Path prefixes / patterns owned by this container (may include `$param` segments). */
  routes: Array<{ path: string }>
  /** Compiled into scheme query as container options. */
  containerOptions?: Record<string, string>
}

/** Serializable route inventory injected into every bundle. */
export interface RouteManifest {
  /** Skew reserved; v1 writes but does not consume. */
  version: string
  scheme: { base: string }
  containers: RouteManifestContainer[]
}

export interface ContainerIdentity {
  /** Bundle / entry name for the current container. */
  bundle: string
  /** Paths owned by this container (from manifest). */
  ownedRoutes: string[]
  presentation: 'push' | 'modal'
}

export const DEFAULT_SCHEME_BASE = 'hybrid://lynxview_page'
export const STACK_CHANGED_EVENT = 'sparklingStackChanged'
export const PATH_QUERY_KEY = '__path'
