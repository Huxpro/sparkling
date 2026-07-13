// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Core contracts of the sparkling-history shim.
 *
 * The types in this file intentionally mirror the shape of vue-router's
 * `RouterHistory` interface (vue-router/src/history/common.ts) so a
 * {@link HybridRouterHistory} can be passed straight to vue-router's
 * `createRouter({ history })`. They are re-declared here (instead of imported)
 * to keep the core layer free of any framework dependency — the same history
 * object can back any router that accepts this W3C-History-like contract.
 */

/** A history location, serialized as a full path string (`/users/1?tab=posts#bio`). */
export type HistoryLocation = string

/**
 * Values allowed in history state entries. Mirrors what the HTML5
 * `history.pushState` structured-clone contract accepts (minus non-JSON
 * exotica), because cross-container state must survive URL/JSON transport.
 */
export type HistoryStateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | HistoryState
  | HistoryStateArray

/** State object associated with a history entry, like HTML `history.state`. */
export interface HistoryState {
  [x: number]: HistoryStateValue
  [x: string]: HistoryStateValue
}

export interface HistoryStateArray extends Array<HistoryStateValue> {}

/** Starting location for histories, mirrors vue-router's `START`. */
export const START: HistoryLocation = ''

export type NavigationType = 'pop' | 'push'
export type NavigationDirection = 'back' | 'forward' | ''

export interface NavigationInformation {
  type: NavigationType
  direction: NavigationDirection
  delta: number
}

export interface NavigationCallback {
  (
    to: HistoryLocation,
    from: HistoryLocation,
    information: NavigationInformation
  ): void
}

/**
 * The framework-facing history contract. Structurally compatible with
 * vue-router's `RouterHistory`, with hybrid-navigation extensions.
 */
export interface HybridRouterHistory {
  /** Base prepended to every url; kept for RouterHistory compatibility. */
  readonly base: string
  /** Current history location (within this container). */
  readonly location: HistoryLocation
  /** Current history state (within this container). */
  readonly state: HistoryState

  /** In-container navigation, like `history.pushState`. */
  push(to: HistoryLocation, data?: HistoryState): void
  /** In-container navigation, like `history.replaceState`. */
  replace(to: HistoryLocation, data?: HistoryState): void
  /**
   * Traverse history. Deltas are consumed by the in-container queue first;
   * any remainder walks the native container stack via
   * {@link NavigationHost.close} (each container counts as one entry).
   * Positive deltas beyond the local queue cannot re-enter closed containers
   * and are clamped (MPA limitation).
   */
  go(delta: number, triggerListeners?: boolean): void
  /** Listen to `popstate`-like traversals within this container. */
  listen(callback: NavigationCallback): () => void
  /** Generate the href for a location: a platform URL (sparkling scheme). */
  createHref(location: HistoryLocation): string
  /** Remove all listeners and host subscriptions. */
  destroy(): void

  // ── Extensions beyond vue-router's RouterHistory ─────────────────────

  /**
   * Cross-container navigation: opens `to` in a NEW container via the host
   * (the MPA equivalent of `window.open`/link navigation). The current
   * container keeps its own history untouched — it stays alive underneath
   * the new page, exactly like a native navigation stack.
   *
   * @param to - target location (must be resolvable by the codec)
   * @param data - state to hand to the target container's history
   * @param options - `replace` swaps the current container instead of stacking
   */
  pushExternal(
    to: HistoryLocation,
    data?: HistoryState,
    options?: { replace?: boolean }
  ): Promise<void>

  /** Depth of this container in the native stack (0 = root). */
  readonly depth: number

  /** The page bundle this container runs, when the initial URL reveals it. */
  readonly bundle: string | null

  /**
   * `pageshow`-like hook: fires when this container becomes visible again
   * (e.g. the page stacked on top of it was closed). This is intentionally
   * NOT a `popstate` equivalent — the container's own location did not
   * change — but routers/apps can use it to refresh data.
   */
  onRestore(callback: (info: { visible: boolean }) => void): () => void
}

// ── Host contract ──────────────────────────────────────────────────────

export interface NavigationHostOpenOptions {
  /** Replace the current container instead of stacking a new one. */
  replace?: boolean
}

export interface NavigationHostCloseOptions {
  /** How many containers to pop. Hosts MAY only support 1. Default 1. */
  count?: number
}

/**
 * Minimal platform contract the history shim runs on. Anything that can
 * open/close stacked pages by URL can implement this — Sparkling native
 * containers, the Sparkling web shell, or an in-memory simulator for tests.
 *
 * Implementations for other stacks (e.g. a bespoke native shell) only need
 * to fulfil this interface to reuse the whole shim + router adapters.
 */
export interface NavigationHost {
  /** URL this container was opened with (e.g. `hybrid://lynxview_page?...`). */
  readonly initialUrl: string
  /** Unique id of this container instance, if the platform provides one. */
  readonly containerId: string
  /** Open a new container for the given platform URL. */
  open(url: string, options?: NavigationHostOpenOptions): Promise<void>
  /** Close containers starting from this one (pop the native stack). */
  close(options?: NavigationHostCloseOptions): Promise<void>
  /**
   * Subscribe to this container's visibility (viewAppeared/viewDisappeared
   * on Sparkling). Optional: hosts without lifecycle events can omit it.
   */
  onVisibilityChange?(callback: (visible: boolean) => void): () => void
}

// ── URL codec contract ─────────────────────────────────────────────────

/** Result of decoding a platform URL back into router-world coordinates. */
export interface DecodedLocation {
  location: HistoryLocation
  state?: HistoryState
  /** Depth of the container in the native stack (0 = root). */
  depth: number
  /** Page bundle this container is running, when the URL reveals it. */
  bundle?: string
}

/**
 * Bidirectional mapping between router locations (`/users/1?tab=posts`) and
 * platform URLs (`hybrid://lynxview_page?bundle=user.lynx.bundle&...`).
 *
 * This is where the file-based route manifest plugs in: the codec must know
 * which page bundle owns which route so separate JS heaps agree on the
 * mapping without sharing memory.
 */
export interface SchemeCodec {
  /** Router location -> platform URL. Returns null if no page owns `to`. */
  encode(
    to: HistoryLocation,
    context?: { state?: HistoryState; depth?: number }
  ): string | null
  /** Platform URL -> router location (+ state/depth riding along). */
  decode(url: string): DecodedLocation | null
  /** Name of the page bundle owning `to`, or null if none matches. */
  ownerOf(to: HistoryLocation): string | null
}
