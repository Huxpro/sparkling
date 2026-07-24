// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// sparkling-history: a reusable web-history shim that lets URL-driven routers
// (TanStack Router, React Router, ...) drive native multi-page navigation.
//
// Layering:
//   NavigationHost (contract)  ->  createMpaHistory (web-history shim)  ->  router
//        ^ implemented by                     ^ consumed by
//     createSparklingHost / createMemoryHost / your own
//
// The shim implements the `RouterHistory` shape from `@tanstack/history`, so
// the result of `createMpaHistory` can be passed straight to
// `createRouter({ history })`.

export { createMpaHistory } from './create-mpa-history.js';
export { parseHref, sanitizePath, assignKeyAndIndex, createRandomKey } from './parse-href.js';
export {
  createManifestPageResolver,
  defaultHrefForPage,
  type PageManifest,
  type PageManifestEntry,
} from './resolve-page.js';
export { createMemoryHost, type MemoryHost, type MemoryHostOptions } from './hosts/memory.js';
export {
  createStackMirror,
  type StackMirror,
  type StackMirrorSnapshot,
} from './stack-mirror.js';

export type {
  HistoryLocation,
  ParsedHistoryState,
  HistoryAction,
  SubscriberArgs,
  SubscriberHistoryAction,
  NavigateOptions,
  BlockerFn,
  BlockerFnArgs,
  NavigationBlocker,
  MpaHistory,
  NavigationHost,
  PageTarget,
  PageResolver,
  HostOpenTarget,
  HostCloseOptions,
  HostNavigationResult,
  CreateMpaHistoryOptions,
  StackChangeReason,
  StackChangedEvent,
  StackSubscriber,
} from './types.js';
