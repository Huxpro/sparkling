// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Match a concrete pathname against a TanStack-style path pattern.
 * Supports `$param` dynamic segments and trailing optional `/`.
 */
export function matchPathPattern(pattern: string, pathname: string): boolean {
  const normalizedPattern = normalizePathname(pattern)
  const normalizedPath = normalizePathname(pathname)

  if (normalizedPattern === normalizedPath) {
    return true
  }

  const patternParts = splitPath(normalizedPattern)
  const pathParts = splitPath(normalizedPath)

  if (patternParts.length !== pathParts.length) {
    return false
  }

  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i]!
    const actual = pathParts[i]!
    if (expected.startsWith('$')) {
      if (!actual) {
        return false
      }
      continue
    }
    if (expected !== actual) {
      return false
    }
  }

  return true
}

/** True when pathname is owned by any of the given route patterns. */
export function isPathOwnedBy(pathname: string, routes: string[]): boolean {
  return routes.some((route) => matchPathPattern(route, pathname))
}

/**
 * Longest-prefix container resolution for hard navigation.
 * Prefers exact matches, then longest matching pattern.
 */
export function resolveContainerForPath<T extends { routes: Array<{ path: string }> }>(
  pathname: string,
  containers: T[],
): T | undefined {
  let best: { container: T; score: number } | undefined

  for (const container of containers) {
    for (const route of container.routes) {
      if (!matchPathPattern(route.path, pathname)) {
        continue
      }
      const score = splitPath(normalizePathname(route.path)).length
      if (!best || score > best.score) {
        best = { container, score }
      }
    }
  }

  return best?.container
}

export function normalizePathname(pathname: string): string {
  if (!pathname) {
    return '/'
  }
  let value = pathname.trim()
  if (!value.startsWith('/')) {
    value = `/${value}`
  }
  if (value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1)
  }
  return value
}

export function splitPath(pathname: string): string[] {
  return normalizePathname(pathname).split('/').filter(Boolean)
}

export function parseSearch(search: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!search) {
    return result
  }
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw) {
    return result
  }
  const params = new URLSearchParams(raw)
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export function serializeSearch(search: Record<string, string> | undefined): string {
  if (!search) {
    return ''
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) {
      continue
    }
    params.append(key, String(value))
  }
  const encoded = params.toString().replace(/\+/g, '%20')
  return encoded ? `?${encoded}` : ''
}

export function splitHref(href: string): { pathname: string; search: string; hash: string } {
  const hashIndex = href.indexOf('#')
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : ''
  const searchIndex = withoutHash.indexOf('?')
  const pathname = searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash
  const search = searchIndex >= 0 ? withoutHash.slice(searchIndex) : ''
  return {
    pathname: normalizePathname(pathname || '/'),
    search,
    hash,
  }
}
