// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createNavigationShim } from '../shim';
import type { NavigationHost, Resolution, ShimEvent, UrlLike, UrlResolver } from '../types';

interface MockHost extends NavigationHost {
  opened: string[];
  openedReplace: boolean[];
  closed: number;
  fireShow(): void;
}

function createMockHost(initialUrl = 'hybrid://lynxview_page?bundle=index.lynx.bundle'): MockHost {
  const showCallbacks: Array<() => void> = [];
  return {
    opened: [],
    openedReplace: [],
    closed: 0,
    open(scheme: string, options?: { replace?: boolean }) {
      this.opened.push(scheme);
      this.openedReplace.push(options?.replace === true);
      return Promise.resolve();
    },
    close() {
      this.closed += 1;
      return Promise.resolve();
    },
    initialUrl: () => initialUrl,
    containerId: () => 'test-container',
    onShow(cb) {
      showCallbacks.push(cb);
      return () => {
        const i = showCallbacks.indexOf(cb);
        if (i !== -1) showCallbacks.splice(i, 1);
      };
    },
    fireShow() {
      for (const cb of [...showCallbacks]) cb();
    },
  };
}

/** Routes under /other/* are a different page bundle; everything else is same-page. */
const testResolver: UrlResolver = {
  resolve(url: UrlLike): Resolution {
    if (url.pathname.startsWith('/other')) {
      return { kind: 'cross-page', scheme: 'hybrid://lynxview_page?bundle=other.lynx.bundle' };
    }
    return { kind: 'same-page', scheme: 'hybrid://lynxview_page?bundle=index.lynx.bundle' };
  },
};

function setup(initialUrl?: string) {
  const host = createMockHost(initialUrl);
  const warnings: string[] = [];
  const shim = createNavigationShim(host, testResolver, { warn: (m) => warnings.push(m) });
  return { host, shim, warnings };
}

describe('initial state', () => {
  test('defaults to / with the synthetic origin', () => {
    const { shim } = setup();
    expect(shim.location.href).toBe('sparkling://app/');
    expect(shim.location.origin).toBe('sparkling://app');
    expect(shim.history.length).toBe(1);
    expect(shim.history.state).toBeNull();
  });

  test('derives route and state from __shim_route/__shim_state scheme params', () => {
    const { shim } = setup(
      'hybrid://lynxview_page?bundle=other.lynx.bundle&__shim_route=%2Fother%2F42%3Ftab%3Dspecs&__shim_state=%7B%22n%22%3A1%7D',
    );
    expect(shim.location.pathname).toBe('/other/42');
    expect(shim.location.search).toBe('?tab=specs');
    expect(shim.history.state).toEqual({ n: 1 });
  });

  test('forwards plain scheme query params into location.search', () => {
    const { shim } = setup('hybrid://lynxview_page?bundle=index.lynx.bundle&depth=2&from_depth=1');
    expect(shim.location.search).toBe('?depth=2&from_depth=1');
  });
});

describe('same-page navigation (virtual history)', () => {
  test('pushState appends an entry and updates location without events', () => {
    const { shim, host } = setup();
    const popstates: ShimEvent[] = [];
    shim.events.addEventListener('popstate', (e) => popstates.push(e));

    shim.history.pushState({ a: 1 }, '', '/list?page=2');
    expect(shim.location.href).toBe('sparkling://app/list?page=2');
    expect(shim.history.state).toEqual({ a: 1 });
    expect(shim.history.length).toBe(2);
    expect(popstates).toHaveLength(0);
    expect(host.opened).toHaveLength(0);
  });

  test('replaceState replaces the current entry', () => {
    const { shim } = setup();
    shim.history.pushState(null, '', '/a');
    shim.history.replaceState({ r: true }, '', '/b');
    expect(shim.history.length).toBe(2);
    expect(shim.location.pathname).toBe('/b');
    expect(shim.history.state).toEqual({ r: true });
  });

  test('back/forward traverse virtual entries and fire popstate', () => {
    const { shim, host } = setup();
    shim.history.pushState({ s: 1 }, '', '/a');
    shim.history.pushState({ s: 2 }, '', '/b');

    const popstates: ShimEvent[] = [];
    shim.events.addEventListener('popstate', (e) => popstates.push(e));

    shim.history.back();
    expect(shim.location.pathname).toBe('/a');
    expect(popstates[0].state).toEqual({ s: 1 });

    shim.history.forward();
    expect(shim.location.pathname).toBe('/b');
    expect(popstates[1].state).toEqual({ s: 2 });
    expect(host.closed).toBe(0);
  });

  test('push after back truncates forward entries', () => {
    const { shim, warnings } = setup();
    shim.history.pushState(null, '', '/a');
    shim.history.back();
    shim.history.pushState(null, '', '/c');
    expect(shim.history.length).toBe(2);
    shim.history.forward();
    expect(shim.location.pathname).toBe('/c');
    // forward beyond the end warns and stays
    shim.history.forward();
    expect(shim.location.pathname).toBe('/c');
    expect(warnings.some((w) => w.includes('no forward entries'))).toBe(true);
  });

  test('relative URLs resolve against the current entry', () => {
    const { shim } = setup();
    shim.history.pushState(null, '', '/products/42');
    shim.history.pushState(null, '', '?tab=specs');
    expect(shim.location.href).toBe('sparkling://app/products/42?tab=specs');
  });
});

