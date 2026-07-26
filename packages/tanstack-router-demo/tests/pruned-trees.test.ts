// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Per-page pruned route trees: each bundle carries only its own page's route
// options; foreign routes are path-only stubs that exist solely so
// `navigate({ to, params })` can build an href for the manifest resolver to
// dispatch. These tests boot each pruned tree the way its bundle entry does.
import { describe, expect, test } from 'vitest';
import { createRouter } from '@tanstack/react-router';
import { createMpaHistory, createMemoryHost, createManifestPageResolver } from 'sparkling-history';
import { manifest } from '../src/routes.manifest.js';
import { routeTree as homeTree } from '../src/pages.gen/home/routeTree.js';
import { routeTree as detailTree } from '../src/pages.gen/detail/routeTree.js';
import { routeTree as settingsTree } from '../src/pages.gen/settings/routeTree.js';

const ORIGIN = 'http://sparkling.local';

function boot(tree: unknown, initialHref: string) {
  const host = createMemoryHost({ initialHref });
  const history = createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) });
  const router = createRouter({
    routeTree: tree as never,
    history: history as never,
    isServer: false,
    origin: ORIGIN,
  });
  return { router, host };
}

describe('pruned per-page route trees', () => {
  test('manifest is schema v1 with a scheme base', () => {
    expect(manifest.version).toBe(1);
    expect(manifest.scheme?.base).toBe('hybrid://lynxview_page');
  });

  test('home tree renders its own routes with full options', async () => {
    const { router } = boot(homeTree, '/profile');
    await router.load();
    const leaf = router.state.matches[router.state.matches.length - 1]!;
    expect(leaf.routeId).toBe('/profile');
    // Real route, not a stub: the component came through the options spread.
    const route = (router.routesById as Record<string, { options: { component?: unknown } }>)[
      '/profile'
    ]!;
    expect(route.options.component).toBeTruthy();
  });

  test('cross-page navigate from a pruned tree builds the href via the stub and opens the right page', async () => {
    const { router, host } = boot(homeTree, '/');
    await router.load();
    await router.navigate({ to: '/detail/$id', params: { id: '9' }, search: { ref: 'x' } } as never);
    expect(host.opens).toHaveLength(1);
    expect(host.opens[0]!.page.id).toBe('detail');
    expect(host.opens[0]!.href).toContain('/detail/9');
    // The stub never rendered: current location did not move.
    expect(router.state.location.pathname).toBe('/');
  });

  test('presentation flows from the manifest into the open target', async () => {
    const { router, host } = boot(homeTree, '/');
    await router.load();
    await router.navigate({ to: '/settings' });
    expect(host.opens).toHaveLength(1);
    expect(host.opens[0]!.page.id).toBe('settings');
    expect(host.opens[0]!.page.presentation).toBe('modal');
  });

  test('detail tree resolves its param route with validateSearch intact', async () => {
    const { router } = boot(detailTree, '/detail/7?ref=x');
    await router.load();
    const leaf = router.state.matches[router.state.matches.length - 1]!;
    expect(leaf.routeId).toBe('/detail/$id');
    expect((leaf.params as { id?: string }).id).toBe('7');
    expect((leaf.search as { ref?: string }).ref).toBe('x');
  });

  test('settings tree boots standalone at its default route', async () => {
    const { router } = boot(settingsTree, '/settings');
    await router.load();
    const leaf = router.state.matches[router.state.matches.length - 1]!;
    expect(leaf.routeId).toBe('/settings');
  });

  test('stubs carry no component payload', () => {
    const { router } = boot(homeTree, '/');
    const stub = (router.routesById as Record<string, { options: { component?: unknown } }>)[
      '/settings'
    ]!;
    expect(stub.options.component).toBeUndefined();
  });
});
