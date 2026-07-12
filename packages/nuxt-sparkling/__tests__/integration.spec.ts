// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Full-stack integration: Nuxt page tree → Sparkling manifest → Sparkling
 * NavigationHost → web-navigation-shim → real vue-router. Proves the MPA
 * wiring end to end:
 *   - booting a page at its deep-linked route,
 *   - a router.push to a different bundle handing off to the native host
 *     (router.open with the mapped scheme + __path),
 *   - back at the bottom of the stack becoming a native close.
 *
 * The native bridge is exercised for real: we install a `NativeModules`
 * global with a `spkPipe` module (the exact seam sparkling-method's pipe
 * routes through), so router.open/close flow through the real pipe.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesToSparklingManifest } from '../src/manifest';
import type { NuxtLikePage } from '../src/manifest';

interface PipeEnvelope { containerID: string; protocolVersion: string; data: Record<string, unknown> }
const spkPipe = vi.fn(
  (_method: string, _envelope: PipeEnvelope, cb?: (r: unknown) => void) => {
    if (typeof cb === 'function') cb({ code: 1, msg: 'ok' });
  },
);
(globalThis as Record<string, unknown>).NativeModules = { spkPipe: { call: spkPipe } };

const pages: NuxtLikePage[] = [
  { name: 'index', path: '/', file: 'pages/index.vue', children: [] },
  { name: 'about', path: '/about', file: 'pages/about.vue', children: [] },
  { name: 'users-id', path: '/users/:id()', file: 'pages/users/[id].vue', children: [] },
];

const { manifest } = pagesToSparklingManifest(pages, { origin: 'https://sparkling.app' });

let createSparklingNavigationHost: typeof import('sparkling-navigation/shim-host').createSparklingNavigationHost;
let createNavigationShim: typeof import('web-navigation-shim').createNavigationShim;
let vueRouter: typeof import('vue-router');

beforeAll(async () => {
  ({ createSparklingNavigationHost } = await import('sparkling-navigation/shim-host'));
  ({ createNavigationShim } = await import('web-navigation-shim'));
  vueRouter = await import('vue-router');
});

beforeEach(() => spkPipe.mockClear());

const Empty = { render: () => null };

function calls(method: string): PipeEnvelope[] {
  return spkPipe.mock.calls.filter((c) => c[0] === method).map((c) => c[1] as PipeEnvelope);
}
function schemes(method = 'router.open'): string[] {
  return calls(method).map((e) => e.data.scheme as string);
}

describe('Nuxt MPA navigation over Sparkling', () => {
  it('boots at the deep-linked route and hands cross-bundle navigation to router.open', async () => {
    // Simulate a page opened at /users/42 (a fresh JS heap).
    const host = createSparklingNavigationHost({ manifest, initialUrl: '/users/42' });
    const shim = createNavigationShim(host);
    shim.install(globalThis as unknown as Record<string, unknown>, { force: true });

    const router = vueRouter.createRouter({
      history: vueRouter.createWebHistory(),
      routes: [
        { path: '/', name: 'index', component: Empty },
        { path: '/about', name: 'about', component: Empty },
        { path: '/users/:id()', name: 'users-id', component: Empty },
      ],
    });

    // Boot at the shim's initial URL (what the Nuxt router plugin does).
    await router.push(shim.location.pathname + shim.location.search);
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('users-id');
    expect(router.currentRoute.value.params).toEqual({ id: '42' });

    // The Nuxt↔Sparkling glue expresses a cross-bundle navigation as:
    // intercept and hand off via location.assign(target).
    router.beforeEach((to) => {
      shim.location.assign(to.fullPath);
      return false;
    });

    await router.push('/about').catch(() => {});
    const opened = schemes();
    expect(opened.length).toBe(1);
    expect(opened[0]).toContain('bundle=about.lynx.bundle');
    expect(opened[0]).toContain(`__path=${encodeURIComponent('/about')}`);
    // Router stayed put (handoff aborted the in-context navigation).
    expect(router.currentRoute.value.name).toBe('users-id');
  });

  it('back at the bottom of the local stack becomes router.close (native pop)', () => {
    const host = createSparklingNavigationHost({ manifest, initialUrl: '/about' });
    const shim = createNavigationShim(host);
    shim.history.back();
    expect(calls('router.close').length).toBe(1);
  });

  it('external URLs route through the webview container scheme', () => {
    const host = createSparklingNavigationHost({ manifest, initialUrl: '/' });
    const shim = createNavigationShim(host);
    shim.window.open('https://example.com/help');
    expect(schemes()[0]).toContain('hybrid://webview');
    expect(schemes()[0]).toContain(encodeURIComponent('https://example.com/help'));
  });
});
