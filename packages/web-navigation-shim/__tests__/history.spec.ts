// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it, vi } from 'vitest';
import { createNavigationShim } from '../src/shim';
import type { NavigationHost } from '../src/types';

const BASE = 'https://app.local/';

function stubHost(overrides: Partial<NavigationHost> = {}): NavigationHost {
  return {
    initialUrl: BASE,
    open: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('history.pushState / replaceState', () => {
  it('updates state and location synchronously without firing popstate', () => {
    const shim = createNavigationShim(stubHost());
    const popstate = vi.fn();
    shim.window.addEventListener('popstate', popstate);

    const state = { position: 1, current: '/a' };
    shim.history.pushState(state, '', '/a');

    expect(shim.history.state).toEqual(state);
    expect(shim.location.pathname).toBe('/a');
    expect(shim.history.length).toBe(2);
    expect(popstate).not.toHaveBeenCalled();
  });

  it('supports the vue-router two-write protocol (replace then push)', () => {
    const shim = createNavigationShim(stubHost());

    // vue-router: replaceState(currentEntry + {forward, scroll}) then pushState(new)
    shim.history.replaceState({ current: '/', forward: '/a', scroll: { left: 0, top: 0 } }, '', BASE);
    expect(shim.history.state).toMatchObject({ forward: '/a' });

    shim.history.pushState({ current: '/a', position: 1 }, '', '/a');
    expect(shim.history.state).toEqual({ current: '/a', position: 1 });
    expect(shim.location.href).toBe(`${BASE}a`);
  });

  it('accepts absolute same-origin URLs and path-only URLs', () => {
    const shim = createNavigationShim(stubHost());
    shim.history.pushState({}, '', `${BASE}abs`);
    expect(shim.location.pathname).toBe('/abs');
    shim.history.pushState({}, '', '/rel?q=1#h');
    expect(shim.location.pathname).toBe('/rel');
    expect(shim.location.search).toBe('?q=1');
    expect(shim.location.hash).toBe('#h');
  });

  it('null/omitted url keeps the current URL', () => {
    const shim = createNavigationShim(stubHost());
    shim.history.pushState({ a: 1 }, '');
    expect(shim.location.href).toBe(BASE);
    expect(shim.history.length).toBe(2);
  });

  it('pushState truncates forward entries', async () => {
    const shim = createNavigationShim(stubHost());
    shim.history.pushState({}, '', '/a');
    shim.history.pushState({}, '', '/b');
    shim.history.go(-1);
    await microtask();
    expect(shim.location.pathname).toBe('/a');

    shim.history.pushState({}, '', '/c');
    expect(shim.history.length).toBe(3); // '/', '/a', '/c'
    // forward is gone:
    shim.history.go(1);
    await microtask();
    expect(shim.location.pathname).toBe('/c');
  });
});

describe('history.go', () => {
  it('fires exactly one popstate per go() with destination state, after location updates', async () => {
    const shim = createNavigationShim(stubHost());
    shim.history.pushState({ page: 'a' }, '', '/a');
    shim.history.pushState({ page: 'b' }, '', '/b');

    const seen: Array<{ state: unknown; pathname: string }> = [];
    shim.window.addEventListener('popstate', (event) => {
      const e = event as { state: unknown };
      seen.push({ state: e.state, pathname: shim.location.pathname });
    });

    shim.history.go(-2);
    await microtask();
    expect(seen).toEqual([{ state: null, pathname: '/' }]);

    shim.history.go(2);
    await microtask();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual({ state: { page: 'b' }, pathname: '/b' });
  });

  it('go() past the top of the stack is a no-op', async () => {
    const shim = createNavigationShim(stubHost());
    const popstate = vi.fn();
    shim.window.addEventListener('popstate', popstate);
    shim.history.go(1);
    await microtask();
    expect(popstate).not.toHaveBeenCalled();
    expect(shim.location.href).toBe(BASE);
  });

  it('go(0) is a no-op', async () => {
    const shim = createNavigationShim(stubHost());
    const popstate = vi.fn();
    shim.window.addEventListener('popstate', popstate);
    shim.history.go(0);
    await microtask();
    expect(popstate).not.toHaveBeenCalled();
  });

  it('back() at the bottom of the local stack delegates to the host (native pop)', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.history.back();
    expect(host.close).toHaveBeenCalledTimes(1);
  });

  it('go(-n) crossing the local bottom passes the full remaining delta to host.go', () => {
    const go = vi.fn();
    const host = stubHost({ go });
    const shim = createNavigationShim(host);
    shim.history.pushState({}, '', '/a'); // local stack: '/', '/a' (index 1)
    shim.history.go(-3);
    expect(go).toHaveBeenCalledWith(-2);
  });

  it('state is read through history.state after traversal (vue-router global read)', async () => {
    const shim = createNavigationShim(stubHost());
    shim.history.pushState({ position: 1 }, '', '/a');
    shim.history.go(-1);
    await microtask();
    expect(shim.history.state).toBeNull();
  });
});

describe('scrollRestoration', () => {
  it('exists, defaults to auto, and accepts manual (vue-router feature test)', () => {
    const shim = createNavigationShim(stubHost());
    expect('scrollRestoration' in shim.history).toBe(true);
    expect(shim.history.scrollRestoration).toBe('auto');
    shim.history.scrollRestoration = 'manual';
    expect(shim.history.scrollRestoration).toBe('manual');
  });
});
