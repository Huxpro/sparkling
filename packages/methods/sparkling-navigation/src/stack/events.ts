// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import pipe from 'sparkling-method';
import type { StackChangedEvent } from './types';

export const STACK_CHANGED_EVENT = 'sparklingStackChanged' as const

export type StackChangedListener = (event: StackChangedEvent) => void

/**
 * Subscribe to global stack-changed broadcasts.
 * Reuses the Lynx GlobalEventEmitter channel (same path as pageFinishBackEvent).
 */
export function subscribeStackChanged(listener: StackChangedListener): () => void {
  const wrapped = (payload: unknown) => {
    listener(normalizeStackChangedEvent(payload))
  }
  pipe.on(STACK_CHANGED_EVENT, wrapped)
  return () => {
    pipe.off(STACK_CHANGED_EVENT, wrapped)
  }
}

function normalizeStackChangedEvent(payload: unknown): StackChangedEvent {
  const raw = (payload ?? {}) as Partial<StackChangedEvent>
  return {
    state: {
      version: raw.state?.version ?? 0,
      entries: Array.isArray(raw.state?.entries) ? raw.state!.entries : [],
    },
    reason: raw.reason ?? 'system',
    result: raw.result,
  }
}
