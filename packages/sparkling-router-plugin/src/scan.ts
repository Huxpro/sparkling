// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import path from 'node:path'
import {
  containerIdFromDir,
  isContainerMarkerName,
  presentationFromMarkerName,
  routePathFromFile,
} from './path-from-file.js'
import type { ContainerPartition, ScanResult } from './types.js'

const ROUTE_EXT = /\.(tsx|ts|jsx|js)$/

/**
 * Scan a TanStack-style `routes/` tree and partition files by `_container` boundaries.
 *
 * Rules (RFC §5.1):
 * - `_container.tsx` / `_container.modal.tsx` marks a hard container for that subtree
 * - Top-level route files without a marker each become a single-page container
 * - `__root.tsx` is global (type/context only) and is not a container
 */
export function scanRouteContainers(routesDirectory: string): ScanResult {
  const routesDir = path.resolve(routesDirectory)
  if (!fs.existsSync(routesDir)) {
    return { routesDir, containers: [], rootFiles: [] }
  }

  const allFiles = listRouteFiles(routesDir)
  const rootFiles = allFiles.filter((f) => f === '__root.tsx' || f === '__root.ts')

  const markers = new Map<string, { file: string; presentation: 'push' | 'modal' }>()
  for (const rel of allFiles) {
    const name = path.posix.basename(rel).replace(ROUTE_EXT, '')
    if (!isContainerMarkerName(name)) {
      continue
    }
    const dir = path.posix.dirname(rel)
    markers.set(dir === '.' ? '' : dir, {
      file: rel,
      presentation: presentationFromMarkerName(name),
    })
  }

  const containerMap = new Map<string, ContainerPartition>()

  const ensureContainer = (
    id: string,
    dir: string,
    presentation: 'push' | 'modal',
    markerFile?: string,
  ): ContainerPartition => {
    let existing = containerMap.get(id)
    if (!existing) {
      existing = {
        id,
        dir,
        presentation,
        markerFile,
        routeFiles: [],
        routes: [],
      }
      containerMap.set(id, existing)
    }
    return existing
  }

  for (const rel of allFiles) {
    if (rel === '__root.tsx' || rel === '__root.ts') {
      continue
    }
    const name = path.posix.basename(rel).replace(ROUTE_EXT, '')
    if (isContainerMarkerName(name)) {
      const dir = path.posix.dirname(rel)
      const dirKey = dir === '.' ? '' : dir
      const id = containerIdFromDir(dirKey, dirKey || 'main')
      ensureContainer(id, dirKey, presentationFromMarkerName(name), rel)
      continue
    }

    const ownerDir = findOwnerDir(rel, markers)
    const routePath = routePathFromFile(rel)
    if (!routePath) {
      continue
    }

    if (ownerDir !== undefined) {
      const marker = markers.get(ownerDir)!
      const id = containerIdFromDir(ownerDir, routePath)
      const partition = ensureContainer(id, ownerDir, marker.presentation, marker.file)
      partition.routeFiles.push(rel)
      if (!partition.routes.some((r) => r.path === routePath)) {
        partition.routes.push({ path: routePath })
      }
    } else {
      // Single-page container for top-level (or unmarked) route files.
      const id = containerIdFromDir('', routePath)
      const partition = ensureContainer(id, '', 'push')
      partition.routeFiles.push(rel)
      if (!partition.routes.some((r) => r.path === routePath)) {
        partition.routes.push({ path: routePath })
      }
    }
  }

  // Ensure marker-only containers still appear (empty routes allowed during authoring).
  for (const [dir, marker] of markers) {
    const id = containerIdFromDir(dir, dir || 'main')
    ensureContainer(id, dir, marker.presentation, marker.file)
  }

  const containers = [...containerMap.values()].sort((a, b) => a.id.localeCompare(b.id))
  return { routesDir, containers, rootFiles }
}

function findOwnerDir(
  relativeFile: string,
  markers: Map<string, { file: string; presentation: 'push' | 'modal' }>,
): string | undefined {
  let dir = path.posix.dirname(relativeFile)
  if (dir === '.') {
    dir = ''
  }
  while (true) {
    if (markers.has(dir)) {
      return dir
    }
    if (!dir) {
      return undefined
    }
    const parent = path.posix.dirname(dir)
    dir = parent === '.' ? '' : parent
  }
}

function listRouteFiles(routesDir: string): string[] {
  const results: string[] = []

  const walk = (absDir: string, relDir: string) => {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name
      const abs = path.join(absDir, entry.name)
      if (entry.isDirectory()) {
        walk(abs, rel)
      } else if (ROUTE_EXT.test(entry.name)) {
        results.push(rel.replace(/\\/g, '/'))
      }
    }
  }

  walk(routesDir, '')
  return results.sort()
}
