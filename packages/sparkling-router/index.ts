// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type {
  StackEntry,
  StackState,
  NavResult,
  StackChangeReason,
  StackChangedEvent,
  NativeStackProtocol,
  RouteManifest,
  RouteManifestContainer,
  ContainerIdentity,
} from './src/types.js'

export {
  DEFAULT_SCHEME_BASE,
  STACK_CHANGED_EVENT,
  PATH_QUERY_KEY,
} from './src/types.js'

export {
  matchPathPattern,
  isPathOwnedBy,
  resolveContainerForPath,
  normalizePathname,
  parseSearch,
  serializeSearch,
  splitHref,
} from './src/path-match.js'

export {
  pathToScheme,
  initialPathFromQueryItems,
  hrefFromPathAndSearch,
} from './src/scheme.js'

export {
  GlobalStackMirror,
  getGlobalStackMirror,
  __setGlobalStackMirrorForTests,
} from './src/global-stack-mirror.js'
export type { StackMirrorListener } from './src/global-stack-mirror.js'

export { createInMemoryStackProtocol } from './src/in-memory-stack.js'
export type { InMemoryStackOptions } from './src/in-memory-stack.js'

export { createCompositeHistory } from './src/composite-history.js'
export type { CompositeHistoryOptions } from './src/composite-history.js'

export { createPipeStackProtocol } from './src/protocol-client.js'

export {
  createSparklingHistory,
  resolveContainerIdentity,
} from './src/create-router.js'
export type {
  CreateSparklingHistoryOptions,
  SparklingRouterRuntime,
} from './src/create-router.js'
