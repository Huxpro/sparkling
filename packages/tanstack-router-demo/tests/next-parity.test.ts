// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// RFC phase 3: two authoring frontends, one core. The Next-style app directory
// (src/app) is translated by scripts/gen-next.mjs into the SAME artifact pair
// (route tree + page manifest) as the TanStack file convention (src/routes),
// and the same runtime consumes either. These tests pin that equivalence.
import { describe, expect, test } from 'vitest';
import { createRouter } from '@tanstack/react-router';
import { createMpaHistory, createMemoryHost, createManifestPageResolver } from 'sparkling-history';
import { routeTree as tanstackTree } from '../src/routeTree.gen.js';
import { manifest as tanstackManifest } from '../src/routes.manifest.js';
import { routeTree as nextTree } from '../src/routeTree.next.gen.js';
import { manifest as nextManifest } from '../src/routes-next.manifest.js';

const ORIGIN = 'http://sparkling.local';

function makeRouter(routeTree: unknown, initialHref: string, host = createMemoryHost({ initialHref })) {
  const history = createMpaHistory({
    host,
    resolvePage: createManifestPageResolver(nextManifest),
  });
  const router = createRouter({
    routeTree: routeTree as never,
    history: history as never,
    isServer: false,
    origin: ORIGIN,
  });
  return { router, host };
}

describe('next-style frontend compiles to the same artifacts', () => {
  test('route id sets are identical across frontends', () => {
    const { router: a } = makeRouter(tanstackTree, '/');
    const { router: b } = makeRouter(nextTree, '/');
    const ids = (r: { routesById: Record<string, unknown> }) => Object.keys(r.routesById).sort();
    expect(ids(b as never)).toEqual(ids(a as never));
  });

  test('page manifests are deep-equal (ids, paths, containerParams, defaultHref)', () => {
    expect(nextManifest).toEqual(tanstackManifest);
  });
});

describe('the shared runtime consumes the next-frontend artifacts unchanged', () => {
  test('boots at the index route', async () => {
    const { router } = makeRouter(nextTree, '/');
    await router.load();
    expect(router.state.location.pathname).toBe('/');
  });

  test('path param + routeOptions (validateSearch) pass through the bridge', async () => {
    const { router } = makeRouter(nextTree, '/detail/7?ref=x');
    await router.load();
    const leaf = router.state.matches[router.state.matches.length - 1]!;
    expect(leaf.routeId).toBe('/detail/$id');
    expect((leaf.params as { id?: string }).id).toBe('7');
    expect((leaf.search as { ref?: string }).ref).toBe('x');
  });

  test('cross-page navigation dispatches a native open to the right bundle', async () => {
    const { router, host } = makeRouter(nextTree, '/');
    await router.load();
    await router.navigate({ to: '/detail/$id', params: { id: '9' } });
    expect(host.opens).toHaveLength(1);
    expect(host.opens[0]!.page.id).toBe('detail');
  });

  test('/profile stays in-page in the home bundle', async () => {
    const { router, host } = makeRouter(nextTree, '/');
    await router.load();
    await router.navigate({ to: '/profile' });
    await router.invalidate();
    expect(host.opens).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/profile');
  });
});
