// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { scanRouteContainers } from './src/scan.js'
export { generateSparklingRoutes } from './src/generate.js'
export { sparklingRouterPlugin } from './src/plugin.js'
export {
  routePathFromFile,
  isContainerMarkerName,
  presentationFromMarkerName,
  containerIdFromDir,
} from './src/path-from-file.js'
export type {
  Presentation,
  ScannedRouteFile,
  ContainerPartition,
  ScanResult,
  PluginOptions,
} from './src/types.js'
export type { GenerateResult } from './src/generate.js'
export type { SparklingRouterPlugin } from './src/plugin.js'
