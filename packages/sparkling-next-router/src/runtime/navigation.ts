// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * API-compatible subset of `next/navigation` for ReactLynx.
 *
 * Build integration aliases `next/navigation` to this module, so app code
 * (and ported Next.js examples) compile unmodified.
 */
import { useContext } from '@lynx-js/react';
import {
  AppRouterContext,
  PathnameContext,
  PathParamsContext,
  SearchParamsContext,
  type AppRouterInstance,
  type Params,
} from './contexts';
import { ReadonlyURLSearchParams } from './search-params';

export { redirect, permanentRedirect, notFound, RedirectType } from './errors';
export { ReadonlyURLSearchParams };
export type { AppRouterInstance };

export function useRouter(): AppRouterInstance {
  const router = useContext(AppRouterContext);
  if (router === null) {
    throw new Error('invariant expected app router to be mounted');
  }
  return router;
}

export function usePathname(): string {
  const pathname = useContext(PathnameContext);
  if (pathname === null) {
    throw new Error('invariant expected pathname context to be mounted');
  }
  return pathname;
}

export function useSearchParams(): ReadonlyURLSearchParams {
  const searchParams = useContext(SearchParamsContext);
  if (searchParams === null) {
    throw new Error('invariant expected search params context to be mounted');
  }
  return searchParams;
}

export function useParams<T extends Params = Params>(): T {
  const params = useContext(PathParamsContext);
  if (params === null) {
    throw new Error('invariant expected params context to be mounted');
  }
  return params as T;
}

/**
 * Segment introspection hooks: on Sparkling every page is its own container,
 * so only the segments below this page's layout chain exist locally.
 */
export function useSelectedLayoutSegments(): string[] {
  const pathname = useContext(PathnameContext) ?? '/';
  return pathname.split('/').filter((s) => s.length > 0);
}

export function useSelectedLayoutSegment(): string | null {
  const segments = useSelectedLayoutSegments();
  return segments.length > 0 ? segments[0] : null;
}
