// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RouterHistory } from '@tanstack/history'
import { createCompositeHistory, type CompositeHistoryOptions } from './composite-history.js'
import { getGlobalStackMirror } from './global-stack-mirror.js'
import { createInMemoryStackProtocol } from './in-memory-stack.js'
import { createPipeStackProtocol } from './protocol-client.js'
import { initialPathFromQueryItems } from './scheme.js'
import type {
  ContainerIdentity,
  NativeStackProtocol,
  RouteManifest,
} from './types.js'

export interface CreateSparklingHistoryOptions {
  manifest: RouteManifest
  container: ContainerIdentity
  /** Inject a custom stack protocol (tests / demos). Defaults to pipe-backed. */
  stack?: NativeStackProtocol
  /** Soft-nav initial entries. Defaults to [`__path` from queryItems, `/`]. */
  initialEntries?: string[]
  queryItems?: Record<string, string | undefined>
  gesturePopsContainer?: boolean
  /**
   * Use the in-memory stack protocol instead of native pipe.
   * Useful for S0 soft-nav demos and unit tests.
   */
  memoryStack?: boolean
}

export interface SparklingRouterRuntime {
  history: RouterHistory
  stack: NativeStackProtocol
  mirror: ReturnType<typeof getGlobalStackMirror>
  container: ContainerIdentity
  manifest: RouteManifest
}

/**
 * Wire CompositeHistory + stack protocol for one container runtime.
 * Callers pass the result into TanStack `createRouter({ history, routeTree, isServer: false })`.
 */
export function createSparklingHistory(
  options: CreateSparklingHistoryOptions,
): SparklingRouterRuntime {
  const stack =
    options.stack ??
    (options.memoryStack
      ? createInMemoryStackProtocol({
          manifest: options.manifest,
          initial: { path: options.container.ownedRoutes[0] ?? '/' },
        })
      : createPipeStackProtocol())

  const bootstrap =
    options.initialEntries ??
    [initialPathFromQueryItems(options.queryItems, options.container.ownedRoutes[0] ?? '/')]

  const historyOptions: CompositeHistoryOptions = {
    container: options.container,
    manifest: options.manifest,
    stack,
    initialEntries: bootstrap,
    gesturePopsContainer: options.gesturePopsContainer,
  }

  const history = createCompositeHistory(historyOptions)

  return {
    history,
    stack,
    mirror: getGlobalStackMirror(),
    container: options.container,
    manifest: options.manifest,
  }
}

/**
 * Resolve the current container identity from a manifest + bundle name.
 */
export function resolveContainerIdentity(
  manifest: RouteManifest,
  bundle: string,
): ContainerIdentity {
  const found = manifest.containers.find((c) => c.bundle === bundle)
  if (!found) {
    return {
      bundle,
      ownedRoutes: ['/'],
      presentation: 'push',
    }
  }
  return {
    bundle: found.bundle,
    ownedRoutes: found.routes.map((r) => r.path),
    presentation: found.presentation,
  }
}
