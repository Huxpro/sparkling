// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Integration test: real vue-router `createWebHistory` running entirely on
 * the shim, in plain Node (no jsdom). This is the exact code path Nuxt
 * uses on the client, so passing here means the shim satisfies
 * vue-router's browser-history contract:
 *   - install-time globals gate (`typeof document`)
 *   - two-write push protocol (replaceState + pushState)
 *   - history.state round-trip and position accounting
 *   - popstate-driven back/forward with guard rollback (go(-delta))
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createNavigationShim } from '../src/shim';
import type { NavigationShim } from '../src/shim';
import type { NavigationHost } from '../src/types';

type VueRouterModule = typeof import('vue-router');

const BASE = 'https://app.local/';

let vueRouter: VueRouterModule;
let shim: NavigationShim;
let hostOpen: ReturnType<typeof vi.fn>;
let hostClose: ReturnType<typeof vi.fn>;

const Empty = { render: () => null };

const nextNavigation = (router: import('vue-router').Router) =>
  new Promise<void>((resolve, reject) => {
    const stopOk = router.afterEach(() => {
      stopOk();
      stopErr();
      resolve();
    });
    const stopErr = router.onError((error) => {
      stopOk();
      stopErr();
      reject(error);
    });
  });

beforeAll(async () => {
  hostOpen = vi.fn();
  hostClose = vi.fn();
  const host: NavigationHost = {
    initialUrl: BASE,
    open: hostOpen,
    close: hostClose,
  };
  shim = createNavigationShim(host);
  // vue-router captures `isBrowser` (typeof document) at import time, so the
  // shim must be installed onto globalThis BEFORE the dynamic import below.
  shim.install(globalThis as unknown as Record<string, unknown>);
  vueRouter = await import('vue-router');
});

describe('vue-router createWebHistory over the shim', () => {
  it('boots, pushes, and reads back history.state (two-write protocol)', async () => {
    const router = vueRouter.createRouter({
      history: vueRouter.createWebHistory(),
      routes: [
        { path: '/', component: Empty },
        { path: '/a', component: Empty },
        { path: '/users/:id', component: Empty },
        { path: '/native/:rest(.*)', component: Empty },
      ],
    });

    // Simulate what router.install() does in a browser: initial navigation.
    await router.push(shim.location.pathname + shim.location.search + shim.location.hash);
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/');

    await router.push('/a');
    expect(router.currentRoute.value.path).toBe('/a');
    expect(shim.location.pathname).toBe('/a');
    // vue-router state bookkeeping landed in our synthetic history:
    const state = shim.history.state as Record<string, unknown>;
    expect(state.current).toBe('/a');
    expect(state.back).toBe('/');
    expect(typeof state.position).toBe('number');
    // The departed entry got the forward pointer via replaceState:
    expect((shim.entries[shim.index - 1].state as Record<string, unknown>).forward).toBe('/a');

    await router.push({ path: '/users/42', query: { tab: 'posts' } });
    expect(shim.location.pathname).toBe('/users/42');
    expect(shim.location.search).toBe('?tab=posts');

    // Back/forward traverse the synthetic stack through popstate:
    const back = nextNavigation(router);
    router.back();
    await back;
    expect(router.currentRoute.value.path).toBe('/a');
    expect(shim.location.pathname).toBe('/a');

    const forward = nextNavigation(router);
    router.forward();
    await forward;
    expect(router.currentRoute.value.fullPath).toBe('/users/42?tab=posts');
  });

  it('guard rollback on back-navigation restores position via go(+delta)', async () => {
    const router = vueRouter.createRouter({
      history: vueRouter.createWebHistory(),
      routes: [
        { path: '/', component: Empty },
        { path: '/a', component: Empty },
        { path: '/users/:id', component: Empty },
        { path: '/blocked', component: Empty },
      ],
    });
    await router.push('/');
    await router.isReady();
    await router.push('/blocked');
    await router.push('/a');

    let block = true;
    router.beforeEach((to) => {
      if (block && to.path === '/blocked') return false;
      return true;
    });

    // Hardware/UI back to /blocked gets cancelled by the guard; vue-router
    // must roll the history back forward to /a without ending up in limbo.
    router.back();
    await vi.waitFor(() => {
      expect(shim.location.pathname).toBe('/a');
    });
    expect(router.currentRoute.value.path).toBe('/a');
    block = false;
  });

  it('router-level MPA handoff: manifest guard opens a new native document', async () => {
    const router = vueRouter.createRouter({
      history: vueRouter.createWebHistory(),
      routes: [
        { path: '/', component: Empty },
        { path: '/native/:rest(.*)', component: Empty },
      ],
    });
    // The pattern the Sparkling router glue uses: routes living in another
    // Lynx bundle are opened through the host instead of rendered locally.
    router.beforeEach((to) => {
      if (to.path.startsWith('/native/')) {
        shim.location.assign(to.fullPath);
        return false;
      }
      return true;
    });
    await router.push('/');
    await router.isReady();

    await router.push('/native/details?id=7').catch(() => {
      // vue-router surfaces the aborted navigation; the handoff already happened.
    });
    expect(hostOpen).toHaveBeenCalledWith('https://app.local/native/details?id=7', {});
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('back at the bottom of the local stack becomes a native close', async () => {
    // Fresh shim modeling a freshly opened native page. The globally
    // installed shim keeps serving vue-router's bare-global reads
    // (history.state), which is exactly the per-context split we model.
    const localClose = vi.fn();
    const localShim = createNavigationShim({
      initialUrl: 'https://app.local/detail',
      open: vi.fn(),
      close: localClose,
    });
    localShim.history.back();
    expect(localClose).toHaveBeenCalledTimes(1);
  });
});
