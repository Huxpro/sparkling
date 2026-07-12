// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * L0 — Host Navigation Contract.
 *
 * The minimal capability set the shim needs from a native navigation
 * system. `sparkling-navigation` implements this on Android, iOS, and the
 * web shell; any other host (or framework) can implement it too.
 */
export interface NavigationHost {
  /** Open a new container for `scheme`. Resolves when the host accepted it. */
  open(scheme: string): Promise<void>;
  /** Pop the current container off the native stack. */
  close(): Promise<void>;
  /** The scheme URL this container was opened with (including query params). */
  initialUrl(): string;
  /** Stable identity of this container (diagnostics, state keys). */
  containerId(): string;
  /** Visibility lifecycle; used for pageshow/pagehide emulation. Returns an unsubscribe. */
  onShow?(cb: () => void): () => void;
  onHide?(cb: () => void): () => void;
  /** Hard-reload the current container. */
  reload?(): void;
}

/**
 * Decision for a given target URL, supplied by the routing layer (L2).
 * The shim itself has zero routing knowledge.
 */
export type Resolution =
  /** Target renders inside the current container (virtual history entry). */
  | { kind: 'same-page'; scheme?: string }
  /** Target is another page of this app: open a new container with `scheme`. */
  | { kind: 'cross-page'; scheme: string }
  /** Not part of this app; hand the raw URL to the host. */
  | { kind: 'external'; url: string };

export interface UrlResolver {
  /**
   * Classify a navigation to `url` originating from `current`.
   * Both URLs are absolute on the shim's synthetic origin (except
   * external ones, which keep their own origin).
   */
  resolve(url: UrlLike, current: UrlLike): Resolution;
}

/** Structural subset of WHATWG URL that the shim relies on. */
export interface UrlLike {
  href: string;
  origin: string;
  protocol: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
}

export interface ShimOptions {
  /**
   * Synthetic origin the app lives on. Default: `sparkling://app`.
   * `location.origin` returns this; URLs on other origins resolve external.
   */
  origin?: string;
  /**
   * Initial in-app URL when the host scheme carries no `__shim_route`.
   * Default: `/`.
   */
  defaultRoute?: string;
  /** Max serialized byte length for cross-page history.state. Default 4096. */
  maxStateBytes?: number;
  /** Warning sink; defaults to console.warn. */
  warn?(message: string): void;
}

/** Reserved query params on sparkling schemes generated/consumed by the shim. */
export const SHIM_ROUTE_PARAM = '__shim_route';
export const SHIM_STATE_PARAM = '__shim_state';

export interface ShimHistory {
  readonly length: number;
  readonly state: unknown;
  pushState(state: unknown, unused: string, url?: string | null): void;
  replaceState(state: unknown, unused: string, url?: string | null): void;
  back(): void;
  forward(): void;
  go(delta?: number): void;
}

export interface ShimLocation {
  readonly href: string;
  readonly origin: string;
  readonly protocol: string;
  readonly host: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  assign(url: string): void;
  replace(url: string): void;
  reload(): void;
  toString(): string;
}

export interface ShimEvent {
  type: string;
  [key: string]: unknown;
}

export interface ShimEventTarget {
  addEventListener(type: string, listener: (event: ShimEvent) => void): void;
  removeEventListener(type: string, listener: (event: ShimEvent) => void): void;
  dispatchEvent(event: ShimEvent): void;
}

export interface NavigationShim {
  history: ShimHistory;
  location: ShimLocation;
  events: ShimEventTarget;
  /** Parse/construct URLs with the same implementation the shim uses. */
  createUrl(url: string, base?: string): UrlLike;
  /**
   * Attach `history`, `location`, `addEventListener`… onto a global-ish
   * object for frameworks that talk to `window.*` directly.
   */
  installGlobals(target: Record<string, unknown>): void;
  /** Dispose listeners registered on the host. */
  dispose(): void;
}
