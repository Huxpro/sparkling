// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Resolution, UrlLike, UrlResolver } from 'sparkling-history-shim';
import { matchRoute, schemeForEntry, type RouteManifest } from '../shared/manifest';

/**
 * UrlResolver backed by the generated route manifest.
 *
 * - target route === current route's bundle → same-page (virtual history)
 * - target route resolves to a different bundle → cross-page (host.open)
 * - target route not in the manifest → external (host passthrough)
 */
export function createManifestResolver(manifest: RouteManifest, currentRoute: string): UrlResolver {
  const currentMatch = matchRoute(manifest, patternToConcretePath(currentRoute));
  const currentBundle = currentMatch?.entry.bundle ?? null;

  return {
    resolve(url: UrlLike): Resolution {
      const match = matchRoute(manifest, url.pathname);
      if (!match) {
        return { kind: 'external', url: url.href };
      }
      if (match.entry.bundle === currentBundle) {
        return { kind: 'same-page', scheme: schemeForEntry(manifest, match.entry) };
      }
      return { kind: 'cross-page', scheme: schemeForEntry(manifest, match.entry) };
    },
  };
}

/**
 * A route *pattern* (`/products/[id]`) is not a concrete path, but the
 * current container's route pattern must match itself in the manifest to
 * discover its own bundle. Replace param placeholders with a stub segment.
 */
function patternToConcretePath(pattern: string): string {
  return pattern
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, '_')
    .replace(/\[\.\.\.[^\]]+\]/g, '_')
    .replace(/\[[^\]]+\]/g, '_');
}
