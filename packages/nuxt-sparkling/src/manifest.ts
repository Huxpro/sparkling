// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  SparklingManifestRoute,
  SparklingRouteManifest,
} from 'sparkling-navigation/shim-host';

/**
 * Structural copy of Nuxt's `NuxtPage` (the shape handed to the
 * `pages:extend` hook). Declared locally so this transform has no
 * build-time dependency on Nuxt internals; every field Nuxt emits that
 * we consume is represented here.
 */
export interface NuxtLikePage {
  name?: string;
  path: string;
  file?: string;
  /** vue-router named views — unsupported in MPA (single outlet per page). */
  meta?: Record<string, unknown> & { groups?: string[] };
  alias?: string | string[];
  redirect?: unknown;
  props?: unknown;
  children?: NuxtLikePage[];
}

export interface PagesToManifestOptions {
  origin?: string;
  base?: string;
  baseScheme?: string;
  externalScheme?: string | null;
  /**
   * Map a page `file` to the rspeedy build entry name. Defaults to the
   * page `name` (Nuxt guarantees uniqueness), falling back to a slug of
   * the absolute path.
   */
  entryForFile?(file: string, page: NuxtLikePage, absolutePath: string): string;
}

export type DiagnosticKind =
  | 'nested-outlet'
  | 'named-view'
  | 'redirect'
  | 'mixed-segment'
  | 'no-file'
  | 'dynamic-deep-link';

export interface ManifestDiagnostic {
  kind: DiagnosticKind;
  /** Absolute route path the diagnostic concerns. */
  path: string;
  /** Human-readable explanation, incl. whether it degrades or blocks. */
  message: string;
  /** true = feature works with a caveat; false = feature cannot work. */
  degraded: boolean;
}

export interface PagesToManifestResult {
  manifest: SparklingRouteManifest;
  diagnostics: ManifestDiagnostic[];
}

function slugify(path: string): string {
  const cleaned = path
    .replace(/^\//, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'index';
}

/** Join a relative Nuxt child path onto an absolute parent path. */
function joinAbsolute(parentAbs: string, childPath: string): string {
  if (childPath.startsWith('/')) return childPath;
  if (childPath === '') return parentAbs;
  const base = parentAbs === '/' ? '' : parentAbs.replace(/\/$/, '');
  return `${base}/${childPath}`;
}

/**
 * A segment mixing a literal with a param, or two params
 * (e.g. `route-:slug()`, `:b2()_:2b()`, `:opt?-postfix`). The runtime
 * matcher in sparkling-navigation only handles whole-segment params, so
 * flag these — they still round-trip as native opens, but in-context
 * matching of the param is not guaranteed.
 */
function isMixedSegment(path: string): boolean {
  return path
    .split('/')
    .some((seg) => {
      if (!seg.includes(':')) return false;
      // Pure param segments: ":name", ":name()", ":name(re)", with a
      // single trailing modifier and nothing else.
      return !/^:[\w]+(\([^)]*\))?[?+*]?$/.test(seg);
    });
}

interface Collected {
  page: NuxtLikePage;
  absolutePath: string;
  groups: string[];
  /** true when this file is a layout wrapper around non-index children. */
  wrapper: boolean;
}

/**
 * Flatten Nuxt's nested page tree into a URL→page table. In an MPA every
 * URL maps to exactly one bundle (isolated JS heap), so nested
 * `<NuxtPage>` outlets collapse: the deepest page owning an absolute path
 * wins (an index child overrides its parent for the same URL).
 */
