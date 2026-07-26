// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Root wrapper (used by generated per-route entries).
export { SparklingNextRoot } from './root';
export type {
  SparklingNextRootProps,
  PageComponent,
  LayoutComponent,
} from './root';

// next/link-compatible component (default + named export).
export { Link, default } from './link';
export type { LinkProps } from './link';

// next/navigation-compatible hooks and helpers.
export * from './navigation';

// Contexts (for advanced/interop use).
export {
  AppRouterContext,
  PathnameContext,
  SearchParamsContext,
  PathParamsContext,
} from './contexts';
export type { AppRouterInstance, NavigateOptions, Params } from './contexts';

// Manifest types + helpers (shared with build).
export {
  matchRoute,
  compilePattern,
  bundleNameForPattern,
  schemeForEntry,
} from '../shared/manifest';
export type {
  RouteManifest,
  RouteManifestEntry,
  RouteKind,
  RouteMatch,
} from '../shared/manifest';

// Error helpers (digest-compatible with Next.js).
export {
  isRedirectError,
  isNotFoundError,
  getURLFromRedirectError,
  getRedirectTypeFromError,
} from './errors';