describe('cross-page navigation', () => {
  test('pushState to another page opens a container with __shim_route', () => {
    const { shim, host } = setup();
    shim.history.pushState(null, '', '/other/42?x=1');
    expect(host.opened).toHaveLength(1);
    const scheme = host.opened[0];
    expect(scheme).toContain('bundle=other.lynx.bundle');
    expect(scheme).toContain(`__shim_route=${encodeURIComponent('/other/42?x=1')}`);
    // Current view keeps its history (native back returns here).
    expect(shim.history.length).toBe(1);
    expect(shim.location.pathname).toBe('/');
  });

  test('cross-page pushState serializes state into __shim_state', () => {
    const { shim, host } = setup();
    shim.history.pushState({ token: 'abc' }, '', '/other');
    expect(host.opened[0]).toContain(`__shim_state=${encodeURIComponent('{"token":"abc"}')}`);
  });

  test('oversized state is dropped with a warning', () => {
    const { shim, host, warnings } = setup();
    shim.history.pushState({ blob: 'x'.repeat(5000) }, '', '/other');
    expect(host.opened[0]).not.toContain('__shim_state');
    expect(warnings.some((w) => w.includes('exceeds'))).toBe(true);
  });

  test('cross-page replaceState opens with replace flag (not open+close)', async () => {
    const { shim, host } = setup();
    shim.history.replaceState(null, '', '/other');
    await Promise.resolve();
    await Promise.resolve();
    expect(host.opened).toHaveLength(1);
    expect(host.openedReplace[0]).toBe(true);
    expect(host.closed).toBe(0);
  });

  test('back at the bottom of the virtual stack closes the container', async () => {
    const { shim, host } = setup();
    shim.history.back();
    await Promise.resolve();
    expect(host.closed).toBe(1);
  });

  test('go(-2) that exactly reaches the previous page closes once without warning', async () => {
    const { shim, host, warnings } = setup();
    shim.history.pushState(null, '', '/a');
    shim.history.go(-2);
    await Promise.resolve();
    expect(host.closed).toBe(1);
    expect(warnings).toHaveLength(0);
  });

  test('go(-2) reaching beyond the previous page warns and closes once', async () => {
    const { shim, host, warnings } = setup();
    shim.history.go(-2);
    await Promise.resolve();
    expect(host.closed).toBe(1);
    expect(warnings.some((w) => w.includes('crosses the page boundary'))).toBe(true);
  });
});

describe('external URLs and hard navigation', () => {
  test('pushState to a foreign origin is handed to the host untouched', () => {
    const { shim, host } = setup();
    shim.history.pushState(null, '', 'https://example.com/docs');
    expect(host.opened).toEqual(['https://example.com/docs']);
  });

  test('location.assign to an in-app page opens a container', () => {
    const { shim, host } = setup();
    shim.location.assign('/other/7');
    expect(host.opened).toHaveLength(1);
    expect(host.opened[0]).toContain('bundle=other.lynx.bundle');
    expect(host.closed).toBe(0);
  });

  test('location.replace opens with replace flag (not open+close)', async () => {
    const { shim, host } = setup();
    shim.location.replace('/other/7');
    await Promise.resolve();
    await Promise.resolve();
    expect(host.opened).toHaveLength(1);
    expect(host.openedReplace[0]).toBe(true);
    expect(host.closed).toBe(0);
  });

  test('location.assign same-page uses the resolver-provided scheme (hard reload semantics)', () => {
    const { shim, host } = setup();
    shim.location.assign('/plain');
    expect(host.opened).toHaveLength(1);
    expect(host.opened[0]).toContain('bundle=index.lynx.bundle');
    expect(host.opened[0]).toContain(`__shim_route=${encodeURIComponent('/plain')}`);
  });
});

describe('lifecycle events', () => {
  test('host onShow emits pageshow with persisted=true', () => {
    const { shim, host } = setup();
    const events: ShimEvent[] = [];
    shim.events.addEventListener('pageshow', (e) => events.push(e));
    host.fireShow();
    expect(events).toEqual([{ type: 'pageshow', persisted: true }]);
  });

  test('dispose unsubscribes host lifecycle listeners', () => {
    const { shim, host } = setup();
    const events: ShimEvent[] = [];
    shim.events.addEventListener('pageshow', (e) => events.push(e));
    shim.dispose();
    host.fireShow();
    expect(events).toHaveLength(0);
  });
});

describe('installGlobals', () => {
  test('attaches history/location/event methods and URL globals', () => {
    const { shim } = setup();
    const fakeWindow: Record<string, unknown> = {};
    shim.installGlobals(fakeWindow);
    expect(fakeWindow.history).toBe(shim.history);
    expect(fakeWindow.location).toBe(shim.location);
    expect(typeof fakeWindow.addEventListener).toBe('function');
    expect(typeof fakeWindow.URL).toBe('function');
  });
});
