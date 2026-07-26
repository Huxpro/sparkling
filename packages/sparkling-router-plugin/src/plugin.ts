// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'
import { generateSparklingRoutes } from './generate.js'
import type { PluginOptions } from './types.js'

export interface SparklingRouterPlugin {
  name: string
  apply(compiler: {
    hooks?: {
      initialize?: { tap: (name: string, fn: () => void) => void }
      beforeCompile?: { tapAsync: (name: string, fn: (params: unknown, cb: (err?: Error) => void) => void) => void }
      watchRun?: { tap: (name: string, fn: () => void) => void }
    }
    context?: string
  }): void
  /** Imperative generate for CLIs / tests. */
  generate(projectRoot?: string): ReturnType<typeof generateSparklingRoutes>
}

/**
 * Lightweight rspack/rsbuild plugin.
 *
 * S3′ conclusion: TanStack's generator customization surface is insufficient for
 * `_container` multi-entry partitioning, so this plugin owns boundary scan +
 * manifest/entry emit. Pair with `@tanstack/router-plugin/rspack` for per-bundle
 * typed `routeTree.gen.ts` inside each container subtree (or point its
 * `routesDirectory` at a virtualized subset).
 */
export function sparklingRouterPlugin(options: PluginOptions = {}): SparklingRouterPlugin {
  let lastFingerprint = ''

  const run = (projectRoot: string) => {
    const result = generateSparklingRoutes(projectRoot, options)
    const fingerprint = JSON.stringify(result.manifest)
    if (fingerprint !== lastFingerprint) {
      lastFingerprint = fingerprint
      // eslint-disable-next-line no-console
      console.log(
        `[sparkling-router-plugin] wrote manifest (${result.manifest.containers.length} containers) → ${path.relative(projectRoot, result.manifestPath)}`,
      )
    }
    return result
  }

  return {
    name: 'sparkling-router-plugin',
    apply(compiler) {
      const root = compiler.context || process.cwd()
      const tap = () => {
        try {
          run(root)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[sparkling-router-plugin] generate failed', error)
        }
      }
      compiler.hooks?.initialize?.tap('sparkling-router-plugin', tap)
      compiler.hooks?.watchRun?.tap('sparkling-router-plugin', tap)
      compiler.hooks?.beforeCompile?.tapAsync('sparkling-router-plugin', (_params, cb) => {
        try {
          run(root)
          cb()
        } catch (error) {
          cb(error as Error)
        }
      })
    },
    generate(projectRoot = process.cwd()) {
      return run(projectRoot)
    },
  }
}
