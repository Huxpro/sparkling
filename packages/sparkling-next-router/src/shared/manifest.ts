// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Route manifest — the ahead-of-time metadata that links pages which never
 * share a JS heap. Generated from the app/ file convention at build time
 * and compiled into every page bundle.
 */
export interface RouteManifestEntry {
  /** Next-style route pattern, e.g. `/products/[id]`, `/docs/[...slug]`. */
  pattern: string;
  /** Bundle entry name (flat, no slashes), e.g. `products__id_`. */
  bundle: string;
  /** Param names in pattern order. */
  paramNames: string[];
  /** Regex source matching the pathname; groups align with paramNames. */
  regexSource: string;
  /** 'static' | 'dynamic' | 'catchall' | 'optional-catchall' (match priority). */
  kind: RouteKind;
}

export type RouteKind = 'static' | 'dynamic' | 'catchall' | 'optional-catchall';

export interface RouteManifest {
  routes: RouteManifestEntry[];
  /** Scheme prefix used to open containers, e.g. `hybrid://lynxview_page`. */
  baseScheme: string;
}

const KIND_PRIORITY: Record<RouteKind, number> = {
  static: 0,
  dynamic: 1,
  catchall: 2,
  'optional-catchall': 3,
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a Next.js route pattern into a regex + param list.
 * Supports `[param]`, `[...catchAll]`, `[[...optionalCatchAll]]`.
 * Route groups `(group)` must already be stripped from the pattern.
 */
export function compilePattern(pattern: string): Pick<RouteManifestEntry, 'paramNames' | 'regexSource' | 'kind'> {
  const paramNames: string[] = [];
  let kind: RouteKind = 'static';
  const segments = pattern.split('/').filter((s) => s.length > 0);
  const parts: string[] = [];
  for (const segment of segments) {
    let match: RegExpMatchArray | null;
    if ((match = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/))) {
      paramNames.push(match[1]);
      kind = 'optional-catchall';
      parts.push('(?:/(.+))?');
    } else if ((match = segment.match(/^\[\.\.\.([^\]]+)\]$/))) {
      paramNames.push(match[1]);
      if (kind === 'static' || kind === 'dynamic') kind = 'catchall';
      parts.push('/(.+)');
    } else if ((match = segment.match(/^\[([^\]]+)\]$/))) {
      paramNames.push(match[1]);
      if (kind === 'static') kind = 'dynamic';
      parts.push('/([^/]+)');
    } else {
      parts.push('/' + escapeRegex(segment));
    }
  }
  const body = parts.join('');
  const regexSource = `^${body === '' ? '/' : body}/?$`;
  return { paramNames, regexSource, kind };
}

export interface RouteMatch {
  entry: RouteManifestEntry;
  params: Record<string, string | string[]>;
}

/**
 * Match a pathname against the manifest with Next.js priority:
 * static > dynamic > catch-all > optional catch-all; within a class,
 * more specific (longer static prefix ⇒ appears earlier after sort).
 */
export function matchRoute(manifest: RouteManifest, pathname: string): RouteMatch | null {
  const normalized = pathname === '' ? '/' : pathname;
  const sorted = [...manifest.routes].sort((a, b) => {
    const byKind = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (byKind !== 0) return byKind;
    return b.pattern.length - a.pattern.length;
  });
  for (const entry of sorted) {
    const match = normalized.match(new RegExp(entry.regexSource));
    if (!match) continue;
    const params: Record<string, string | string[]> = {};
    entry.paramNames.forEach((name, i) => {
      const raw = match[i + 1];
      if (entry.kind === 'catchall' || entry.kind === 'optional-catchall') {
        params[name] = raw === undefined ? [] : raw.split('/').map(decodeURIComponentSafe);
      } else {
        params[name] = decodeURIComponentSafe(raw);
      }
    });
    return { entry, params };
  }
  return null;
}

function decodeURIComponentSafe(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

/** Bundle entry name for a route pattern: flat, deterministic, readable. */
export function bundleNameForPattern(pattern: string): string {
  if (pattern === '/') return 'index';
  return pattern
    .replace(/^\//, '')
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '_ocatch_$1_')
    .replace(/\[\.\.\.([^\]]+)\]/g, '_catch_$1_')
    .replace(/\[([^\]]+)\]/g, '_$1_')
    .replace(/\//g, '__')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** Build the sparkling scheme that opens the container for a route. */
export function schemeForEntry(manifest: RouteManifest, entry: RouteManifestEntry): string {
  return `${manifest.baseScheme}?bundle=${encodeURIComponent(entry.bundle + '.lynx.bundle')}`;
}
