// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Runtime glue for `app/router.options.ts`:
 *
 *   import { sparklingHistory, sparklingScrollBehavior } from 'nuxt-sparkling/runtime/history'
 *   import manifest from '#sparkling/route-manifest'
 *   export default {
 *     history: () => sparklingHistory(manifest),
 *     scrollBehavior: sparklingScrollBehavior,
 *   }
 *
 * `sparklingHistory` installs the web-navigation-shim (backed by the
 * Sparkling NavigationHost) onto the current JS context, then returns a
 * vue-router history bound to it. Cross-page `router.push`/`navigateTo`/
 * `<NuxtLink>` navigations become native `router.open` calls; back at the
 * bottom of the in-page stack becomes `router.close`.
 */

import { createNavigationShim } from 'web-navigation-shim';
import type { NavigationShim } from 'web-navigation-shim';
import { createSparklingNavigationHost } from 'sparkling-navigation/shim-host';
import type { SparklingRouteManifest } from 'sparkling-navigation/shim-host';

// Loose vue-router typings so we do not hard-pin a major version.
type RouterHistory = unknown;
type HistoryFactory = (base?: string) => RouterHistory;

export interface SparklingHistoryOptions {
  /**
   * Which vue-router history to layer on top of the shim.
   * - `'web'` (default): full History API — supports in-page back/forward
   *   and hash navigation within a bundle; cross-bundle navigations still
   *   hand off to the native host. Use for SPA-inside-MPA bundles.
   * - `'memory'`: one route per JS context (pure MPA). Lightest; every
   *   cross-path navigation is a native open. Recommended default for
   *   one-page-per-bundle apps.
   */
  mode?: 'web' | 'memory';
  /**
   * Provide vue-router's history factories. Kept as a parameter so this
   * module has no hard dependency on a specific vue-router version;
   * `router.options.ts` passes them in (or the module's generated glue
   * does). Defaults to a dynamic import of `vue-router`.
   */
  factories?: {
    createWebHistory?: HistoryFactory;
    createMemoryHistory?: HistoryFactory;
  };
  /** Widen same-document identity to same-bundle (SPA-inside-MPA). */
  sameBundleIsSameDocument?: boolean;
}

let installedShim: NavigationShim | undefined;

/**
 * Install the shim (idempotent per JS context) and return the shim so the
 * caller can build the vue-router history from its `location`.
 */
export function installSparklingShim(
  manifest: SparklingRouteManifest,
  options: SparklingHistoryOptions = {},
): NavigationShim {
  if (installedShim) return installedShim;
  const host = createSparklingNavigationHost({
    manifest,
    sameBundleIsSameDocument: options.sameBundleIsSameDocument,
  });
  const shim = createNavigationShim(host);
  // Define only-missing globals; on the web dev harness the real browser
  // globals stay in place (the shim never clobbers them).
  shim.install(globalThis as unknown as Record<string, unknown>);
  installedShim = shim;
  return shim;
}

/**
 * Build a vue-router history bound to the Sparkling-backed shim.
 * The returned value is passed straight to `createRouter({ history })`.
 */
export async function sparklingHistory(
  manifest: SparklingRouteManifest,
  options: SparklingHistoryOptions = {},
): Promise<RouterHistory> {
  const shim = installSparklingShim(manifest, options);
  const mode = options.mode ?? 'memory';

  let createWebHistory = options.factories?.createWebHistory;
  let createMemoryHistory = options.factories?.createMemoryHistory;
  if (!createWebHistory || !createMemoryHistory) {
    const vr = (await import('vue-router')) as {
      createWebHistory: HistoryFactory;
      createMemoryHistory: HistoryFactory;
    };
    createWebHistory ??= vr.createWebHistory;
    createMemoryHistory ??= vr.createMemoryHistory;
  }

  const base = manifest.base ?? '/';
  if (mode === 'web') {
    return createWebHistory!(base);
  }
  // Memory history seeded at this page's initial URL, so the in-context
  // router boots directly at the deep-linked route.
  const memory = createMemoryHistory!(base);
  const path = shim.location.pathname + shim.location.search + shim.location.hash;
  // vue-router memory history starts at '/'; the Nuxt router plugin will
  // replace to the initial URL during app:created using shim.location.
  void path;
  return memory;
}

/**
 * Recommended scrollBehavior for Lynx: return false so vue-router never
 * touches window.scrollTo / documentElement (there is no DOM viewport;
 * native containers own scrolling).
 */
export function sparklingScrollBehavior(): false {
  return false;
}

/** Test seam: forget the installed shim. */
export function __resetSparklingShim(): void {
  installedShim = undefined;
}
