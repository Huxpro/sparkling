// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The route manifest is the piece of build-time metadata that connects
 * pages living in DIFFERENT JS heaps. Each Sparkling page bundle embeds the
 * same manifest (generated from the file-based page convention, see
 * `sparkling-history/codegen`), so every heap can independently answer:
 *
 *   "which page bundle owns route X?"  →  cross-page navigations become
 *   `router.open(scheme)` calls instead of in-memory route changes.
 */

/** A route pattern entry: a bare pattern or a pattern with a route name. */
export type RouteManifestRoute = string | { path: string; name?: string }

export interface RouteManifestPage {
  /** Page bundle name (rspeedy entry name), e.g. `"detail"`. */
  bundle: string
  /**
   * Route path patterns owned by this page. Supports vue-router-style
   * `:param` segments and a trailing `*` / `:param*` catch-all. The FIRST
   * pattern is the page's primary route. Entries may carry a route `name`
   * so other pages can navigate cross-page by name.
   */
  routes: RouteManifestRoute[]
  /**
   * Concrete location to use when the container was opened without an
   * explicit route (e.g. a plain deeplink `?bundle=detail.lynx.bundle`).
   * Defaults to the first static-only pattern, else `/`.
   */
  default?: string
  /**
   * Extra container params appended to generated schemes for this page
   * (e.g. `{ hide_nav_bar: true, title: 'Detail' }`).
   */
  params?: Record<string, string | number | boolean>
}

export interface RouteManifest {
  /** Base scheme for generated URLs. Default: `hybrid://lynxview_page`. */
  scheme?: string
  pages: RouteManifestPage[]
}

/** Identity helper for typed manifest modules. */
export function defineRouteManifest(manifest: RouteManifest): RouteManifest {
  return manifest
}

// ── Path pattern matching ──────────────────────────────────────────────

export interface PatternMatch {
  /** Number of static segments matched (used to rank specificity). */
  staticScore: number
  params: Record<string, string>
}

/**
 * Match a concrete path (`/users/1`) against a pattern (`/users/:id`).
 * Returns null when it doesn't match.
 *
 * Deliberately tiny: full matching (regex params, optional params,
 * sensitivity...) happens inside each page's own router. The manifest only
 * needs enough to decide OWNERSHIP of a path.
 */
export function matchPattern(
  pattern: string,
  path: string
): PatternMatch | null {
  const patternSegs = split(pattern)
  const pathSegs = split(path)
  const params: Record<string, string> = {}
  let staticScore = 0

  let i = 0
  for (; i < patternSegs.length; i++) {
    const pat = patternSegs[i]
    const isCatchAll = pat === '*' || (pat.startsWith(':') && pat.endsWith('*'))
    if (isCatchAll) {
      const name = pat === '*' ? 'pathMatch' : pat.slice(1, -1)
      params[name] = pathSegs.slice(i).join('/')
      return { staticScore, params }
    }
    if (i >= pathSegs.length) return null
    if (pat.startsWith(':')) {
      params[pat.slice(1)] = pathSegs[i]
    } else if (pat === pathSegs[i]) {
      staticScore++
    } else {
      return null
    }
  }
  return i === pathSegs.length ? { staticScore, params } : null
}

function split(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, '') === ''
    ? []
    : path.replace(/^\/+|\/+$/g, '').split('/')
}

export function normalizeRoute(route: RouteManifestRoute): {
  path: string
  name?: string
} {
  return typeof route === 'string' ? { path: route } : route
}

export interface OwnerLookup {
  page: RouteManifestPage
  pattern: string
  match: PatternMatch
}

/** Find the page owning `path`, ranked by static-segment specificity. */
export function findOwner(
  manifest: RouteManifest,
  path: string
): OwnerLookup | null {
  let best: OwnerLookup | null = null
  for (const page of manifest.pages) {
    for (const route of page.routes) {
      const { path: pattern } = normalizeRoute(route)
      const match = matchPattern(pattern, path)
      if (match) {
        if (!best || match.staticScore > best.match.staticScore) {
          best = { page, pattern, match }
        }
      }
    }
  }
  return best
}

/** Find a named route across all pages of the manifest. */
export function findByName(
  manifest: RouteManifest,
  name: string
): { page: RouteManifestPage; pattern: string } | null {
  for (const page of manifest.pages) {
    for (const route of page.routes) {
      const normalized = normalizeRoute(route)
      if (normalized.name === name) {
        return { page, pattern: normalized.path }
      }
    }
  }
  return null
}

/**
 * Fill a pattern's params to produce a concrete path:
 * `fillPattern('/users/:id', { id: '1' })` → `/users/1`.
 */
export function fillPattern(
  pattern: string,
  params: Record<string, string | number | Array<string | number>> = {}
): string {
  const segments = pattern.split('/').map(segment => {
    if (!segment.startsWith(':') && segment !== '*') return segment
    const isCatchAll = segment === '*' || segment.endsWith('*')
    const name =
      segment === '*'
        ? 'pathMatch'
        : segment.slice(1, isCatchAll ? -1 : undefined)
    const value = params[name]
    if (value === undefined || value === null) {
      throw new Error(
        `[sparkling-history] missing param "${name}" to fill pattern "${pattern}"`
      )
    }
    const values = Array.isArray(value) ? value : [value]
    return values.map(v => encodeURIComponent(String(v))).join('/')
  })
  const path = segments.join('/')
  return path.startsWith('/') ? path : '/' + path
}

/** Resolve the concrete default location for a page. */
export function defaultLocationOf(page: RouteManifestPage): string {
  if (page.default) return page.default
  const firstStatic = page.routes
    .map(normalizeRoute)
    .find(r => !r.path.includes(':') && !r.path.includes('*'))
  return firstStatic?.path ?? '/'
}
