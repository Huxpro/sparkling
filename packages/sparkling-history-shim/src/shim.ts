// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createEventTarget } from './events';
import {
  NavigationHost,
  NavigationShim,
  Resolution,
  ShimHistory,
  ShimLocation,
  ShimOptions,
  SHIM_ROUTE_PARAM,
  SHIM_STATE_PARAM,
  UrlResolver,
} from './types';
import { UrlSearchParamsShim, UrlShim, ensureUrlGlobals } from './url';

interface HistoryEntry {
  url: UrlShim;
  state: unknown;
}

const DEFAULT_ORIGIN = 'sparkling://app';
const DEFAULT_MAX_STATE_BYTES = 4096;

/**
 * Derive the initial in-app URL for this container from the host scheme it
 * was opened with: `__shim_route` when a shim-driven navigation created it,
 * otherwise `defaultRoute` plus the scheme's forwarded query params.
 */
function deriveInitialEntry(host: NavigationHost, origin: string, defaultRoute: string, warn: (m: string) => void): HistoryEntry {
  let route = defaultRoute;
  let state: unknown = null;
  const extra = new UrlSearchParamsShim();
  try {
    const scheme = new UrlShim(host.initialUrl());
    scheme.searchParams.forEach((value, key) => {
      if (key === SHIM_ROUTE_PARAM) {
        route = value;
      } else if (key === SHIM_STATE_PARAM) {
        try {
          state = JSON.parse(value);
        } catch {
          warn(`Ignoring unparsable ${SHIM_STATE_PARAM} param`);
        }
      } else if (key !== 'bundle' && key !== 'url') {
        extra.append(key, value);
      }
    });
  } catch {
    warn(`Could not parse host initial URL; starting at ${defaultRoute}`);
  }
  const url = new UrlShim(route, origin + '/');
  if (url.origin !== new UrlShim(origin + '/').origin) {
    // __shim_route must stay on the app origin; anything else is discarded.
    return { url: new UrlShim(defaultRoute, origin + '/'), state: null };
  }
  // Forwarded scheme params become part of location.search only when the
  // route itself didn't carry an explicit query.
  if (url.search === '' && extra.toString() !== '') {
    url.search = `?${extra.toString()}`;
  }
  return { url, state };
}

