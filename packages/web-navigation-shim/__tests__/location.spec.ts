// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it, vi } from 'vitest';
import { createNavigationShim } from '../src/shim';
import type { NavigationHost } from '../src/types';

const BASE = 'https://app.local/users/42?tab=posts';

function stubHost(overrides: Partial<NavigationHost> = {}): NavigationHost {
  return {
    initialUrl: BASE,
    open: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('location component getters', () => {
  it('exposes WHATWG components of the current URL', () => {
    const shim = createNavigationShim(stubHost());
    expect(shim.location.href).toBe(BASE);
    expect(shim.location.origin).toBe('https://app.local');
    expect(shim.location.protocol).toBe('https:');
    expect(shim.location.host).toBe('app.local');
    expect(shim.location.pathname).toBe('/users/42');
    expect(shim.location.search).toBe('?tab=posts');
    expect(shim.location.hash).toBe('');
    expect(String(shim.location)).toBe(BASE);
  });
});

describe('cross-document navigation → host.open', () => {
  it('assign() to a different path leaves the document', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.assign('/settings');
    expect(host.open).toHaveBeenCalledWith('https://app.local/settings', {});
  });

  it('href setter behaves like assign()', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.href = 'https://app.local/other';
    expect(host.open).toHaveBeenCalledWith('https://app.local/other', {});
  });

  it('replace() forwards replace intent to the host', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.replace('/login');
    expect(host.open).toHaveBeenCalledWith('https://app.local/login', { replace: true });
  });

  it('window.open() opens through the host with newWindow', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.window.open('https://example.com/docs');
    expect(host.open).toHaveBeenCalledWith('https://example.com/docs', { newWindow: true });
  });

  it('reload() defaults to replace-open of the current URL', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.reload();
    expect(host.open).toHaveBeenCalledWith(BASE, { replace: true });
  });

  it('reload() prefers host.reload when provided', () => {
    const reload = vi.fn();
    const host = stubHost({ reload });
    const shim = createNavigationShim(host);
    shim.location.reload();
    expect(reload).toHaveBeenCalled();
    expect(host.open).not.toHaveBeenCalled();
  });
});

describe('same-document (hash) navigation', () => {
  it('hash-only assign stays in-document: entry + popstate, no host.open', async () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    const popstate = vi.fn();
    shim.window.addEventListener('popstate', popstate);

    shim.location.assign(`${BASE}#section`);
    await microtask();

    expect(host.open).not.toHaveBeenCalled();
    expect(shim.location.hash).toBe('#section');
    expect(shim.history.length).toBe(2);
    expect(popstate).toHaveBeenCalledTimes(1);
    // hash navigations carry null state (vue-router treats these as external)
    expect((popstate.mock.calls[0][0] as { state: unknown }).state).toBeNull();
  });

  it('hash setter with identical value does nothing', async () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.assign(`${BASE}#a`);
    await microtask();
    const popstate = vi.fn();
    shim.window.addEventListener('popstate', popstate);
    shim.location.hash = '#a';
    await microtask();
    expect(popstate).not.toHaveBeenCalled();
    expect(shim.history.length).toBe(2);
  });

  it('host.isSameDocument policy can widen same-document identity', async () => {
    // A Sparkling host backed by a route manifest may declare that two
    // paths served by the same Lynx bundle share a document.
    const host = stubHost({
      isSameDocument: (from, to) => from.pathname.split('/')[1] === to.pathname.split('/')[1],
    });
    const shim = createNavigationShim(host);
    shim.location.assign('/users/43');
    await microtask();
    expect(host.open).not.toHaveBeenCalled();
    expect(shim.location.pathname).toBe('/users/43');

    shim.location.assign('/settings');
    expect(host.open).toHaveBeenCalledWith('https://app.local/settings', {});
  });
});

describe('pathname/search/hash setters', () => {
  it('pathname setter triggers cross-document navigation, preserving search (spec)', () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.pathname = '/elsewhere';
    expect(host.open).toHaveBeenCalledWith('https://app.local/elsewhere?tab=posts', {});
  });

  it('hash setter normalizes a missing # prefix', async () => {
    const host = stubHost();
    const shim = createNavigationShim(host);
    shim.location.hash = 'anchor';
    await microtask();
    expect(shim.location.hash).toBe('#anchor');
    expect(host.open).not.toHaveBeenCalled();
  });
});

describe('install()', () => {
  it('defines missing globals without clobbering existing ones', () => {
    const shim = createNavigationShim(stubHost());
    const target: Record<string, unknown> = { document: { existing: true } };
    shim.install(target);
    expect(target.history).toBe(shim.history);
    expect(target.location).toBe(shim.location);
    expect(target.window).toBe(shim.window);
    expect(target.document).toEqual({ existing: true });
    expect(typeof target.requestAnimationFrame).toBe('function');
    expect(typeof target.addEventListener).toBe('function');
    expect(target.navigator).toBeDefined();
    expect(target.scrollX).toBe(0);
  });
});

describe('notifyPageHide()', () => {
  it('dispatches visibilitychange (document) and pagehide (window) with hidden state', () => {
    const shim = createNavigationShim(stubHost());
    const seen: string[] = [];
    shim.document.addEventListener('visibilitychange', () => {
      seen.push(`visibility:${shim.document.visibilityState}`);
    });
    shim.window.addEventListener('pagehide', () => seen.push('pagehide'));
    shim.notifyPageHide();
    expect(seen).toEqual(['visibility:hidden', 'pagehide']);
  });
});