function collect(
  pages: NuxtLikePage[],
  parentAbs: string,
  table: Map<string, Collected>,
  diagnostics: ManifestDiagnostic[],
): void {
  for (const page of pages) {
    const absolutePath = joinAbsolute(parentAbs, page.path);
    // Nuxt records the fully-resolved group list on each node's meta, so
    // use it directly rather than accumulating from ancestors.
    const groups = (page.meta?.groups as string[] | undefined) ?? [];
    const children = page.children ?? [];
    const hasIndexChild = children.some((c) => c.path === '');
    const nonIndexChildren = children.filter((c) => c.path !== '');

    if (page.file) {
      const existing = table.get(absolutePath);
      // Index children (reached with path '') are more specific than the
      // parent wrapper for the same URL — let them win.
      const isIndexOfParent = page.path === '' && absolutePath === parentAbs;
      if (!existing || isIndexOfParent) {
        table.set(absolutePath, { page, absolutePath, groups, wrapper: false });
      }

      // A file with non-index children is a persistent layout wrapper.
      // MPA cannot keep it mounted across child navigations (separate
      // heaps), so mark it degraded — the wrapper must be duplicated into
      // each child bundle or expressed as a native container.
      if (nonIndexChildren.length > 0) {
        diagnostics.push({
          kind: 'nested-outlet',
          path: absolutePath,
          degraded: true,
          message:
            `"${page.file}" wraps child routes via <NuxtPage>. In the MPA model each `
            + 'child opens as a separate native page (separate JS heap), so the wrapper is '
            + 'not kept mounted across them; duplicate shared layout into children or use a '
            + 'native container.',
        });
      }
      void hasIndexChild;
    }

    if (isMixedSegment(absolutePath)) {
      diagnostics.push({
        kind: 'mixed-segment',
        path: absolutePath,
        degraded: true,
        message:
          `Route "${absolutePath}" mixes literals and params within one segment; native `
          + 'navigation still works but in-page param matching of this route is best-effort.',
      });
    }

    if (children.length) {
      collect(children, absolutePath, table, diagnostics);
    }
  }
}

function normalizeManifestPath(absolutePath: string): string {
  if (absolutePath === '') return '/';
  return absolutePath;
}

/**
 * Transform a Nuxt page tree (as delivered to `pages:extend`) into a
 * Sparkling route manifest for the file-based MPA model, plus a list of
 * diagnostics describing anything that degrades or cannot cross JS heaps.
 */
export function pagesToSparklingManifest(
  pages: NuxtLikePage[],
  options: PagesToManifestOptions = {},
): PagesToManifestResult {
  const diagnostics: ManifestDiagnostic[] = [];
  const table = new Map<string, Collected>();
  collect(pages, options.base ?? '/', table, diagnostics);

  const entryFor = options.entryForFile
    ?? ((_file: string, page: NuxtLikePage, absolutePath: string) => page.name ?? slugify(absolutePath));

  const routes: SparklingManifestRoute[] = [];
  for (const { page, absolutePath, groups } of table.values()) {
    const entry = entryFor(page.file!, page, absolutePath);
    const meta: Record<string, unknown> = { ...(page.meta ?? {}) };
    if (groups.length) meta.groups = groups;

    if (page.redirect !== undefined) {
      diagnostics.push({
        kind: 'redirect',
        path: absolutePath,
        degraded: true,
        message:
          `Route "${absolutePath}" declares a redirect. Static/string redirects are encoded `
          + 'in the manifest for the host to resolve; function redirects run only once the '
          + 'target page has booted.',
      });
      meta.redirect = page.redirect;
    }

    routes.push({
      name: page.name,
      path: normalizeManifestPath(absolutePath),
      entry,
      bundle: `${entry}.lynx.bundle`,
      ...(Object.keys(meta).length ? { meta } : {}),
    });
  }

  // Emit routes in a stable, specificity-friendly order (static before
  // dynamic is handled by the matcher; here sort by path for determinism).
  routes.sort((a, b) => a.path.localeCompare(b.path));

  const manifest: SparklingRouteManifest = {
    version: 1,
    origin: options.origin,
    base: options.base,
    baseScheme: options.baseScheme,
    ...(options.externalScheme !== undefined ? { externalScheme: options.externalScheme } : {}),
    routes,
  };

  return { manifest, diagnostics };
}
