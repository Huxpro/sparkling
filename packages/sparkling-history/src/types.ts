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
  /**
   * Close this page's native container, optionally handing a result back to
   * the page below (see {@link HostCloseOptions}). Unlike `back()`, this
   * always pops the *container* — the local in-page stack is irrelevant.
   * Extension beyond the `RouterHistory` shape; safe structurally.
   */
  closePage: (opts?: HostCloseOptions, navigateOpts?: NavigateOptions) => void;
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
   * How the destination container is presented. `push` (default) stacks a
   * full page; `modal` presents over the current one. Transported to the
   * host; native support is part of the stack-protocol work — hosts without
   * it treat every open as `push`.
   */
  presentation?: 'push' | 'modal';
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
  /**
   * JSON-serializable result handed back to the page below when this page
   * pops (the MPA analogue of `setResult`/`onActivityResult`). Delivered to
   * subscribers as the `result` of the corresponding `pop` stack event.
   * Requires a host with an event face; hosts without one ignore it.
   */
  result?: unknown;
}

export interface HostNavigationResult {
  ok: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Stack events — the host's event face
// ---------------------------------------------------------------------------

/** Why the native stack changed. */
export type StackChangeReason =
  /** A page was pushed (JS-initiated open). */
  | 'push'
  /** A page popped via a JS-initiated close. */
  | 'pop'
  /** The current page was replaced. */
  | 'replace'
  /**
   * The container popped a page on its own — hardware back, edge gesture,
   * nav-bar back button. JS is informed after the fact and must converge;
   * blockers cannot intercept this.
   */
  | 'container-back'
  /** The stack changed for a reason outside this app's control (deep link, system). */
  | 'external';

export interface StackChangedEvent {
  reason: StackChangeReason;
  /** Native stack depth after the change (0 = only the root page remains). */
  depth: number;
  /** Result carried by a `pop`/`container-back`, if the closing page set one. */
  result?: unknown;
}

/**
 * The optional event face of a {@link NavigationHost}. Command-only hosts
 * (today's sparkling binding — the native SDK does not broadcast stack
 * changes yet) simply omit `subscribeStack`; consumers must treat the
 * subscription as best-effort.
 */
export type StackSubscriber = (event: StackChangedEvent) => void;

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
  /**
   * Subscribe to native stack changes (see {@link StackChangedEvent}).
   * Optional: command-only hosts omit it. Returns an unsubscribe function.
   */
  subscribeStack?(subscriber: StackSubscriber): () => void;
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