/** Append a reserved param to an existing scheme string. */
function appendSchemeParam(scheme: string, key: string, value: string): string {
  const sep = scheme.includes('?') ? '&' : '?';
  return `${scheme}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function createNavigationShim(
  host: NavigationHost,
  resolver: UrlResolver,
  options: ShimOptions = {},
): NavigationShim {
  const origin = (options.origin ?? DEFAULT_ORIGIN).replace(/\/+$/, '');
  const defaultRoute = options.defaultRoute ?? '/';
  const maxStateBytes = options.maxStateBytes ?? DEFAULT_MAX_STATE_BYTES;
  const warn = options.warn ?? ((message: string) => console.warn(`[sparkling-history-shim] ${message}`));

  const events = createEventTarget();
  const entries: HistoryEntry[] = [deriveInitialEntry(host, origin, defaultRoute, warn)];
  let cursor = 0;
  const disposers: Array<() => void> = [];

  if (host.onShow) {
    disposers.push(
      host.onShow(() => {
        // The container above us was popped (or the app returned to the
        // foreground). Matches bfcache restore semantics closely enough for
        // routers to revalidate: pageshow with persisted=true.
        events.dispatchEvent({ type: 'pageshow', persisted: true });
      }),
    );
  }
  if (host.onHide) {
    disposers.push(
      host.onHide(() => {
        events.dispatchEvent({ type: 'pagehide', persisted: true });
      }),
    );
  }

  function current(): HistoryEntry {
    return entries[cursor];
  }

  function parse(url: string | null | undefined): UrlShim {
    return new UrlShim(url == null || url === '' ? current().url.href : String(url), current().url);
  }

  function resolve(url: UrlShim): Resolution {
    if (url.origin !== new UrlShim(origin + '/').origin) {
      return { kind: 'external', url: url.href };
    }
    return resolver.resolve(url, current().url);
  }

  function serializeState(state: unknown, scheme: string): string {
    if (state == null) return scheme;
    let json: string;
    try {
      json = JSON.stringify(state);
    } catch {
      warn('history.state is not JSON-serializable; dropped for cross-page navigation');
      return scheme;
    }
    if (json.length > maxStateBytes) {
      warn(`history.state exceeds ${maxStateBytes} bytes; dropped for cross-page navigation`);
      return scheme;
    }
    return appendSchemeParam(scheme, SHIM_STATE_PARAM, json);
  }

  function openCrossPage(scheme: string, state: unknown, replaceSelf: boolean): void {
    const finalScheme = serializeState(state, scheme);
    void host
      .open(finalScheme)
      .then(() => {
        if (replaceSelf) {
          // Open first, then remove ourselves from the native stack so the
          // user never sees a blank frame.
          return host.close();
        }
        return undefined;
      })
      .catch((err) => {
        warn(`host.open failed for ${finalScheme}: ${String(err)}`);
      });
  }

  function navigate(state: unknown, url: string | null | undefined, mode: 'push' | 'replace'): void {
    const target = parse(url);
    const resolution = resolve(target);
    if (resolution.kind === 'same-page') {
      const entry: HistoryEntry = { url: target, state };
      if (mode === 'push') {
        entries.splice(cursor + 1);
        entries.push(entry);
        cursor += 1;
      } else {
        entries[cursor] = entry;
      }
      // No event: matches browser pushState/replaceState semantics.
      return;
    }
    if (resolution.kind === 'cross-page') {
      openCrossPage(
        appendSchemeParam(resolution.scheme, SHIM_ROUTE_PARAM, target.pathname + target.search + target.hash),
        state,
        mode === 'replace',
      );
      return;
    }
    void host.open(resolution.url).catch((err) => warn(`host.open failed: ${String(err)}`));
  }

  function traverse(delta: number): void {
    if (delta === 0) {
      host.reload ? host.reload() : warn('history.go(0): host has no reload capability');
      return;
    }
    const target = cursor + delta;
    if (target < 0) {
      // Crossing the page boundary backwards: pop this container. Native
      // stacks pop one page at a time; deltas reaching further than the
      // previous page collapse to a single close (approximation).
      if (target < -1) {
        warn(`history.go(${delta}) crosses the page boundary; performing a single native back`);
      }
      void host.close().catch((err) => warn(`host.close failed: ${String(err)}`));
      return;
    }
    if (target >= entries.length) {
      warn(`history.go(${delta}): no forward entries beyond this page (native stacks have no forward)`);
      return;
    }
    cursor = target;
    events.dispatchEvent({ type: 'popstate', state: current().state });
  }

  const history: ShimHistory = {
    get length() {
      return entries.length;
    },
    get state() {
      return current().state;
    },
    pushState(state, _unused, url) {
      navigate(state, url, 'push');
    },
    replaceState(state, _unused, url) {
      navigate(state, url, 'replace');
    },
    back() {
      traverse(-1);
    },
    forward() {
      traverse(1);
    },
    go(delta = 0) {
      traverse(delta);
    },
  };

  const location: ShimLocation = {
    get href() {
      return current().url.href;
    },
    get origin() {
      return current().url.origin;
    },
    get protocol() {
      return current().url.protocol;
    },
    get host() {
      return current().url.host;
    },
    get hostname() {
      return current().url.hostname;
    },
    get pathname() {
      return current().url.pathname;
    },
    get search() {
      return current().url.search;
    },
    get hash() {
      return current().url.hash;
    },
    assign(url: string) {
      hardNavigate(url, false);
    },
    replace(url: string) {
      hardNavigate(url, true);
    },
    reload() {
      if (host.reload) {
        host.reload();
      } else {
        warn('location.reload(): host has no reload capability');
      }
    },
    toString() {
      return current().url.href;
    },
  };

  function hardNavigate(url: string, replaceSelf: boolean): void {
    const target = parse(url);
    const resolution = resolve(target);
    if (resolution.kind === 'external') {
      void host.open(resolution.url).catch((err) => warn(`host.open failed: ${String(err)}`));
      return;
    }
    const scheme = resolution.kind === 'cross-page' ? resolution.scheme : resolution.scheme ?? null;
    if (scheme == null) {
      warn(`location.${replaceSelf ? 'replace' : 'assign'}(${url}): resolver returned same-page without a scheme; falling back to pushState semantics`);
      navigate(null, url, replaceSelf ? 'replace' : 'push');
      events.dispatchEvent({ type: 'popstate', state: null });
      return;
    }
    openCrossPage(appendSchemeParam(scheme, SHIM_ROUTE_PARAM, target.pathname + target.search + target.hash), null, replaceSelf);
  }

  return {
    history,
    location,
    events,
    createUrl(url: string, base?: string) {
      return new UrlShim(url, base);
    },
    installGlobals(target: Record<string, unknown>) {
      ensureUrlGlobals(target);
      target.history = history;
      target.location = location;
      target.addEventListener = events.addEventListener.bind(events);
      target.removeEventListener = events.removeEventListener.bind(events);
      target.dispatchEvent = events.dispatchEvent.bind(events);
    },
    dispose() {
      for (const dispose of disposers.splice(0)) dispose();
    },
  };
}
