// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { SimpleEventTarget } from './events';
import type {
  HostOpenOptions,
  NavigationHost,
  ShimHistoryEntry,
  ShimPopStateEvent,
} from './types';

/**
 * `History`-compatible surface produced by {@link createNavigationShim}.
 * Semantics follow WHATWG HTML where they matter to routers (vue-router,
 * react-router, Navigation-less frameworks):
 *
 * - `pushState`/`replaceState` are synchronous, never fire events, never
 *   leave the document (spec behavior).
 * - `go()` is asynchronous and dispatches exactly one `popstate` per call,
 *   after `location` and `state` already reflect the destination.
 * - Out-of-range `go()` beyond the top of the stack is a no-op (spec);
 *   crossing the bottom of the stack delegates to the host (native back).
 */
export interface ShimHistory {
  readonly length: number;
  readonly state: unknown;
  scrollRestoration: 'auto' | 'manual';
  pushState(state: unknown, unused: string, url?: string | null): void;
  replaceState(state: unknown, unused: string, url?: string | null): void;
  go(delta?: number): void;
  back(): void;
  forward(): void;
}

/** `Location`-compatible surface produced by {@link createNavigationShim}. */
export interface ShimLocation {
  href: string;
  readonly origin: string;
  readonly protocol: string;
  readonly host: string;
  readonly hostname: string;
  readonly port: string;
  pathname: string;
  search: string;
  hash: string;
  assign(url: string): void;
  replace(url: string): void;
  reload(): void;
  toString(): string;
}

/** Minimal `document` stub for router boot gates (`typeof document`). */
export interface ShimDocument {
  visibilityState: 'visible' | 'hidden';
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  dispatchEvent(event: { type: string }): boolean;
  /** Always null — enough for `document.querySelector('base')` probes. */
  querySelector(selectors: string): null;
  /** Always null — enough for scroll-target lookups to fail gracefully. */
  getElementById(id: string): null;
}

/** The window-like object aggregating everything the shim provides. */
export interface ShimWindow {
  window: ShimWindow;
  history: ShimHistory;
  location: ShimLocation;
  document: ShimDocument;
  navigator: Record<string, unknown>;
  scrollX: number;
  scrollY: number;
  scrollTo(...args: unknown[]): void;
  open(url?: string, target?: string, features?: string): null;
  requestAnimationFrame(callback: (time: number) => void): ReturnType<typeof setTimeout>;
  cancelAnimationFrame(handle: ReturnType<typeof setTimeout>): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  dispatchEvent(event: { type: string }): boolean;
}

export interface NavigationShim {
  /** The aggregated window-like object. */
  window: ShimWindow;
  history: ShimHistory;
  location: ShimLocation;
  document: ShimDocument;
  /**
   * Define the shim objects as globals on `target` (default `globalThis`)
   * so code compiled against bare `window`/`history`/`location`/`document`
   * (vue-router, Nuxt runtime, …) finds them. Existing globals are NOT
   * overwritten unless `force` is set — never install with `force` inside
   * a real browser page.
   */
  install(target?: Record<string, unknown>, options?: { force?: boolean }): void;
  /**
   * Notify the shim that the host is hiding/tearing down this document, so
   * `pagehide`/`visibilitychange` listeners (scroll persistence in
   * vue-router) run. Optional for hosts.
   */
  notifyPageHide(): void;
  /** Snapshot of the synthetic entry stack (diagnostics/tests). */
  readonly entries: readonly ShimHistoryEntry[];
  /** Index of the current entry within {@link entries}. */
  readonly index: number;
}

function parseUrl(url: string, base?: string): URL {
  if (typeof URL !== 'function') {
    throw new TypeError(
      '[web-navigation-shim] global URL constructor is required. '
      + 'Provide a WHATWG URL polyfill in this JS context before creating the shim.',
    );
  }
  return base === undefined ? new URL(url) : new URL(url, base);
}

/** Default same-document policy: only hash-only changes stay in-document. */
function defaultIsSameDocument(from: URL, to: URL): boolean {
  return from.origin === to.origin
    && from.pathname === to.pathname
    && from.search === to.search;
}

/**
 * Create the Web navigation API surface (history/location/popstate/window
 * bits) on top of a {@link NavigationHost}.
 */
