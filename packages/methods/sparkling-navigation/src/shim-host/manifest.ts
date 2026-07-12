// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The Sparkling route manifest: build-time metadata connecting app URLs
 * (file-based routes) to Lynx bundles.
 *
 * Sparkling pages run in isolated JS heaps — no in-memory router can span
 * them. This manifest is generated from the app's file-based routing
 * convention (e.g. a Nuxt `pages/` directory) and embedded into every
 * page bundle, so that any page can resolve "app URL → which bundle to
 * open natively" without shared runtime state.
 */
export interface SparklingRouteManifest {
  version: 1;
  /**
   * Logical origin for app URLs (never fetched; it only namespaces the
   * app's URL space for WHATWG parsing). Default: `https://sparkling.app`.
   */
  origin?: string;
  /** Base path prefix of the app's URL space. Default `/`. */
  base?: string;
  /** Base container scheme. Default `hybrid://lynxview_page`. */
  baseScheme?: string;
  /**
   * Scheme template for URLs outside the app's route table (external
   * links). `{url}` is replaced with the encoded target URL.
   * Default: `hybrid://webview?url={url}`. Set to `null` to disable.
   */
  externalScheme?: string | null;
  routes: SparklingManifestRoute[];
}

export interface SparklingManifestRoute {
  /** Route name (unique), e.g. `users-id`. */
  name?: string;
  /**
   * vue-router style path pattern: static segments, `:param`,
   * `:param(regexp)`, trailing `?` (optional) or `*`/`+` (repeatable).
   * E.g. `/users/:id()`, `/blog/:slug(.*)*`.
   */
  path: string;
  /** Build entry name (rspeedy `source.entry` key). */
  entry: string;
  /** Bundle file. Default: `${entry}.lynx.bundle`. */
  bundle?: string;
  /**
   * Extra container scheme params for this page (title, hide_nav_bar, …),
   * merged into the scheme query when this route is opened.
   */
  container?: Record<string, string | number | boolean>;
  /** Arbitrary route meta carried into the manifest for consumers. */
  meta?: Record<string, unknown>;
}

export interface SparklingRouteMatch {
  route: SparklingManifestRoute;
  params: Record<string, string | string[]>;
}

export const DEFAULT_MANIFEST_ORIGIN = 'https://sparkling.app';
export const DEFAULT_BASE_SCHEME = 'hybrid://lynxview_page';
export const DEFAULT_EXTERNAL_SCHEME = 'hybrid://webview?url={url}';

/**
 * Query item used to carry the full in-app URL (path + search + hash)
 * through the container scheme into the opened page, where it seeds the
 * shim's `location`.
 */
export const PATH_QUERY_ITEM = '__path';

interface CompiledSegment {
  type: 'static' | 'param';
  value: string; // static text or param name
  pattern?: string; // custom regex for params
  optional?: boolean;
  repeatable?: boolean;
}

interface CompiledRoute {
  route: SparklingManifestRoute;
  regex: RegExp;
  keys: Array<{ name: string; repeatable: boolean }>;
  score: number;
}

const SEGMENT_RE = /^:([\w]+)(\(([^)]*)\))?([?+*]?)$/;

function compilePath(route: SparklingManifestRoute): CompiledRoute {
  const segments = route.path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const keys: CompiledRoute['keys'] = [];
  let pattern = '';
  let score = 0;

  if (segments.length === 0) {
    return { route, regex: /^\/?$/, keys, score: 100 };
  }

  for (const segment of segments) {
    const match = SEGMENT_RE.exec(segment);
    if (!match) {
      // Static segment (may still contain :param embedded in text — keep
      // it simple: treat fully-static segments only).
      pattern += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
      score += 100;
      continue;
    }
    const [, name, , custom, modifier] = match;
    const repeatable = modifier === '*' || modifier === '+';
    const optional = modifier === '?' || modifier === '*';
    const body = custom && custom.length > 0 ? custom : '[^/]+';
    keys.push({ name, repeatable });
    if (repeatable) {
      // Match across segments; capture everything after the slash.
      pattern += optional ? `(?:/(${body}(?:/${body})*))?` : `/(${body}(?:/${body})*)`;
      score += 10;
    } else if (optional) {
      pattern += `(?:/(${body}))?`;
      score += 30;
    } else {
      pattern += `/(${body})`;
      score += 40;
    }
  }

  return { route, regex: new RegExp(`^${pattern}/?$`), keys, score };
}

let compiledCache: WeakMap<SparklingRouteManifest, CompiledRoute[]> | undefined;

function compiled(manifest: SparklingRouteManifest): CompiledRoute[] {
  compiledCache ??= new WeakMap();
  let list = compiledCache.get(manifest);
  if (!list) {
    list = manifest.routes.map(compilePath).sort((a, b) => b.score - a.score);
    compiledCache.set(manifest, list);
  }
  return list;
}

function stripBase(pathname: string, base: string | undefined): string | null {
  const normalizedBase = (base ?? '/').replace(/\/+$/, '');
  if (!normalizedBase) return pathname;
  if (pathname === normalizedBase) return '/';
  if (pathname.startsWith(`${normalizedBase}/`)) return pathname.slice(normalizedBase.length);
  return null;
}

/**
 * Match an app pathname against the manifest. Returns the winning route
 * (static segments outrank params) and extracted params.
 */
export function matchSparklingRoute(
  manifest: SparklingRouteManifest,
  pathname: string,
): SparklingRouteMatch | null {
  const path = stripBase(pathname, manifest.base);
  if (path === null) return null;
  for (const entry of compiled(manifest)) {
    const match = entry.regex.exec(path);
    if (!match) continue;
    const params: Record<string, string | string[]> = {};
    entry.keys.forEach((key, i) => {
      const raw = match[i + 1];
      if (raw === undefined) return;
      params[key.name] = key.repeatable ? raw.split('/') : raw;
    });
    return { route: entry.route, params };
  }
  return null;
}

/** Bundle file name for a manifest route. */
export function routeBundle(route: SparklingManifestRoute): string {
  return route.bundle ?? `${route.entry}.lynx.bundle`;
}

/** Find a manifest route by its bundle file (or entry) name. */
export function findRouteByBundle(
  manifest: SparklingRouteManifest,
  bundleOrEntry: string,
): SparklingManifestRoute | undefined {
  const name = bundleOrEntry.replace(/^(?:\.\/|\/)+/, '');
  return manifest.routes.find(
    (route) => routeBundle(route) === name
      || route.entry === name
      || `${route.entry}.lynx.bundle` === name,
  );
}
