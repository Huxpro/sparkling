// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Nuxt module: `nuxt-sparkling/module`.
 *
 * Wires Nuxt's file-based routing to Sparkling native navigation (MPA):
 *
 * 1. Hooks `pages:extend` to transform the resolved page tree into a
 *    Sparkling route manifest (via {@link pagesToSparklingManifest}) and
 *    exposes it to runtime as the virtual module `#sparkling/route-manifest`.
 * 2. Emits build diagnostics for anything that cannot cross JS heaps
 *    (nested outlets, mixed segments, redirects) so authors see, per the
 *    acceptance criteria, exactly which Nuxt features are supported /
 *    degraded / unsupported for their app.
 * 3. Sets Nuxt options that are incompatible with the Lynx JS context off
 *    by default (no DOM chunk-reload, no app manifest network probe, etc.).
 *
 * This file is authored against `@nuxt/kit`'s public API but declares the
 * few helpers it uses locally, so the package builds without Nuxt present
 * (Nuxt is a peer/consumer concern). When run inside Nuxt, `defineNuxtModule`
 * and friends are provided by the host.
 */

import { pagesToSparklingManifest } from './manifest';
import type { NuxtLikePage, ManifestDiagnostic, PagesToManifestOptions } from './manifest';

export interface NuxtSparklingOptions extends PagesToManifestOptions {
  /** Router mode for the runtime history (see runtime/history). Default 'memory'. */
  mode?: 'web' | 'memory';
  /** Fail the build if any non-degraded (blocking) diagnostic is found. Default false. */
  strict?: boolean;
  /** Print the per-feature support report at build time. Default true. */
  report?: boolean;
}

/**
 * Minimal structural surface of the pieces of `@nuxt/kit` / Nuxt we use.
 * Declared locally to avoid a hard build dependency on Nuxt.
 */
interface NuxtKit {
  defineNuxtModule<T>(def: {
    meta: { name: string; configKey: string };
    defaults?: Partial<T>;
    setup(options: T, nuxt: NuxtLike): void | Promise<void>;
  }): unknown;
  addTemplate(opts: { filename: string; getContents(): string; write?: boolean }): { dst: string };
  addTypeTemplate(opts: { filename: string; getContents(): string }): unknown;
  createResolver(url: string): { resolve(...p: string[]): string };
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

interface NuxtLike {
  options: {
    alias?: Record<string, string>;
    experimental?: Record<string, unknown>;
    [k: string]: unknown;
  };
  hook(name: 'pages:extend', cb: (pages: NuxtLikePage[]) => void): void;
  hook(name: string, cb: (...args: unknown[]) => void): void;
}

export interface BuildManifestReport {
  routeCount: number;
  diagnostics: ManifestDiagnostic[];
  supported: string[];
  degraded: string[];
  blocked: string[];
}

/**
 * Pure helper (also used by tests): produce the manifest + a
 * feature-classification report from a page tree.
 */
export function analyzePages(
  pages: NuxtLikePage[],
  options: NuxtSparklingOptions = {},
): { manifest: ReturnType<typeof pagesToSparklingManifest>['manifest']; report: BuildManifestReport } {
  const { manifest, diagnostics } = pagesToSparklingManifest(pages, options);
  const degraded = diagnostics.filter((d) => d.degraded).map((d) => `${d.kind} @ ${d.path}`);
  const blocked = diagnostics.filter((d) => !d.degraded).map((d) => `${d.kind} @ ${d.path}`);
  return {
    manifest,
    report: {
      routeCount: manifest.routes.length,
      diagnostics,
      supported: manifest.routes.map((r) => r.path),
      degraded,
      blocked,
    },
  };
}

/**
 * The Nuxt module factory. Call `createNuxtSparklingModule(kit)` with the
 * host's `@nuxt/kit` exports, or import the default from
 * `nuxt-sparkling/module` inside a Nuxt project (where the build resolves
 * `@nuxt/kit` for you).
 */
export function createNuxtSparklingModule(kit: NuxtKit): unknown {
  return kit.defineNuxtModule<NuxtSparklingOptions>({
    meta: { name: 'nuxt-sparkling', configKey: 'sparkling' },
    defaults: { mode: 'memory', strict: false, report: true },
    setup(options, nuxt) {
      // Disable browser-only Nuxt subsystems that would throw or hang in a
      // Lynx JS context (see docs/nuxt-web-api-dependencies).
      nuxt.options.experimental = {
        ...nuxt.options.experimental,
        emitRouteChunkError: false,
        appManifest: false,
        navigationRepaint: false,
        restoreState: false,
      };

      nuxt.hook('pages:extend', (pages) => {
        const { manifest, report } = analyzePages(pages, options);

        kit.addTemplate({
          filename: 'sparkling/route-manifest.mjs',
          write: true,
          getContents: () => `export default ${JSON.stringify(manifest, null, 2)}\n`,
        });
        kit.addTypeTemplate({
          filename: 'sparkling/route-manifest.d.ts',
          getContents: () =>
            'import type { SparklingRouteManifest } from \'sparkling-navigation/shim-host\'\n'
            + 'declare const manifest: SparklingRouteManifest\n'
            + 'export default manifest\n',
        });
        nuxt.options.alias ??= {};
        (nuxt.options.alias as Record<string, string>)['#sparkling/route-manifest']
          = '#build/sparkling/route-manifest.mjs';

        if (options.report !== false) {
          kit.logger.info(
            `[nuxt-sparkling] ${report.routeCount} route(s) → manifest. `
            + `${report.degraded.length} degraded, ${report.blocked.length} blocked.`,
          );
          for (const d of report.diagnostics) {
            const line = `[nuxt-sparkling] ${d.degraded ? 'degraded' : 'BLOCKED'}: ${d.kind} @ ${d.path} — ${d.message}`;
            if (d.degraded) kit.logger.warn(line);
            else kit.logger.error(line);
          }
        }

        if (options.strict && report.blocked.length) {
          throw new Error(
            `[nuxt-sparkling] ${report.blocked.length} blocking route issue(s) in strict mode:\n`
            + report.blocked.join('\n'),
          );
        }
      });
    },
  });
}
