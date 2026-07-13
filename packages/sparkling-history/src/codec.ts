// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  DecodedLocation,
  HistoryLocation,
  HistoryState,
  SchemeCodec,
} from './types'
import {
  defaultLocationOf,
  findOwner,
  type RouteManifest,
} from './manifest'

export const DEFAULT_SCHEME = 'hybrid://lynxview_page'

/** Reserved scheme params carrying router coordinates across heaps. */
export const ROUTE_PARAM = '__hs_route'
export const STATE_PARAM = '__hs_state'
export const DEPTH_PARAM = '__hs_depth'

/**
 * Container/loader params that must never leak into a decoded route's query.
 * (Sparkling container params like `title` stay out of the route location.)
 */
const RESERVED_PARAMS = new Set([
  ROUTE_PARAM,
  STATE_PARAM,
  DEPTH_PARAM,
  'bundle',
  'url',
  'containerInitTime',
  'fullscreen',
  'title',
  'title_color',
  'hide_nav_bar',
  'nav_bar_color',
  'screen_orientation',
  'hide_status_bar',
  'trans_status_bar',
  'show_nav_bar_in_trans_status_bar',
  'hide_loading',
  'loading_bg_color',
  'container_bg_color',
  'hide_error',
  'force_theme_style',
  'status_font_mode',
  'hide_back_button',
])

function pathOf(location: HistoryLocation): string {
  const stop = Math.min(
    ...['?', '#']
      .map(c => location.indexOf(c))
      .filter(i => i >= 0)
      .concat(location.length)
  )
  return location.slice(0, stop)
}

/** Tiny query parser: no URL/URLSearchParams dependency, `%20`-style only. */
export function parseQuery(url: string): Record<string, string> {
  const result: Record<string, string> = {}
  const qIndex = url.indexOf('?')
  if (qIndex < 0) return result
  const hashIndex = url.indexOf('#', qIndex)
  const query = url.slice(qIndex + 1, hashIndex < 0 ? undefined : hashIndex)
  for (const pair of query.split('&')) {
    if (!pair) continue
    const eq = pair.indexOf('=')
    const key = eq < 0 ? pair : pair.slice(0, eq)
    const value = eq < 0 ? '' : pair.slice(eq + 1)
    try {
      result[decodeURIComponent(key)] = decodeURIComponent(value)
    } catch {
      result[key] = value
    }
  }
  return result
}

export interface SparklingCodecOptions {
  /**
   * Suffix appended to the bundle name in generated schemes.
   * Default `.lynx.bundle` (rspeedy's `[name].lynx.bundle` convention).
   */
  bundleSuffix?: string
}

/**
 * Codec between router locations and sparkling schemes.
 *
 * Encoding: `/detail/42?tab=a` (owned by page `detail`) becomes
 * `hybrid://lynxview_page?bundle=detail.lynx.bundle&__hs_route=%2Fdetail%2F42%3Ftab%3Da&__hs_depth=1`
 *
 * The full router location rides along in `__hs_route`, so the target heap
 * recovers it losslessly without reverse-templating path params. `bundle=`
 * tells the native/web container loader what to load — in dev mode
 * sparkling-navigation rewrites it to `url=` targeting the dev server.
 *
 * Decoding accepts both freshly-encoded schemes and plain deeplinks
 * (`?bundle=detail.lynx.bundle&id=42` → the page's default route with
 * non-reserved params appended as query).
 */
export function createSparklingSchemeCodec(
  manifest: RouteManifest,
  options: SparklingCodecOptions = {}
): SchemeCodec {
  const scheme = (manifest.scheme ?? DEFAULT_SCHEME).replace(/[?&]+$/, '')
  const bundleSuffix = options.bundleSuffix ?? '.lynx.bundle'

  function ownerOf(to: HistoryLocation): string | null {
    const owner = findOwner(manifest, pathOf(to))
    return owner ? owner.page.bundle : null
  }

  function encode(
    to: HistoryLocation,
    context: { state?: HistoryState; depth?: number } = {}
  ): string | null {
    const owner = findOwner(manifest, pathOf(to))
    if (!owner) return null

    const parts: string[] = [
      `bundle=${encodeURIComponent(owner.page.bundle + bundleSuffix)}`,
      `${ROUTE_PARAM}=${encodeURIComponent(to)}`,
      `${DEPTH_PARAM}=${context.depth ?? 0}`,
    ]
    if (context.state !== undefined) {
      parts.push(`${STATE_PARAM}=${encodeURIComponent(JSON.stringify(context.state))}`)
    }
    for (const [key, value] of Object.entries(owner.page.params ?? {})) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
    return `${scheme}?${parts.join('&')}`
  }

  function decode(url: string): DecodedLocation | null {
    const query = parseQuery(url)

    const depth = Number.parseInt(query[DEPTH_PARAM] ?? '0', 10) || 0

    let state: HistoryState | undefined
    if (query[STATE_PARAM]) {
      try {
        state = JSON.parse(query[STATE_PARAM]) as HistoryState
      } catch {
        state = undefined
      }
    }

    const bundleName = bundleNameFrom(query, bundleSuffix)

    if (query[ROUTE_PARAM]) {
      return {
        location: query[ROUTE_PARAM],
        state,
        depth,
        bundle: bundleName ?? undefined,
      }
    }

    // Plain deeplink: derive the page from bundle= / url= and use its
    // default route, forwarding non-reserved params as query.
    if (!bundleName) return null
    const page = manifest.pages.find(p => p.bundle === bundleName)
    if (!page) return null

    const extras = Object.entries(query)
      .filter(([key]) => !RESERVED_PARAMS.has(key))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)

    let location = defaultLocationOf(page)
    if (extras.length) {
      location += (location.includes('?') ? '&' : '?') + extras.join('&')
    }
    return { location, state, depth, bundle: bundleName }
  }

  return { encode, decode, ownerOf }
}

function bundleNameFrom(
  query: Record<string, string>,
  bundleSuffix: string
): string | null {
  const strip = (name: string) => {
    const base = name.split('/').filter(Boolean).pop() ?? ''
    return base.endsWith(bundleSuffix)
      ? base.slice(0, -bundleSuffix.length)
      : base
  }
  if (query.bundle) return strip(query.bundle) || null
  if (query.url) {
    // dev server URL, e.g. http://localhost:5969/detail.lynx.bundle
    const noProto = query.url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    const path = noProto.slice(noProto.indexOf('/') + 1).split(/[?#]/)[0] ?? ''
    return strip(path) || null
  }
  return null
}
