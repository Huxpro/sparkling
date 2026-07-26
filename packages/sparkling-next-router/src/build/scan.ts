// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

const PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

export interface ScannedRoute {
  /** URL pattern, groups stripped: `/products/[id]`. */
  pattern: string;
  /** Absolute path of the page file. */
  pageFile: string;
  /** Absolute paths of layout files, outermost first (root layout first). */
  layoutFiles: string[];
  /** Nearest not-found file (walking up from the page dir), if any. */
  notFoundFile: string | null;
  /** Nearest loading file, if any. */
  loadingFile: string | null;
}

function findConventionFile(dir: string, name: string): string | null {
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path.join(dir, `${name}.${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function isPrivateDir(segment: string): boolean {
  return segment.startsWith('_');
}

/**
 * Scan a Next.js `app/` directory for page routes.
 *
 * Supported conventions: `page.*`, nested `layout.*`, `not-found.*`,
 * `loading.*`, dynamic `[param]`, catch-all `[...param]`, optional
 * catch-all `[[...param]]`, route groups `(group)` (stripped from the URL),
 * private folders `_name` (skipped).
 *
 * Ignored (out of MPA scope, reported by the caller): `route.*` handlers,
 * `template.*`, `default.*` (parallel routes), `@slot` dirs, intercepting
 * `(.)`/`(..)` segments.
 */
export function scanAppDir(appDir: string): { routes: ScannedRoute[]; skipped: string[] } {
  const absAppDir = path.resolve(appDir);
  if (!fs.existsSync(absAppDir)) {
    throw new Error(`sparkling-next-router: app directory not found: ${absAppDir}`);
  }
  const routes: ScannedRoute[] = [];
  const skipped: string[] = [];

  function visit(dir: string, urlSegments: string[], layouts: string[]): void {
    const layoutFile = findConventionFile(dir, 'layout');
    const nextLayouts = layoutFile ? [...layouts, layoutFile] : layouts;

    for (const name of ['route', 'template', 'default']) {
      if (findConventionFile(dir, name)) {
        skipped.push(`${path.relative(absAppDir, dir) || '.'}/${name}.* (unsupported convention)`);
      }
    }

    const pageFile = findConventionFile(dir, 'page');
    if (pageFile) {
      const pattern = '/' + urlSegments.join('/');
      routes.push({
        pattern: pattern === '//' ? '/' : pattern,
        pageFile,
        layoutFiles: nextLayouts,
        notFoundFile: findNearest(dir, 'not-found'),
        loadingFile: findNearest(dir, 'loading'),
      });
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const segment = entry.name;
      if (isPrivateDir(segment) || segment === 'node_modules') continue;
      if (segment.startsWith('@')) {
        skipped.push(`${path.relative(absAppDir, path.join(dir, segment))} (parallel route slot)`);
        continue;
      }
      if (/^\(\.{1,2}\)/.test(segment)) {
        skipped.push(`${path.relative(absAppDir, path.join(dir, segment))} (intercepting route)`);
        continue;
      }
      const childDir = path.join(dir, segment);
      if (isRouteGroup(segment)) {
        visit(childDir, urlSegments, nextLayouts);
      } else {
        visit(childDir, [...urlSegments, segment], nextLayouts);
      }
    }
  }

  function findNearest(dir: string, name: string): string | null {
    let current = dir;
    while (current.startsWith(absAppDir)) {
      const found = findConventionFile(current, name);
      if (found) return found;
      if (current === absAppDir) break;
      current = path.dirname(current);
    }
    return null;
  }

  visit(absAppDir, [], []);

  routes.sort((a, b) => a.pattern.localeCompare(b.pattern));
  return { routes, skipped };
}
