// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Convert a TanStack-style route file path (relative to routesDir) into a URL path pattern.
 *
 * Examples:
 *   index.tsx              → /
 *   feed/index.tsx         → /feed
 *   feed/$postId.tsx       → /feed/$postId
 *   user.$id.tsx           → /user/$id
 *   settings/_container.tsx → (skipped — marker)
 *   __root.tsx             → (skipped — root)
 */
export function routePathFromFile(relativePath: string): string | undefined {
  const posix = relativePath.replace(/\\/g, '/')
  const base = posix.replace(/\.(tsx|ts|jsx|js)$/, '')

  if (
    base === '__root' ||
    base.endsWith('/__root') ||
    isContainerMarkerName(base.split('/').pop() ?? '')
  ) {
    return undefined
  }

  const segments = base.split('/').filter(Boolean)
  const urlSegments: string[] = []

  for (const segment of segments) {
    if (segment.startsWith('_') && !segment.startsWith('_layout')) {
      // pathless layout / grouping — skip segment name, keep children
      if (segment === '_layout' || segment.startsWith('_layout.')) {
        continue
      }
      if (segment.startsWith('(') || segment.endsWith(')')) {
        continue
      }
      // other underscore files (loaders etc.) are not routes
      if (!segment.includes('.')) {
        continue
      }
    }

    if (segment === 'index') {
      continue
    }

    // Flatten dotted segments: user.$id → user / $id
    for (const part of segment.split('.')) {
      if (!part || part === 'index') {
        continue
      }
      if (part.startsWith('_')) {
        continue
      }
      urlSegments.push(part)
    }
  }

  if (urlSegments.length === 0) {
    return '/'
  }
  return `/${urlSegments.join('/')}`
}

export function isContainerMarkerName(fileName: string): boolean {
  // _container.tsx | _container.modal.tsx
  // Also accept TanStack ignore-prefixed forms: -_container.tsx
  const normalized = fileName.startsWith('-') ? fileName.slice(1) : fileName
  return (
    normalized === '_container' ||
    normalized === '_container.modal' ||
    normalized.startsWith('_container.')
  )
}

export function presentationFromMarkerName(fileName: string): 'push' | 'modal' {
  const normalized = fileName.startsWith('-') ? fileName.slice(1) : fileName
  if (normalized.includes('.modal')) {
    return 'modal'
  }
  return 'push'
}

export function containerIdFromDir(dir: string, fallbackPath: string): string {
  if (!dir || dir === '.') {
    const cleaned = fallbackPath.replace(/^\//, '').replace(/\//g, '.') || 'main'
    return cleaned === '' ? 'main' : cleaned.replace(/\$/g, '')
  }
  return dir.replace(/\\/g, '/').replace(/\//g, '.')
}
