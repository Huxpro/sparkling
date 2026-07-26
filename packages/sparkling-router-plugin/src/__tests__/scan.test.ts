// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateSparklingRoutes } from '../generate'
import { routePathFromFile } from '../path-from-file'
import { scanRouteContainers } from '../scan'

function writeTree(root: string, files: Record<string, string>) {
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, body)
  }
}

describe('sparkling-router-plugin scan/codegen', () => {
  it('maps file paths to URL patterns', () => {
    expect(routePathFromFile('index.tsx')).toBe('/')
    expect(routePathFromFile('feed/index.tsx')).toBe('/feed')
    expect(routePathFromFile('feed/$postId.tsx')).toBe('/feed/$postId')
    expect(routePathFromFile('user.$id.tsx')).toBe('/user/$id')
    expect(routePathFromFile('feed/_container.tsx')).toBeUndefined()
    expect(routePathFromFile('__root.tsx')).toBeUndefined()
  })

  it('partitions containers by _container markers', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spk-router-'))
    const routes = path.join(tmp, 'src/routes')
    writeTree(routes, {
      '__root.tsx': 'export {}',
      'index.tsx': 'export {}',
      'feed/_container.tsx': 'export default {}',
      'feed/index.tsx': 'export {}',
      'feed/$postId.tsx': 'export {}',
      'settings/_container.modal.tsx': 'export default {}',
      'settings/index.tsx': 'export {}',
      'user.$id.tsx': 'export {}',
    })

    const scan = scanRouteContainers(routes)
    const byId = Object.fromEntries(scan.containers.map((c) => [c.id, c]))

    expect(byId.feed?.presentation).toBe('push')
    expect(byId.feed?.routes.map((r) => r.path).sort()).toEqual(['/feed', '/feed/$postId'])
    expect(byId.settings?.presentation).toBe('modal')
    expect(byId['user.id']?.routes.map((r) => r.path)).toEqual(['/user/$id'])
    expect(byId.main?.routes.map((r) => r.path) ?? byId['']?.routes).toBeDefined()

    const generated = generateSparklingRoutes(tmp)
    expect(generated.manifest.containers.length).toBeGreaterThanOrEqual(3)
    expect(fs.existsSync(generated.manifestPath)).toBe(true)
    expect(Object.keys(generated.entries).length).toBe(generated.manifest.containers.length)
  })
})
