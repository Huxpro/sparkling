// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Route collection for the TanStack file convention, with page-boundary
// resolution. Two ways to declare a boundary:
//
//   1. In-file:   `export const page = { id, ... }` inside a route file.
//   2. Directory: a `-container.ts` file whose `export const container = {...}`
//      claims every route in that directory (and below, unless overridden).
//
// The boundary file is prefixed `-` deliberately: the official TanStack
// generator EXCLUDES `-`-prefixed files from routing, while `_`-prefixed
// files become pathless layout routes. `_container.tsx` (as some prototypes
// used) would corrupt the generated route tree.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { extractExportedObjectLiteral } from './page-manifest.mjs';

const ROUTE_FILE = /\.(tsx?|jsx?)$/;
const CONTAINER_BASENAME = /^-container\.(tsx?|jsx?)$/;

function toPosix(p) {
  return p.split(sep).join('/');
}

/** Derive a route path from a file path relative to the routes dir. */
export function pathFromRelFile(rel) {
  const segments = toPosix(rel)
    .replace(ROUTE_FILE, '')
    .split('/')
    .flatMap((seg) => seg.split('.'))
    .filter((seg) => seg !== 'index' && seg.length > 0);
  return '/' + segments.join('/');
}

/** Extract the createFileRoute('...') path argument, if present. */
function extractRoutePath(src, rel) {
  const m = src.match(/createFileRoute\(\s*['"]([^'"]+)['"]\s*\)/);
  return m ? m[1] : pathFromRelFile(rel);
}

/** Nearest `-container.*` boundary marker, walking up to the routes root. */
function nearestContainer(routesDir, dirRel, cache) {
  const key = dirRel || '.';
  if (cache.has(key)) return cache.get(key);
  let marker;
  const dirAbs = join(routesDir, dirRel);
  for (const ext of ['ts', 'tsx', 'js', 'jsx']) {
    const candidate = join(dirAbs, `-container.${ext}`);
    if (existsSync(candidate)) {
      marker = extractExportedObjectLiteral(readFileSync(candidate, 'utf8'), 'container', candidate);
      if (!marker) {
        throw new Error(`collect-routes: ${candidate} must \`export const container = { ... }\`.`);
      }
      break;
    }
  }
  if (!marker && dirRel) {
    const parent = toPosix(dirRel).split('/').slice(0, -1).join('/');
    marker = nearestContainer(routesDir, parent, cache);
  }
  cache.set(key, marker);
  return marker;
}

/**
 * Collect route files under `routesDir` with their paths and page markers.
 * In-file `page` export wins over a directory `-container` marker.
 *
 * Throws on layout-route files: per-page tree pruning reconstructs each
 * page's tree as flat children of the root route, which is exactly the
 * demo's (and most MPAs') shape. Nested layout routes need hierarchy-aware
 * pruning — fail loud rather than emit a wrong tree.
 */
export function collectTanstackRoutes(routesDir) {
  const containerCache = new Map();
  const out = [];
  const walk = (dirRel) => {
    for (const entry of readdirSync(join(routesDir, dirRel), { withFileTypes: true })) {
      const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!ROUTE_FILE.test(entry.name)) continue;
      if (entry.name.startsWith('__')) continue; // __root
      if (entry.name.startsWith('-')) continue; // generator-excluded (incl. -container)
      if (entry.name.startsWith('_') || /(^|\.)route\.(tsx?|jsx?)$/.test(entry.name)) {
        throw new Error(
          `collect-routes: '${rel}' looks like a layout route. Per-page tree ` +
            `pruning supports flat route files only for now — remove the layout ` +
            `or disable pruning for this app.`,
        );
      }
      const abs = join(routesDir, rel);
      const src = readFileSync(abs, 'utf8');
      const inFile = extractExportedObjectLiteral(src, 'page', abs);
      const page = inFile ?? nearestContainer(routesDir, toPosix(dirRel), containerCache);
      out.push({ file: rel, path: extractRoutePath(src, rel), page });
    }
  };
  walk('');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
