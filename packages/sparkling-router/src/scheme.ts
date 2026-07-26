// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  DEFAULT_SCHEME_BASE,
  PATH_QUERY_KEY,
  type RouteManifest,
  type RouteManifestContainer,
} from './types.js'
import {
  normalizePathname,
  resolveContainerForPath,
  serializeSearch,
  splitHref,
} from './path-match.js'

export interface SchemeTranslation {
  scheme: string
  container: RouteManifestContainer
  path: string
  search: Record<string, string>
}

/**
 * Translate a logical path (+ search) into a Sparkling hybrid scheme URL
 * using the route manifest. Deep soft routes are carried as `__path`.
 */
export function pathToScheme(
  href: string,
  manifest: RouteManifest,
): SchemeTranslation | undefined {
  const { pathname, search } = splitHref(href)
  const container = resolveContainerForPath(pathname, manifest.containers)
  if (!container) {
    return undefined
  }

  const searchRecord: Record<string, string> = {}
  new URLSearchParams(search).forEach((value, key) => {
    searchRecord[key] = value
  })
  const base = (manifest.scheme?.base || DEFAULT_SCHEME_BASE).replace(/[?&]+$/, '')
  const params = new URLSearchParams()
  params.set('bundle', container.bundle)
  params.set(PATH_QUERY_KEY, pathname)

  for (const [key, value] of Object.entries(searchRecord)) {
    if (key === 'bundle' || key === 'url' || key === PATH_QUERY_KEY) {
      continue
    }
    params.append(key, value)
  }

  if (container.containerOptions) {
    for (const [key, value] of Object.entries(container.containerOptions)) {
      if (!params.has(key)) {
        params.set(key, value)
      }
    }
  }

  const query = params.toString().replace(/\+/g, '%20')
  return {
    scheme: `${base}?${query}`,
    container,
    path: pathname,
    search: searchRecord,
  }
}

/** Read the soft-nav bootstrap path from scheme / globalProps queryItems. */
export function initialPathFromQueryItems(
  queryItems: Record<string, string | undefined> | undefined,
  fallback = '/',
): string {
  if (!queryItems) {
    return normalizePathname(fallback)
  }
  const fromPath = queryItems[PATH_QUERY_KEY] || queryItems.path
  if (fromPath && typeof fromPath === 'string' && fromPath.trim()) {
    return normalizePathname(fromPath)
  }
  return normalizePathname(fallback)
}

export function hrefFromPathAndSearch(
  path: string,
  search?: Record<string, string>,
): string {
  return `${normalizePathname(path)}${serializeSearch(search)}`
}
