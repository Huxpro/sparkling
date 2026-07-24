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
  /**
   * Whether native page opens/closes animate. Passed straight through to
   * sparkling-navigation's `animated` option — page-transition animation is
   * a container concern, not something the app renders. Defaults to `true`.
   * A per-call `close({ animated })` still overrides this for that pop.
   *
   * NOTE (pending native support): today's sparkling SDK does not honor this
   * flag yet — iOS hardcodes animated pushes/pops and Android ignores the
   * option — so `animated: false` currently has no effect on device. The
   * option is plumbed through so behavior lights up when the SDK does.
   */
  animated?: boolean;
  /**
   * Fallback initial href when the launch query carries no `hrefParam`
   * (external deep links open a bundle directly, without the MPA transport
   * params). Pass the default route of the page this bundle serves —
   * falling back to `'/'` in a non-root bundle would render the root page's
   * UI inside the wrong container. Defaults to `'/'`.
   */
  defaultHref?: string;
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
    animated = true,
    defaultHref = '/',
  } = options;

  const query = () => getQueryItems?.() ?? {};

  // Built by hand instead of `new URL()`: the native Lynx JS runtime has no
  // URL/URLSearchParams globals, and this is the hot path of every cross-page
  // navigation. encodeURIComponent also encodes spaces as %20 (never +),
  // which is what sparkling's native scheme parser expects.
  function buildScheme(target: HostOpenTarget, depth: number): string {
    const pairs: Array<[string, string]> = [['bundle', bundleForPage(target.page.id)]];

    // Static container config resolved before the page boots.
    for (const [key, value] of Object.entries(target.page.containerParams ?? {})) {
      pairs.push([key, value]);
    }

    // MPA transport params: the destination router reconstructs its initial
    // location from these.
    pairs.push([hrefParam, target.href]);
    pairs.push([depthParam, String(depth)]);
    if (target.state !== undefined) {
      pairs.push([stateParam, JSON.stringify(target.state)]);
    }

    const qs = pairs
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return `${baseScheme}${baseScheme.includes('?') ? '&' : '?'}${qs}`;
  }

  return {
    getInitialHref() {
      const q = query();
      const href = q[hrefParam];
      if (typeof href === 'string' && href.length > 0) return href;
      // No transport param — this bundle was opened by an external deep link
      // (scheme without `hrefParam`). Fall back to the page's own default
      // route, not the app root: every bundle carries the full route tree, so
      // '/' here would render the root page's UI inside this container.
      return defaultHref;
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
          { scheme, options: { replace: target.replace, animated } },
          (result) => resolve({ ok: result.code === 1, message: result.msg }),
        );
      });
    },

    close(opts?: HostCloseOptions): Promise<HostNavigationResult> {
      // NOTE: `opts.result` has no native transport yet — sparkling's
      // router.close carries no payload and the SDK broadcasts no stack
      // events, so pop results are currently dropped on this host. The
      // memory host specifies the intended behavior; this lights up when
      // the native stack protocol grows its event face.
      return new Promise((resolve) => {
        navigation.close({ animated: opts?.animated ?? animated }, (result) =>
          resolve({ ok: result.code === 1, message: result.msg }),
        );
      });
    },
    // No subscribeStack: the native SDK is command-only today. Deliberately
    // omitted (rather than stubbed) so consumers can feature-detect.
  };
}
