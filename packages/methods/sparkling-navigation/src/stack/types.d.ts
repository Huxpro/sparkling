// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** One hard-navigation entry = one native container. */
export interface StackEntry {
  id: string
  path: string
  search: Record<string, string>
  bundle: string
  presentation: 'push' | 'modal'
}

export interface StackState {
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
  result?: { forEntryId: string; value: unknown }
}

export interface StackPushRequest {
  path: string
  search?: Record<string, string>
  presentation?: 'push' | 'modal'
  usePrefetched?: boolean
  animated?: boolean
}

export interface StackPopRequest {
  result?: unknown
  animated?: boolean
}

export interface StackPopToRequest {
  entryId: string
  animated?: boolean
}

export interface StackReplaceRequest {
  path: string
  search?: Record<string, string>
}

export interface StackResetRequest {
  entries: Array<{
    path: string
    search?: Record<string, string>
    presentation?: 'push' | 'modal'
  }>
}

export interface StackPrefetchRequest {
  path: string
  search?: Record<string, string>
}

export interface StackSyncOwnLocationRequest {
  path: string
  search: Record<string, string>
}

export interface NativeStackProtocol {
  push(req: StackPushRequest): Promise<NavResult>
  pop(req?: StackPopRequest): Promise<NavResult>
  popTo(req: StackPopToRequest): Promise<NavResult>
  replace(req: StackReplaceRequest): Promise<NavResult>
  reset(req: StackResetRequest): Promise<NavResult>
  getState(): Promise<StackState>
  prefetch(req: StackPrefetchRequest): Promise<{ code: number; msg?: string }>
  syncOwnLocation(req: StackSyncOwnLocationRequest): void
}

/** Global event name broadcast to all live containers. */
export declare const STACK_CHANGED_EVENT: 'sparklingStackChanged'
