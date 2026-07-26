// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type Presentation = 'push' | 'modal'

export interface ScannedRouteFile {
  /** Absolute file path. */
  filePath: string
  /** Path relative to routes directory, posix style. */
  relativePath: string
  /** True when this file marks a hard container boundary. */
  isContainerMarker: boolean
  presentation: Presentation
}

export interface ContainerPartition {
  /** Stable bundle / entry name (e.g. `feed`, `settings`). */
  id: string
  presentation: Presentation
  /** Directory that owns this container (relative to routesDir), '' for root singles. */
  dir: string
  /** Marker file path if present. */
  markerFile?: string
  /** Route files belonging to this container (relative to routesDir). */
  routeFiles: string[]
  /** URL path patterns owned by this container. */
  routes: Array<{ path: string }>
  containerOptions?: Record<string, string>
}

export interface ScanResult {
  routesDir: string
  containers: ContainerPartition[]
  rootFiles: string[]
}

export interface PluginOptions {
  /** Directory containing TanStack-style route files. Default: `src/routes`. */
  routesDirectory?: string
  /** Output path for the generated manifest JSON. Default: `src/route-manifest.gen.json`. */
  manifestOutput?: string
  /** Output directory for per-container generated stubs. Default: `src/generated/containers`. */
  containersOutput?: string
  /** Scheme base written into the manifest. */
  schemeBase?: string
  /** Manifest version string (skew reserved). */
  manifestVersion?: string
  /** When true, also emit rspeedy `source.entry` map JSON. Default: true. */
  emitEntries?: boolean
}