export function createNavigationShim(host: NavigationHost): NavigationShim {
  const initial = parseUrl(host.initialUrl);
  const entries: ShimHistoryEntry[] = [{ url: initial.href, state: null }];
  let index = 0;
  let scrollRestoration: 'auto' | 'manual' = 'auto';

  const windowEvents = new SimpleEventTarget();
  const documentEvents = new SimpleEventTarget();

  const current = (): ShimHistoryEntry => entries[index];
  const currentUrl = (): URL => parseUrl(current().url);

  const resolve = (url: string | null | undefined): URL =>
    parseUrl(url == null || url === '' ? current().url : String(url), current().url);

  const isSameDocument = (from: URL, to: URL): boolean =>
    host.isSameDocument ? host.isSameDocument(from, to) : defaultIsSameDocument(from, to);

  // ---------------------------------------------------------------------
  // popstate
  // ---------------------------------------------------------------------

  function createPopStateEvent(state: unknown): ShimPopStateEvent {
    const event: ShimPopStateEvent = {
      type: 'popstate',
      state,
      target: undefined as unknown, // assigned below once `windowLike` exists
      hasUAVisualTransition: false,
      defaultPrevented: false,
      preventDefault() {
        event.defaultPrevented = true;
      },
    };
    event.target = windowLike;
    return event;
  }

  function dispatchPopState(state: unknown): void {
    windowEvents.dispatchEvent(createPopStateEvent(state));
  }

  // ---------------------------------------------------------------------
  // history
  // ---------------------------------------------------------------------

  function pushState(state: unknown, _unused: string, url?: string | null): void {
    const to = resolve(url);
    // Spec: pushState never navigates the document, regardless of target.
    entries.splice(index + 1); // drop forward entries
    entries.push({ url: to.href, state: state ?? null });
    index = entries.length - 1;
  }

  function replaceState(state: unknown, _unused: string, url?: string | null): void {
    const to = resolve(url);
    entries[index] = { url: to.href, state: state ?? null };
  }

  function go(delta = 0): void {
    if (delta === 0) {
      // Browsers reload on go(0); routers never rely on this. Treat as no-op.
      return;
    }
    const target = index + delta;
    if (target >= entries.length) {
      // Beyond the top of the joint session history: spec says do nothing.
      return;
    }
    if (target < 0) {
      // Crossing the bottom of this document's stack: native traversal.
      // The steps consumed locally are index → 0; the remainder goes to the host.
      const hostDelta = target; // negative
      if (host.go) {
        host.go(hostDelta);
      } else {
        host.close();
      }
      return;
    }
    // Same-document traversal: async, exactly one popstate per go() call,
    // with location/state updated before listeners run (spec order).
    queueMicrotask(() => {
      index = target;
      dispatchPopState(current().state);
    });
  }

  const history: ShimHistory = {
    get length() {
      return entries.length;
    },
    get state() {
      return current().state;
    },
    get scrollRestoration() {
      return scrollRestoration;
    },
    set scrollRestoration(value: 'auto' | 'manual') {
      if (value === 'auto' || value === 'manual') scrollRestoration = value;
    },
    pushState,
    replaceState,
    go,
    back() {
      go(-1);
    },
    forward() {
      go(1);
    },
  };

  // ---------------------------------------------------------------------
  // location
  // ---------------------------------------------------------------------

  function navigate(url: string, options: HostOpenOptions & { replace?: boolean }): void {
    const from = currentUrl();
    const to = resolve(url);
    if (isSameDocument(from, to)) {
      // Same-document (fragment) navigation: history entry + popstate,
      // mirroring browser behavior for hash navigations.
      if (options.replace) {
        entries[index] = { url: to.href, state: null };
      } else {
        entries.splice(index + 1);
        entries.push({ url: to.href, state: null });
        index = entries.length - 1;
      }
      queueMicrotask(() => dispatchPopState(current().state));
      return;
    }
    host.open(to.href, options);
  }

  const location: ShimLocation = {
    get href() {
      return current().url;
    },
    set href(value: string) {
      navigate(value, {});
    },
    get origin() {
      return currentUrl().origin;
    },
    get protocol() {
      return currentUrl().protocol;
    },
    get host() {
      return currentUrl().host;
    },
    get hostname() {
      return currentUrl().hostname;
    },
    get port() {
      return currentUrl().port;
    },
    get pathname() {
      return currentUrl().pathname;
    },
    set pathname(value: string) {
      const url = currentUrl();
      url.pathname = value;
      navigate(url.href, {});
    },
    get search() {
      return currentUrl().search;
    },
    set search(value: string) {
      const url = currentUrl();
      url.search = value;
      navigate(url.href, {});
    },
    get hash() {
      return currentUrl().hash;
    },
    set hash(value: string) {
      const url = currentUrl();
      url.hash = value.startsWith('#') ? value : `#${value}`;
      if (url.href !== current().url) {
        navigate(url.href, {});
      }
    },
    assign(url: string) {
      navigate(url, {});
    },
    replace(url: string) {
      navigate(url, { replace: true });
    },
    reload() {
      if (host.reload) {
        host.reload();
      } else {
        host.open(current().url, { replace: true });
      }
    },
    toString() {
      return current().url;
    },
  };

  // ---------------------------------------------------------------------
  // document / window
  // ---------------------------------------------------------------------

  const documentLike: ShimDocument = {
    visibilityState: 'visible',
    addEventListener: (type, listener) => documentEvents.addEventListener(type, listener),
    removeEventListener: (type, listener) => documentEvents.removeEventListener(type, listener),
    dispatchEvent: (event) => documentEvents.dispatchEvent(event),
    querySelector: () => null,
    getElementById: () => null,
  };

  const windowLike: ShimWindow = {
    window: undefined as unknown as ShimWindow, // self-reference set below
    history,
    location,
    document: documentLike,
    navigator: {},
    scrollX: 0,
    scrollY: 0,
    scrollTo() {
      // No viewport to scroll; native hosts own scrolling.
    },
    open(url?: string, _target?: string, _features?: string) {
      if (url) {
        host.open(resolve(url).href, { newWindow: true });
      }
      return null;
    },
    requestAnimationFrame(callback: (time: number) => void) {
      return setTimeout(() => callback(Date.now()), 16);
    },
    cancelAnimationFrame(handle: ReturnType<typeof setTimeout>) {
      clearTimeout(handle);
    },
    addEventListener: (type, listener) => windowEvents.addEventListener(type, listener),
    removeEventListener: (type, listener) => windowEvents.removeEventListener(type, listener),
    dispatchEvent: (event) => windowEvents.dispatchEvent(event),
  };
  windowLike.window = windowLike;

  function install(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>, options: { force?: boolean } = {}): void {
    const define = (key: string, value: unknown) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      const present = descriptor !== undefined && target[key] !== undefined;
      if (!options.force && present) return;
      // Some hosts expose read-only globals (e.g. Node's `navigator`
      // getter). Assign when writable, else redefine, else skip — never
      // throw, so installing over a partially-populated context is safe.
      try {
        if (descriptor && !descriptor.configurable && !descriptor.writable && !descriptor.set) {
          return;
        }
        if (descriptor && (descriptor.writable || descriptor.set)) {
          target[key] = value;
        } else {
          Object.defineProperty(target, key, { value, configurable: true, writable: true });
        }
      } catch {
        // Read-only, non-configurable global: leave the host's version.
      }
    };
    define('window', windowLike);
    define('self', windowLike);
    define('history', history);
    define('location', location);
    define('document', documentLike);
    define('navigator', windowLike.navigator);
    define('requestAnimationFrame', windowLike.requestAnimationFrame);
    define('cancelAnimationFrame', windowLike.cancelAnimationFrame);
    define('addEventListener', windowLike.addEventListener);
    define('removeEventListener', windowLike.removeEventListener);
    define('dispatchEvent', windowLike.dispatchEvent);
    define('scrollX', 0);
    define('scrollY', 0);
    define('scrollTo', windowLike.scrollTo);
    define('open', windowLike.open);
  }

  function notifyPageHide(): void {
    documentLike.visibilityState = 'hidden';
    documentEvents.dispatchEvent({ type: 'visibilitychange' });
    windowEvents.dispatchEvent({ type: 'pagehide' });
  }

  return {
    window: windowLike,
    history,
    location,
    document: documentLike,
    install,
    notifyPageHide,
    get entries() {
      return entries as readonly ShimHistoryEntry[];
    },
    get index() {
      return index;
    },
  };
}
