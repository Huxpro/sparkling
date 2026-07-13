// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export * from './types'
export { createHybridHistory, type HybridHistoryOptions } from './history'
export {
  createSparklingSchemeCodec,
  parseQuery,
  DEFAULT_SCHEME,
  ROUTE_PARAM,
  STATE_PARAM,
  DEPTH_PARAM,
  type SparklingCodecOptions,
} from './codec'
export {
  defineRouteManifest,
  matchPattern,
  findOwner,
  findByName,
  fillPattern,
  normalizeRoute,
  defaultLocationOf,
  type RouteManifest,
  type RouteManifestPage,
  type RouteManifestRoute,
  type OwnerLookup,
  type PatternMatch,
} from './manifest'
export {
  createMemoryNavigationEnvironment,
  type MemoryNavigationEnvironment,
  type SimulatedContainer,
} from './hosts/memory'
