// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// A NavigationHost backed by sparkling-navigation. This is the concrete
// binding that lets a web-history-driven router perform *native* multi-page
// navigation: each route subtree lives in its own LynxView/JS context, and
// cross-page hrefs are turned into sparkling schemes opened by the native
// router.
import type {
  HostCloseOptions,
  HostNavigationResult,
  HostOpenTarget,
  NavigationHost,
} from '../types.js';

/**
 * The subset of `sparkling-navigation` this host needs. Declared structurally
 * so the package does not hard-depend on it (peer, optional) and so tests can
 * inject a fake.
 */
export interface SparklingNavigationApi {
  open(
    params: { scheme: string; options?: Record<string, unknown> },
    callback: (result: { code: number; msg: string }) => void,
  ): void;
  close(
    params: { animated?: boolean } | undefined,
    callback: (result: { code: number; msg: string }) => void,
  ): void;
}

export interface SparklingHostOptions {
  /**
   * The sparkling-navigation module (`{ open, close }`). Injected rather than
   * imported so this package stays dependency-light and unit-testable.
   */
  navigation: SparklingNavigationApi;
  /**
   * Reads this page's launch query params. On a real page pass
   * `() => lynx.__globalProps.queryItems`. The router's initial location is
   * reconstructed from these (see {@link readInitialHref}).
   */
  getQueryItems?: () => Record<string, string> | undefined;
  /**
   * The query-item key that carries the app-relative href of the current
   * page. Defaults to `__mpa_href`. The host writes it when opening a page
   * and reads it back to seed the destination router's initial location.
   */
  hrefParam?: string;
  /** The query-item key that carries the native stack depth. Default `__mpa_depth`. */
  depthParam?: string;
  /** The query-item key that carries serialized navigation state. Default `__mpa_state`. */
  stateParam?: string;
  /** Base sparkling scheme host. Default `hybrid://lynxview_page`. */
  baseScheme?: string;
  /**
   * Maps a resolved page id to its bundle path. Default: `<id>.lynx.bundle`
   * with any leading slash of the id stripped.
   */
  bundleForPage?: (pageId: string) => string;
}

const DEFAULT_HREF_PARAM = '__mpa_href';
const DEFAULT_DEPTH_PARAM = '__mpa_depth';
const DEFAULT_STATE_PARAM = '__mpa_state';
const DEFAULT_BASE_SCHEME = 'hybrid://lynxview_page';

function defaultBundleForPage(pageId: string): string {
  const id = pageId.replace(/^\//, '');
  return id.endsWith('.lynx.bundle') ? id : `${id}.lynx.bundle`;
}

/**
 * Build a sparkling `NavigationHost`.
 *
 * @example
 * ```ts
 * import * as navigation from 'sparkling-navigation';
 * const host = createSparklingHost({
 *   navigation,
 *   getQueryItems: () => lynx.__globalProps.queryItems,
 * });
 * const history = createMpaHistory({ host, resolvePage });
 * ```
 */
export function createSparklingHost(options: SparklingHostOptions): NavigationHost {
  const {
    navigation,
    getQueryItems,
    hrefParam = DEFAULT_HREF_PARAM,
    depthParam = DEFAULT_DEPTH_PARAM,
    stateParam = DEFAULT_STATE_PARAM,
    baseScheme = DEFAULT_BASE_SCHEME,
    bundleForPage = defaultBundleForPage,
  } = options;

  const query = () => getQueryItems?.() ?? {};

  function buildScheme(target: HostOpenTarget, depth: number): string {
    const bundle = bundleForPage(target.page.id);
    const url = new URL(baseScheme);
    url.searchParams.set('bundle', bundle);

    // Static container config resolved before the page boots.
    for (const [key, value] of Object.entries(target.page.containerParams ?? {})) {
      url.searchParams.set(key, value);
    }

    // MPA transport params: the destination router reconstructs its initial
    // location from these.
    url.searchParams.set(hrefParam, target.href);
    url.searchParams.set(depthParam, String(depth));
    if (target.state !== undefined) {
      url.searchParams.set(stateParam, JSON.stringify(target.state));
    }

    // sparkling's native URL parser wants %20, not + for spaces.
    return url.toString().replace(/\+/g, '%20');
  }

  return {
    getInitialHref() {
      const q = query();
      const href = q[hrefParam];
      if (typeof href === 'string' && href.length > 0) return href;
      // Fall back to '/', the router's root.
      return '/';
    },

    getStackDepth() {
      const q = query();
      const raw = q[depthParam];
      const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    },

    getInitialState() {
      const q = query();
      const raw = q[stateParam];
      if (typeof raw !== 'string' || raw.length === 0) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },

    open(target: HostOpenTarget): Promise<HostNavigationResult> {
      const depth = this.getStackDepth!() + 1;
      const scheme = buildScheme(target, depth);
      return new Promise((resolve) => {
        navigation.open(
          { scheme, options: { replace: target.replace } },
          (result) => resolve({ ok: result.code === 1, message: result.msg }),
        );
      });
    },

    close(opts?: HostCloseOptions): Promise<HostNavigationResult> {
      return new Promise((resolve) => {
        navigation.close({ animated: opts?.animated }, (result) =>
          resolve({ ok: result.code === 1, message: result.msg }),
        );
      });
    },
  };
}
