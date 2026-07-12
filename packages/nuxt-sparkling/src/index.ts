// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { pagesToSparklingManifest } from './manifest';
export type {
  NuxtLikePage,
  PagesToManifestOptions,
  PagesToManifestResult,
  ManifestDiagnostic,
  DiagnosticKind,
} from './manifest';
export { analyzePages, createNuxtSparklingModule } from './module';
export type { NuxtSparklingOptions, BuildManifestReport } from './module';
export {
  sparklingHistory,
  installSparklingShim,
  sparklingScrollBehavior,
} from './runtime/history';
export type { SparklingHistoryOptions } from './runtime/history';
