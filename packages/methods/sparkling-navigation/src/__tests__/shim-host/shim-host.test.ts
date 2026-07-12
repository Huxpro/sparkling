/// <reference types="jest" />
// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createSparklingNavigationHost, deriveInitialUrl } from '../../shim-host';
import type { SparklingRouteManifest } from '../../shim-host/manifest';
import { createMockPipe, MockPipe } from '../test-utils';

// open/navigate/close all funnel through the default pipe import.
jest.mock('sparkling-method', () => ({ call: jest.fn() }), { virtual: true });

const manifest: SparklingRouteManifest = {
  version: 1,
  origin: 'https://sparkling.app',
  base: '/',
  routes: [
    { name: 'index', path: '/', entry: 'index' },
    { name: 'about', path: '/about', entry: 'about', container: { title: 'About', hide_nav_bar: 1 } },
    { name: 'users-id', path: '/users/:id()', entry: 'users-id' },
  ],
};

function lastCall(mockPipe: MockPipe) {
  const calls = mockPipe.call.mock.calls;
  return calls[calls.length - 1];
}

function schemeOf(mockPipe: MockPipe): string {
  const [, params] = lastCall(mockPipe);
  return (params as { scheme: string }).scheme;
}

describe('createSparklingNavigationHost', () => {
  let mockPipe: MockPipe;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPipe = jest.requireMock('sparkling-method') as unknown as MockPipe;
    // router.open/close success by default
    mockPipe.call.mockImplementation((_method: string, _params: unknown, cb: (r: unknown) => void) => {
      cb({ code: 1, msg: 'ok' });
    });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    delete (globalThis as Record<string, unknown>).lynx;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('derives initialUrl from the manifest base when no container info exists', () => {
    const host = createSparklingNavigationHost({ manifest });
    expect(host.initialUrl).toBe('https://sparkling.app/');
  });

  it('opens an in-app route via router.open with the mapped bundle and __path', () => {
    const host = createSparklingNavigationHost({ manifest });
    host.open('https://sparkling.app/about');

    const [method] = lastCall(mockPipe);
    expect(method).toBe('router.open');
    const scheme = schemeOf(mockPipe);
    expect(scheme).toContain('hybrid://lynxview_page');
    expect(scheme).toContain('bundle=about.lynx.bundle');
    // full in-app URL rides along so the target page seeds its own location
    expect(scheme).toContain(`__path=${encodeURIComponent('/about')}`);
  });

  it('accepts a relative URL and resolves it against initialUrl', () => {
    const host = createSparklingNavigationHost({ manifest });
    host.open('/users/42?tab=posts');
    const scheme = schemeOf(mockPipe);
    expect(scheme).toContain('bundle=users-id.lynx.bundle');
    expect(scheme).toContain(`__path=${encodeURIComponent('/users/42?tab=posts')}`);
  });

  it('merges per-route container params into the scheme', () => {
    const host = createSparklingNavigationHost({ manifest });
    host.open('/about');
    const scheme = schemeOf(mockPipe);
    expect(scheme).toContain('title=About');
    expect(scheme).toContain('hide_nav_bar=1');
  });

  it('passes replace intent through to router.open options', () => {
    const host = createSparklingNavigationHost({ manifest });
    host.open('/about', { replace: true });
    const [, params] = lastCall(mockPipe);
    expect((params as { replace?: boolean }).replace).toBe(true);
  });

  it('routes external URLs through the webview scheme', () => {
    const host = createSparklingNavigationHost({ manifest });
    host.open('https://example.com/docs?x=1');
    const scheme = schemeOf(mockPipe);
    expect(scheme).toContain('hybrid://webview');
    expect(scheme).toContain(encodeURIComponent('https://example.com/docs?x=1'));
  });

  it('honors a custom external scheme template', () => {
    const host = createSparklingNavigationHost({
      manifest: { ...manifest, externalScheme: 'hybrid://browser?target={url}' },
    });
    host.open('https://example.com/');
    expect(schemeOf(mockPipe)).toContain('hybrid://browser?target=');
  });

  it('calls onUnresolved when external scheme is disabled', () => {
    const onUnresolved = jest.fn();
    const host = createSparklingNavigationHost({
      manifest: { ...manifest, externalScheme: null },
      onUnresolved,
    });
    host.open('https://example.com/');
    expect(onUnresolved).toHaveBeenCalledWith('https://example.com/');
    expect(mockPipe.call).not.toHaveBeenCalled();
  });

  it('calls onUnresolved for an in-app URL that matches no route', () => {
    const onUnresolved = jest.fn();
    const host = createSparklingNavigationHost({ manifest, onUnresolved });
    host.open('/does/not/exist');
    expect(onUnresolved).toHaveBeenCalledWith('https://sparkling.app/does/not/exist');
    expect(mockPipe.call).not.toHaveBeenCalled();
  });

  it('close() calls router.close', () => {
    const host = createSparklingNavigationHost({ manifest });
    host.close();
    expect(lastCall(mockPipe)[0]).toBe('router.close');
  });

  it('reload() re-opens the initial URL with replace', () => {
    const host = createSparklingNavigationHost({ manifest, initialUrl: '/about' });
    host.reload();
    const [, params] = lastCall(mockPipe);
    expect((params as { replace?: boolean }).replace).toBe(true);
    expect((params as { scheme: string }).scheme).toContain('bundle=about.lynx.bundle');
  });

  describe('isSameDocument', () => {
    it('defaults to hash-only (every cross-path assign is a native open)', () => {
      const host = createSparklingNavigationHost({ manifest });
      expect(host.isSameDocument(new URL('https://sparkling.app/users/1'), new URL('https://sparkling.app/users/1#a'))).toBe(true);
      expect(host.isSameDocument(new URL('https://sparkling.app/users/1'), new URL('https://sparkling.app/users/2'))).toBe(false);
    });

    it('with sameBundleIsSameDocument, same-bundle paths share a document', () => {
      const host = createSparklingNavigationHost({ manifest, sameBundleIsSameDocument: true });
      // both /users/1 and /users/2 map to users-id.lynx.bundle
      expect(host.isSameDocument(new URL('https://sparkling.app/users/1'), new URL('https://sparkling.app/users/2'))).toBe(true);
      // different bundles remain distinct documents
      expect(host.isSameDocument(new URL('https://sparkling.app/about'), new URL('https://sparkling.app/users/2'))).toBe(false);
    });

    it('treats cross-origin as different documents', () => {
      const host = createSparklingNavigationHost({ manifest });
      expect(host.isSameDocument(new URL('https://sparkling.app/'), new URL('https://example.com/'))).toBe(false);
    });
  });
});

describe('deriveInitialUrl', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).lynx;
  });

  it('prefers the explicit __path query item', () => {
    (globalThis as Record<string, unknown>).lynx = {
      __globalProps: { queryItems: { __path: '/users/7?tab=likes' } },
    };
    expect(deriveInitialUrl(manifest)).toBe('https://sparkling.app/users/7?tab=likes');
  });

  it('falls back to the route matching the loaded bundle', () => {
    (globalThis as Record<string, unknown>).lynx = {
      __globalProps: { queryItems: { bundle: 'about.lynx.bundle' } },
    };
    expect(deriveInitialUrl(manifest)).toBe('https://sparkling.app/about');
  });

  it('derives the bundle name from a dev-server url= item', () => {
    (globalThis as Record<string, unknown>).lynx = {
      __globalProps: { queryItems: { url: 'http://127.0.0.1:5969/about.lynx.bundle' } },
    };
    expect(deriveInitialUrl(manifest)).toBe('https://sparkling.app/about');
  });

  it('falls back to the base path when nothing matches', () => {
    expect(deriveInitialUrl(manifest)).toBe('https://sparkling.app/');
  });
});
