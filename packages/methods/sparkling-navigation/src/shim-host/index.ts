// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Sparkling implementation of the `NavigationHost` contract from
 * `web-navigation-shim`.
 *
 * Layering (bottom-up):
 *   sparkling-navigation methods (router.open/close, scheme URLs)
 *     └─ this adapter: app URL ⇄ scheme URL via the route manifest
 *          └─ web-navigation-shim: history/location/popstate surface
 *               └─ any router framework (vue-router / Nuxt / …)
 *
 * The adapter is intentionally the ONLY Sparkling-aware layer: the shim
 * above knows nothing about schemes, and the methods below know nothing
 * about web navigation semantics.
 */

import { navigate } from '../navigate/navigate';
import { close } from '../close/close';
import { open } from '../open/open';
import {
  DEFAULT_BASE_SCHEME,
  DEFAULT_EXTERNAL_SCHEME,
  DEFAULT_MANIFEST_ORIGIN,
  PATH_QUERY_ITEM,
  findRouteByBundle,
  matchSparklingRoute,
  routeBundle,
} from './manifest';
import type { SparklingRouteManifest, SparklingManifestRoute } from './manifest';

export * from './manifest';

declare const lynx: {
  __globalProps?: { queryItems?: Record<string, string> };
} | undefined;

/**
 * Structural copy of web-navigation-shim's contract so this package has no
 * runtime (or even type-time) dependency on it. Kept in sync by the
 * `shim-host` integration test in web-navigation-shim's consumers.
 */
interface HostOpenOptions {
  replace?: boolean;
  newWindow?: boolean;
}

export interface SparklingNavigationHost {
  readonly initialUrl: string;
  readonly manifest: SparklingRouteManifest;
  open(url: string, options?: HostOpenOptions): void;
  close(): void;
  reload(): void;
  isSameDocument(from: URL, to: URL): boolean;
}

export interface CreateSparklingHostOptions {
  manifest: SparklingRouteManifest;
  /**
   * Override the initial app URL. Defaults to deriving it from
   * `lynx.__globalProps.queryItems` (the `__path` item placed there by
   * this adapter when opening the page, falling back to the route whose
   * bundle the container loaded).
   */
  initialUrl?: string;
  /**
   * Called when a navigation matches no manifest route and no external
   * scheme applies. Default: `console.error`.
   */
  onUnresolved?(url: string): void;
  /**
   * Widen the same-document policy: URLs served by the same Lynx bundle
   * share a document (entry + popstate instead of a native open). Enable
   * ONLY when bundles embed an in-page router that listens to popstate
   * and serves several manifest paths (SPA-inside-MPA hybrid). With the
   * default (false), the web's hash-only policy applies and every
   * cross-path `location.assign` opens a native page — the right
   * behavior for one-route-per-context setups like the Nuxt MPA glue.
   */
  sameBundleIsSameDocument?: boolean;
}

function manifestOrigin(manifest: SparklingRouteManifest): string {
  return (manifest.origin ?? DEFAULT_MANIFEST_ORIGIN).replace(/\/+$/, '');
}

function appUrl(manifest: SparklingRouteManifest, pathWithQuery: string): string {
  const origin = manifestOrigin(manifest);
  return new URL(pathWithQuery, `${origin}/`).href;
}

/**
 * Derive this page's initial app URL from container query items.
 * Precedence: explicit `__path` item → route table lookup by loaded
 * bundle → app base path.
 */
export function deriveInitialUrl(manifest: SparklingRouteManifest): string {
  const queryItems = (typeof lynx !== 'undefined' && lynx?.__globalProps?.queryItems) || {};

  const explicit = queryItems[PATH_QUERY_ITEM];
  if (explicit) {
    return appUrl(manifest, explicit);
  }

  // The container knows which bundle it loaded (bundle= in prod, url= in dev).
  const bundleParam = queryItems.bundle
    ?? (queryItems.url ? queryItems.url.split('?')[0].split('/').pop() : undefined);
  if (bundleParam) {
    const route = findRouteByBundle(manifest, bundleParam);
    if (route) {
      // For a dynamic route deep-linked without __path the params are
      // unknowable — land on the pattern path and let the app decide.
      return appUrl(manifest, route.path);
    }
  }

  return appUrl(manifest, manifest.base ?? '/');
}

