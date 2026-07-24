// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { PageResolver, PageTarget } from './types.js';

export interface PageManifestEntry {
  /** Page id (bundle basename on sparkling). */
  id: string;
  /**
   * Path prefixes owned by this page. The longest matching prefix across all
   * entries wins. Use `/` for the root page (matches everything not claimed
   * by a more specific page).
   */
  paths: Array<string>;
  /** Static container config applied when opening this page. */
  containerParams?: Record<string, string>;
  /**
   * The route to render when this page's bundle is opened without an
   * explicit href (external deep link). Falls back to the page's shortest
   * path prefix, then `'/'`.
   */
  defaultHref?: string;
}

/**
 * A file-based route manifest: the pre-generated metadata that connects
 * routes (which live in separate JS contexts and cannot share memory) to
 * native pages. This is the artifact a codegen step would emit.
 */
export interface PageManifest {
  pages: Array<PageManifestEntry>;
}

function pathnameOf(href: string): string {
  const q = href.indexOf('?');
  const h = href.indexOf('#');
  let end = href.length;
  if (q > -1) end = Math.min(end, q);
  if (h > -1) end = Math.min(end, h);
  return href.substring(0, end) || '/';
}

function matchLen(pathname: string, prefix: string): number {
  if (prefix === '/') return pathname === '/' ? 1 : 0.5; // root is the fallback
  if (pathname === prefix) return prefix.length + 1;
  if (pathname.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')) {
    return prefix.length;
  }
  return 0;
}

/**
 * Build a {@link PageResolver} from a manifest. A destination href resolves to
 * the page owning the longest matching path prefix; if that is the *current*
 * page, the resolver returns `null` so the navigation stays in-page.
 */
/**
 * The initial href a page's bundle should render when launched without MPA
 * transport params (external deep link). Pass this as the sparkling host's
 * `defaultHref`.
 */
export function defaultHrefForPage(manifest: PageManifest, pageId: string): string {
  const page = manifest.pages.find((p) => p.id === pageId);
  if (!page) return '/';
  if (page.defaultHref) return page.defaultHref;
  // Shortest owned prefix is the page's most general route.
  const sorted = [...page.paths].sort((a, b) => a.length - b.length);
  return sorted[0] ?? '/';
}

export function createManifestPageResolver(manifest: PageManifest): PageResolver {
  const pageOf = (href: string): PageManifestEntry | undefined => {
    const pathname = pathnameOf(href);
    let best: PageManifestEntry | undefined;
    let bestLen = 0;
    for (const page of manifest.pages) {
      for (const prefix of page.paths) {
        const len = matchLen(pathname, prefix);
        if (len > bestLen) {
          bestLen = len;
          best = page;
        }
      }
    }
    return best;
  };

  return (href, ctx) => {
    const destPage = pageOf(href);
    const currentPage = pageOf(ctx.currentHref);
    if (!destPage) return null;
    // Same page → in-page transition.
    if (currentPage && destPage.id === currentPage.id) return null;
    const target: PageTarget = { id: destPage.id };
    if (destPage.containerParams) target.containerParams = destPage.containerParams;
    return target;
  };
}
