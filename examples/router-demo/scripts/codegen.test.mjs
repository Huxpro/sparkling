// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { generateSparklingRoutes } from 'sparkling-router-plugin'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('router-demo routes produce a multi-container manifest', () => {
  const result = generateSparklingRoutes(root, {
    routesDirectory: 'src/routes',
    manifestOutput: 'src/route-manifest.gen.json',
    containersOutput: 'src/generated/containers',
  })

  assert.ok(result.manifest.containers.length >= 2)
  const ids = result.manifest.containers.map((c) => c.bundle)
  assert.ok(ids.some((b) => b.includes('feed')))
  assert.ok(fs.existsSync(result.manifestPath))
})
