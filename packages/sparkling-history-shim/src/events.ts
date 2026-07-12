// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ShimEvent, ShimEventTarget } from './types';

export function createEventTarget(): ShimEventTarget {
  const listeners = new Map<string, Set<(event: ShimEvent) => void>>();
  return {
    addEventListener(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (!set) return;
      for (const listener of [...set]) {
        try {
          listener(event);
        } catch (err) {
          // Match DOM behavior: a throwing listener must not break the rest.
          // eslint-disable-next-line no-console
          console.error('[sparkling-history-shim] listener error:', err);
        }
      }
    },
  };
}
