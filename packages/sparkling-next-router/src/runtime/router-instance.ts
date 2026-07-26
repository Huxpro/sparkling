// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { NavigationShim } from 'sparkling-history-shim';
import type { AppRouterInstance, NavigateOptions } from './contexts';

/**
 * Build an AppRouterInstance whose methods are expressed purely in terms of
 * the navigation shim (never the host directly). The shim's UrlResolver
 * decides same-page vs cross-page, so `push`/`replace` are identical here
 * whether the target lives in this container or opens a new one.
 */
export function createRouterInstance(
  shim: NavigationShim,
  hooks: {
    /** Re-derive pathname/searchParams into React state. */
    onUrlChange(): void;
    /** ACTION_REFRESH equivalent: re-render the current tree. */
    onRefresh(): void;
    /** Prefetch a route's bundle/manifest entry (best-effort). */
    onPrefetch?(href: string): void;
    warn(message: string): void;
  },
): AppRouterInstance {
  function assertSafe(href: string): void {
    if (/^\s*javascript:/i.test(href)) {
      throw new Error('sparkling-next-router has blocked a javascript: URL as a security precaution.');
    }
  }

  return {
    push(href: string, _options?: NavigateOptions) {
      assertSafe(href);
      shim.history.pushState(null, '', href);
      hooks.onUrlChange();
    },
    replace(href: string, _options?: NavigateOptions) {
      assertSafe(href);
      shim.history.replaceState(null, '', href);
      hooks.onUrlChange();
    },
    back() {
      shim.history.back();
    },
    forward() {
      shim.history.forward();
    },
    refresh() {
      hooks.onRefresh();
    },
    prefetch(href: string) {
      hooks.onPrefetch?.(href);
    },
  };
}
