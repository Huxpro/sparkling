// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A parsed location. Structurally identical to `HistoryLocation` from
 * `@tanstack/history` so an `MpaHistory` can be handed to TanStack Router
 * directly, but declared locally so this package has zero dependencies and
 * can back other routers (React Router, custom) through the same contract.
 */
export interface HistoryLocation {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  state: ParsedHistoryState;
}

/**
 * Entry state. `__TSR_index` is the position of the entry in the logical
 * history stack. In an MPA world this index is *global across native pages*:
 * it is seeded with the native stack depth of the page (see
 * `NavigationHost.getStackDepth`), so `canGoBack()` (and TanStack's
 * `useCanGoBack`) stays true on a pushed page even when the local in-page
 * stack is at its root.
 */
export type ParsedHistoryState = {
  key?: string;
  __TSR_key?: string;
  __TSR_index: number;
} & Record<string, unknown>;

export type HistoryAction = 'PUSH' | 'REPLACE' | 'FORWARD' | 'BACK' | 'GO';

export type SubscriberHistoryAction =
  | { type: Exclude<HistoryAction, 'GO'> }
  | { type: 'GO'; index: number };

export interface SubscriberArgs {
  location: HistoryLocation;
  action: SubscriberHistoryAction;
}

export interface NavigateOptions {
  ignoreBlocker?: boolean;
}

export type BlockerFnArgs = {
  currentLocation: HistoryLocation;
  nextLocation: HistoryLocation;
  action: HistoryAction;
};

/** Return truthy to block the navigation. */
export type BlockerFn = (args: BlockerFnArgs) => Promise<boolean> | boolean;

export type NavigationBlocker = {
  blockerFn: BlockerFn;
  /** Web-only concept; accepted for API compatibility, unused on Lynx. */
  enableBeforeUnload?: (() => boolean) | boolean;
};

/**
 * The history object produced by `createMpaHistory`.
 *
 * Structurally compatible with `RouterHistory` from `@tanstack/history`
 * (same members, same semantics for the single-page subset), with one
 * deliberate difference: navigation blockers run in any JS environment,
 * not only when a global `document` exists.
 */
export interface MpaHistory {
  readonly location: HistoryLocation;
  readonly length: number;
  subscribers: Set<(opts: SubscriberArgs) => void>;
  subscribe: (cb: (opts: SubscriberArgs) => void) => () => void;
  push: (path: string, state?: unknown, navigateOpts?: NavigateOptions) => void;
  replace: (path: string, state?: unknown, navigateOpts?: NavigateOptions) => void;
  go: (index: number, navigateOpts?: NavigateOptions) => void;
  back: (navigateOpts?: NavigateOptions) => void;
  forward: (navigateOpts?: NavigateOptions) => void;
  canGoBack: () => boolean;
  createHref: (href: string) => string;
  block: (blocker: NavigationBlocker) => () => void;
  flush: () => void;
  destroy: () => void;
  notify: (action: SubscriberHistoryAction) => void;
  _ignoreSubscribers?: boolean;
}

// ---------------------------------------------------------------------------
// NavigationHost — the API contract a container platform implements
// ---------------------------------------------------------------------------

/**
 * A page (routing subtree) that lives in its own container / JS context.
 * `id` conventionally maps to a bundle name (`<id>.lynx.bundle` on
 * sparkling), but the host decides how to interpret it.
 */
export interface PageTarget {
  id: string;
  /**
   * Static container configuration resolved *before* the target page's JS
   * boots (title, nav bar, orientation, ... — sparkling scheme params).
   */
  containerParams?: Record<string, string>;
}

export interface HostOpenTarget {
  /** App-relative destination href: `pathname?search#hash`. */
  href: string;
  /** The resolved destination page. */
  page: PageTarget;
  /** Replace the current page instead of pushing a new one. */
  replace: boolean;
  /**
   * JSON-serializable navigation state to hand to the destination page
   * (delivered as its initial `location.state`). Hosts transport it out of
   * band of the href (e.g. a scheme query param).
   */
  state?: unknown;
}

export interface HostCloseOptions {
  animated?: boolean;
}

export interface HostNavigationResult {
  ok: boolean;
  message?: string;
}

/**
 * The contract between the history shim and a native multi-page container.
 *
 * Anything that can (1) report the URL and stack depth it was launched
 * with, (2) open a new page for an href, and (3) close itself, can host a
 * URL-driven router. sparkling-navigation is one implementation; a plain
 * browser window or a test double are others.
 */
export interface NavigationHost {
  /** The app-relative href (`pathname?search#hash`) this page was launched with. */
  getInitialHref(): string;
  /**
   * Depth of this page in the native stack (0 = root page). Used to seed
   * `__TSR_index` so back-affordances work across page boundaries.
   */
  getStackDepth?(): number;
  /** Initial navigation state handed over by the opener, if any. */
  getInitialState?(): unknown;
  /** Ask the container to open (push or replace) another page. */
  open(target: HostOpenTarget): void | Promise<HostNavigationResult>;
  /** Ask the container to close/pop the current page. */
  close(opts?: HostCloseOptions): void | Promise<HostNavigationResult>;
}

// ---------------------------------------------------------------------------
// Page resolution
// ---------------------------------------------------------------------------

/**
 * Decides whether a destination href belongs to another page (returning its
 * `PageTarget`) or to the current page (returning `null`, letting the
 * navigation stay in-page as a plain SPA transition).
 */
export type PageResolver = (
  href: string,
  ctx: { currentHref: string },
) => PageTarget | null;

export interface CreateMpaHistoryOptions {
  host: NavigationHost;
  /**
   * Cross-page decision function. Defaults to `() => null` (everything is
   * in-page — degenerates to a memory history seeded from the host).
   */
  resolvePage?: PageResolver;
  /** Override the initial href reported by the host. */
  initialHref?: string;
  /** Called when the host rejects an open/close request. */
  onHostError?: (error: unknown) => void;
}
