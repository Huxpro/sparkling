// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSparklingRoutes } from 'sparkling-router-plugin'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = generateSparklingRoutes(projectRoot)
console.log(
  `[router-demo] codegen: ${result.manifest.containers.length} containers → ${path.relative(projectRoot, result.manifestPath)}`,
)
