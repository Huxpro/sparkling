// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callStackMethodRaw } from './call';
import type { StackState } from './types';

export function getState(): Promise<StackState> {
  return callStackMethodRaw('router.stack.getState', {}).then((raw) => {
    const state = raw as StackState
    if (!state || typeof state.version !== 'number' || !Array.isArray(state.entries)) {
      return { version: 0, entries: [] }
    }
    return state
  })
}
