// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { scanAppDir } from './scan';
import { generateRouteModules } from './codegen';

export { scanAppDir } from './scan';
export type { ScannedRoute } from './scan';
export { generateRouteModules } from './codegen';

export interface NextAppRouterOptions {
  /** App directory (Next.js convention root). Default: `./app`. */
  appDir?: string;
  /** Scheme prefix for opening containers. Default: `hybrid://lynxview_page`. */
  baseScheme?: string;
  /** Where generated entries go. Default: `.sparkling/next-router`. */
  outDir?: string;
  /** Working directory. Default: `process.cwd()`. */
  cwd?: string;
  /** Log skipped/unsupported conventions. Default: true. */
  verbose?: boolean;
}

export interface NextAppRouterResult {
  /** rspeedy `source.entry`-compatible map (entry name → file). */
  entry: Record<string, string>;
  /** `resolve.alias`-compatible map (aliases `next/navigation` → adapter). */
  alias: Record<string, string>;
  /** Manifest module path (for direct imports in app code if needed). */
  manifestFile: string;
}

/**
 * Scan the app/ directory, generate per-route bundle entries + the route
 * manifest, and return the pieces to merge into an rspeedy config:
 *
 * ```ts
 * const nextRouter = createNextAppRouter({ appDir: './app' })
 * export default defineConfig({
 *   source: { entry: nextRouter.entry },
 *   // optional, lets `import ... from 'next/navigation'` compile unmodified:
 *   // tools: { rspack: { resolve: { alias: nextRouter.alias } } }
 * })
 * ```
 *
 * (Direct function rather than an rsbuild plugin: entries must exist before
 * config resolution, and this keeps us independent of plugin API churn.
 * We deliberately do not use `next-rspack` — it builds Next.js apps (RSC
 * graph, HTML output), not Lynx bundles; the piece of Next we need at build
 * time is the file convention, implemented here.)
 */
export function createNextAppRouter(options: NextAppRouterOptions = {}): NextAppRouterResult {
  const cwd = options.cwd ?? process.cwd();
  const appDir = path.resolve(cwd, options.appDir ?? './app');
  const { routes, skipped } = scanAppDir(appDir);
  if (routes.length === 0) {
    throw new Error(`sparkling-next-router: no page.* files found under ${appDir}`);
  }
  if (skipped.length > 0 && options.verbose !== false) {
    console.warn(
      `[sparkling-next-router] skipped unsupported conventions:\n` +
        skipped.map((s) => `  - ${s}`).join('\n'),
    );
  }
  const { entries, manifestFile } = generateRouteModules(cwd, routes, {
    baseScheme: options.baseScheme,
    outDir: options.outDir,
  });
  return {
    entry: entries,
    alias: {
      'next/navigation': 'sparkling-next-router/navigation',
      'next/link': 'sparkling-next-router/runtime',
    },
    manifestFile,
  };
}
