// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Options passed to {@link NavigationHost.open} when the shim decides a
 * navigation must leave the current document.
 */
export interface HostOpenOptions {
  /**
   * Replace the current document in the host stack instead of pushing a
   * new one (`location.replace` semantics).
   */
  replace?: boolean;
  /**
   * The navigation was requested as an auxiliary browsing context
   * (`window.open`). Hosts without a window concept may treat it as a push.
   */
  newWindow?: boolean;
}

/**
 * The contract a platform must implement for the shim to drive it.
 *
 * This is intentionally tiny and framework-free: a host knows how to
 * (a) say which URL the current document was opened at, (b) open a new
 * document, and (c) close the current one. Everything else — the
 * synthetic same-document history stack, `popstate` dispatch, `location`
 * semantics — is provided by the shim on top.
 *
 * Implementations in this repo:
 * - `web-navigation-shim/memory` — in-memory document stack (tests, SSR)
 * - `sparkling-navigation/shim-host` — Sparkling container stack driven
 *   by `router.open` / `router.close` with sparkling scheme URLs.
 *
 * Any other native shell (or framework) can participate by implementing
 * this interface — nothing in the shim references Sparkling or Lynx.
 */
export interface NavigationHost {
  /**
   * Absolute, WHATWG-parsable URL this document was opened at
   * (e.g. `https://app.local/users/42?tab=posts`). The shim seeds
   * `location` and the history stack from it.
   */
  readonly initialUrl: string;

  /**
   * Cross-document navigation: open `url` as a new document in the host
   * stack (native push). The current JS context usually survives in the
   * background (native stacks keep previous pages alive), so this MUST NOT
   * assume teardown.
   */
  open(url: string, options?: HostOpenOptions): void;

  /**
   * Cross-document back: close this document (native pop). May tear down
   * the current JS context.
   */
  close(): void;

  /**
   * Optional: traverse the host stack by `delta` documents (negative =
   * back). Called when a `history.go()` crosses the bottom of the local
   * synthetic stack. Defaults to `close()` per step for negative deltas;
   * positive deltas are ignored (forward across documents is not a native
   * stack concept).
   */
  go?(delta: number): void;

  /**
   * Optional: reload the current document. Backs `location.reload()`.
   * Defaults to `open(currentUrl, { replace: true })`.
   */
  reload?(): void;

  /**
   * Optional policy: decide whether navigating from `from` to `to` stays
   * inside the current document (synthetic history entry + `popstate`) or
   * must open a new document via {@link open}.
   *
   * Default policy mirrors the real web: only hash-only changes are
   * same-document; any other `location.assign` leaves the document.
   * A Sparkling host can override this using its route manifest (e.g.
   * "same Lynx bundle" = same document).
   */
  isSameDocument?(from: URL, to: URL): boolean;
}

/**
 * A history entry in the synthetic (same-document) stack.
 */
export interface ShimHistoryEntry {
  url: string;
  state: unknown;
}

/**
 * Minimal `PopStateEvent`-compatible shape dispatched by the shim.
 */
export interface ShimPopStateEvent {
  type: 'popstate';
  state: unknown;
  /** Points at the shim window, like `event.target === window` on the web. */
  target: unknown;
  hasUAVisualTransition: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
}

export interface ShimEventListener {
  (event: unknown): void;
}
