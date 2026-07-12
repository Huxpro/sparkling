// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { createNavigationShim } from './shim';
export type {
  NavigationShim,
  ShimHistory,
  ShimLocation,
  ShimDocument,
  ShimWindow,
} from './shim';
export type {
  NavigationHost,
  HostOpenOptions,
  ShimHistoryEntry,
  ShimPopStateEvent,
  ShimEventListener,
} from './types';
export { SimpleEventTarget } from './events';
