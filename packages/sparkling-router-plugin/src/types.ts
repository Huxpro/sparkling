import type { RouteManifest } from 'sparkling-router';

export type AuthoringConvention = 'tanstack' | 'next';

export interface CompileRoutesOptions {
  convention: AuthoringConvention;
  routesDirectory: string;
  version?: string;
  schemeBase?: string;
}

export interface RouteSource {
  file: string;
  path: string;
  containerId: string;
  presentation: 'push' | 'modal';
  containerOptions?: Record<string, string>;
}

export interface CompileRoutesResult {
  manifest: RouteManifest;
  entries: Record<string, string>;
  routes: RouteSource[];
  diagnostics: string[];
}