function containerParams(route: SparklingManifestRoute): Record<string, string> {
  const params: Record<string, string> = {};
  const container = route.container ?? {};
  for (const key of Object.keys(container)) {
    params[key] = String(container[key]);
  }
  return params;
}

/**
 * Create a Sparkling-backed NavigationHost.
 *
 * - In-app URLs are matched against the manifest and opened natively via
 *   `navigate()` (⇒ `router.open` with a `hybrid://…?bundle=…` scheme).
 *   The full app URL rides along in the `__path` query item so the target
 *   page can seed its own shim `location`.
 * - Off-origin URLs (real web links) go through the manifest's
 *   `externalScheme` (default: the webview container).
 * - `isSameDocument` widens the shim's default policy using the manifest:
 *   two URLs served by the same Lynx bundle share a document, so an
 *   in-page router (vue-router memory/web history) handles them locally.
 */
export function createSparklingNavigationHost(
  options: CreateSparklingHostOptions,
): SparklingNavigationHost {
  const { manifest } = options;
  const origin = manifestOrigin(manifest);
  const onUnresolved = options.onUnresolved
    ?? ((url: string) => console.error(`[sparkling-navigation] no route or external scheme for ${url}`));

  const initialUrl = options.initialUrl !== undefined
    ? new URL(options.initialUrl, `${origin}/`).href
    : deriveInitialUrl(manifest);

  function openExternal(url: string, opts: HostOpenOptions): void {
    const template = manifest.externalScheme === undefined
      ? DEFAULT_EXTERNAL_SCHEME
      : manifest.externalScheme;
    if (!template) {
      onUnresolved(url);
      return;
    }
    const scheme = template.replace('{url}', encodeURIComponent(url));
    open({ scheme, options: opts.replace ? { replace: true } : undefined }, () => {});
  }

  function openInApp(target: URL, opts: HostOpenOptions): void {
    const match = matchSparklingRoute(manifest, target.pathname);
    if (!match) {
      onUnresolved(target.href);
      return;
    }
    const pathWithQuery = target.pathname + target.search + target.hash;
    navigate(
      {
        path: routeBundle(match.route),
        baseScheme: manifest.baseScheme ?? DEFAULT_BASE_SCHEME,
        options: {
          ...(opts.replace ? { replace: true } : {}),
          params: {
            ...containerParams(match.route),
            [PATH_QUERY_ITEM]: pathWithQuery,
          },
        },
      },
      (result) => {
        if (result.code !== 1) {
          console.error(`[sparkling-navigation] open failed for ${target.href}: ${result.msg}`);
        }
      },
    );
  }

  const host: SparklingNavigationHost = {
    initialUrl,
    manifest,
    open(url: string, opts: HostOpenOptions = {}) {
      const target = new URL(url, initialUrl);
      if (target.origin === origin) {
        openInApp(target, opts);
      } else {
        openExternal(target.href, opts);
      }
    },
    close() {
      close({}, () => {});
    },
    reload() {
      host.open(host.initialUrl, { replace: true });
    },
    isSameDocument(from: URL, to: URL) {
      if (from.origin !== to.origin) return false;
      const hashOnly = from.pathname === to.pathname && from.search === to.search;
      if (!options.sameBundleIsSameDocument || to.origin !== origin) {
        return hashOnly;
      }
      const fromRoute = matchSparklingRoute(manifest, from.pathname)?.route;
      const toRoute = matchSparklingRoute(manifest, to.pathname)?.route;
      if (!fromRoute || !toRoute) return hashOnly;
      // Same Lynx bundle ⇒ same JS heap ⇒ the in-page router owns it.
      return routeBundle(fromRoute) === routeBundle(toRoute);
    },
  };

  return host;
}
