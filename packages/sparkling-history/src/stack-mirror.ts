// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NavigationHost, StackChangedEvent } from './types.js';

export interface StackMirrorSnapshot {
  /** Last known native stack depth (seeded from the host's launch depth). */
  depth: number;
  /** The most recent stack event, if any arrived since boot. */
  lastEvent?: StackChangedEvent;
  /** The most recent pop result observed, if any. */
  lastResult?: unknown;
}

export interface StackMirror {
  /** Whether the host actually broadcasts stack events. */
  readonly live: boolean;
  getSnapshot(): StackMirrorSnapshot;
  /** `useSyncExternalStore`-compatible subscription. */
  subscribe(onChange: () => void): () => void;
  destroy(): void;
}

/**
 * A read-only, subscribable mirror of the native stack, fed by the host's
 * event face. This is the "global stack state" object — deliberately
 * separate from the per-page history/router, which only knows this page's
 * in-page entries.
 *
 * On hosts without an event face (today's sparkling binding), the mirror is
 * static: it reports the launch depth and `live: false`, so UI can
 * feature-detect and degrade.
 */
export function createStackMirror(host: NavigationHost): StackMirror {
  let snapshot: StackMirrorSnapshot = { depth: host.getStackDepth?.() ?? 0 };
  const listeners = new Set<() => void>();

  const unsubscribe = host.subscribeStack?.((event) => {
    snapshot = {
      depth: event.depth,
      lastEvent: event,
      lastResult: event.result !== undefined ? event.result : snapshot.lastResult,
    };
    listeners.forEach((l) => l());
  });

  return {
    live: unsubscribe !== undefined,
    getSnapshot: () => snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    destroy() {
      unsubscribe?.();
      listeners.clear();
    },
  };
}
