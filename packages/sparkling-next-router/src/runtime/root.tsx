// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from '@lynx-js/react';
import { createNavigationShim, ensureUrlGlobals, type NavigationShim } from 'sparkling-history-shim';
import { createSparklingHost } from 'sparkling-history-shim/sparkling-host';
import {
  AppRouterContext,
  PathParamsContext,
  PathnameContext,
  SearchParamsContext,
  type AppRouterInstance,
  type Params,
} from './contexts';
import { ReadonlyURLSearchParams } from './search-params';
import { createManifestResolver } from './resolver';
import { createRouterInstance } from './router-instance';
import {
  getRedirectTypeFromError,
  getURLFromRedirectError,
  isNotFoundError,
  isRedirectError,
  RedirectType,
} from './errors';
import { matchRoute, type RouteManifest } from '../shared/manifest';

export type PageComponent = (props: { params: Params; searchParams: Record<string, string> }) => ReactNode;
export type LayoutComponent = (props: { children: ReactNode; params: Params }) => ReactNode;

export interface SparklingNextRootProps {
  manifest: RouteManifest;
  /** This container's route pattern, e.g. `/products/[id]`. */
  route: string;
  /** Layout chain, outermost (root layout) first. */
  layouts: LayoutComponent[];
  page: PageComponent;
  notFound?: () => ReactNode;
  loading?: () => ReactNode;
  /** Injected host/shim for testing; defaults to the sparkling host. */
  createShim?: () => NavigationShim;
}

interface UrlState {
  pathname: string;
  search: string;
  params: Params;
}

function deriveUrlState(shim: NavigationShim, manifest: RouteManifest): UrlState {
  const pathname = shim.location.pathname;
  const search = shim.location.search;
  const match = matchRoute(manifest, pathname);
  return { pathname, search, params: match?.params ?? {} };
}

/**
 * Root wrapper compiled into every route bundle. Owns the navigation shim
 * for this container and provides the next/navigation contexts.
 */
export function SparklingNextRoot(props: SparklingNextRootProps): ReactNode {
  const { manifest, route, layouts, page: Page, notFound, createShim } = props;

  // Ensure URL/URLSearchParams exist before anything parses a URL.
  ensureUrlGlobals();

  const shimRef = useRef<NavigationShim | null>(null);
  if (shimRef.current === null) {
    shimRef.current =
      createShim?.() ??
      createNavigationShim(createSparklingHost(manifest.baseScheme), createManifestResolver(manifest, route), {
        defaultRoute: firstConcreteRoute(manifest, route),
      });
  }
  const shim = shimRef.current;

  const [urlState, setUrlState] = useState<UrlState>(() => deriveUrlState(shim, manifest));
  const [refreshToken, setRefreshToken] = useState(0);

  const syncUrl = useCallback(() => {
    setUrlState(deriveUrlState(shim, manifest));
  }, [shim, manifest]);

  const router = useMemo<AppRouterInstance>(
    () =>
      createRouterInstance(shim, {
        onUrlChange: syncUrl,
        onRefresh: () => setRefreshToken((t) => t + 1),
        warn: (m) => console.warn(`[sparkling-next-router] ${m}`),
      }),
    [shim, syncUrl],
  );

  useEffect(() => {
    const onPop = () => syncUrl();
    shim.events.addEventListener('popstate', onPop);
    shim.events.addEventListener('pageshow', onPop);
    return () => {
      shim.events.removeEventListener('popstate', onPop);
      shim.events.removeEventListener('pageshow', onPop);
      shim.dispose();
    };
  }, [shim, syncUrl]);

  const searchParams = useMemo(() => new ReadonlyURLSearchParams(urlState.search), [urlState.search]);
  const searchParamsObject = useMemo(() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }, [searchParams]);

  // Compose the page inside its layout chain (innermost layout closest to page).
  let tree: ReactNode = <Page params={urlState.params} searchParams={searchParamsObject} />;
  for (let i = layouts.length - 1; i >= 0; i--) {
    const Layout = layouts[i];
    tree = <Layout params={urlState.params}>{tree}</Layout>;
  }

  return (
    <NavigationErrorBoundary router={router} notFound={notFound} key={refreshToken}>
      <AppRouterContext.Provider value={router}>
        <PathnameContext.Provider value={urlState.pathname}>
          <SearchParamsContext.Provider value={searchParams}>
            <PathParamsContext.Provider value={urlState.params}>{tree}</PathParamsContext.Provider>
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    </NavigationErrorBoundary>
  );
}

function firstConcreteRoute(manifest: RouteManifest, route: string): string {
  // For a static route, its pattern is already concrete.
  if (!route.includes('[')) return route;
  return route
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, '_')
    .replace(/\[\.\.\.[^\]]+\]/g, '_')
    .replace(/\[[^\]]+\]/g, '_');
}

interface BoundaryProps {
  router: AppRouterInstance;
  notFound?: () => ReactNode;
  children: ReactNode;
}

interface BoundaryState {
  notFound: boolean;
}

/**
 * Translates thrown `redirect()`/`notFound()` (Next's error-digest protocol)
 * into router actions / not-found UI — same behavior as Next's
 * RedirectBoundary + NotFoundBoundary, but expressed for Lynx.
 */
class NavigationErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { notFound: false };
  }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> | null {
    if (isNotFoundError(error)) {
      return { notFound: true };
    }
    if (isRedirectError(error)) {
      return null; // handled in componentDidCatch
    }
    throw error;
  }

  componentDidCatch(error: unknown): void {
    if (isRedirectError(error)) {
      const url = getURLFromRedirectError(error);
      const type = getRedirectTypeFromError(error);
      if (type === RedirectType.push) {
        this.props.router.push(url);
      } else {
        this.props.router.replace(url);
      }
    }
  }

  render(): ReactNode {
    if (this.state.notFound) {
      return this.props.notFound ? this.props.notFound() : null;
    }
    return this.props.children;
  }
}
