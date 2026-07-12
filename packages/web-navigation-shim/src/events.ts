// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ShimEventListener } from './types';

/**
 * Minimal EventTarget replacement. Lynx JS contexts do not guarantee a
 * global `EventTarget`, and the shim only needs add/remove/dispatch with
 * string types — no capture, bubbling, or `once` options.
 */
export class SimpleEventTarget {
  private listeners = new Map<string, Set<ShimEventListener>>();

  addEventListener(type: string, listener: ShimEventListener | null | undefined): void {
    if (typeof listener !== 'function') return;
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: ShimEventListener | null | undefined): void {
    if (typeof listener !== 'function') return;
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string }): boolean {
    const set = this.listeners.get(event.type);
    if (!set) return true;
    // Copy: listeners may unregister themselves while we iterate.
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch (error) {
        // Mirror browser behavior: one broken listener must not stop the rest.
        // eslint-disable-next-line no-console
        console.error('[web-navigation-shim] listener error:', error);
      }
    }
    return true;
  }

  hasListeners(type: string): boolean {
    return (this.listeners.get(type)?.size ?? 0) > 0;
  }
}
