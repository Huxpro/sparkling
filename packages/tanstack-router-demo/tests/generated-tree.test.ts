// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Proves the *generated* routeTree.gen.ts (produced by @tanstack/router-generator
// with no bundler) drives navigation over createMpaHistory — i.e. the official
// file-based generator is directly reusable in a Rspeedy/Lynx project.
import { describe, expect, test } from 'vitest';
import { createRouter } from '@tanstack/react-router';
import { createMpaHistory, createMemoryHost, createManifestPageResolver } from 'sparkling-history';
import { routeTree } from '../src/routeTree.gen.js';
import { manifest } from '../src/routes.manifest.js';

const ORIGIN = 'http://sparkling.local';

describe('generated routeTree.gen.ts + generated manifest', () => {
  test('boots at the generated index route', async () => {
    const router = createRouter({
      routeTree,
      history: createMpaHistory({ host: createMemoryHost({ initialHref: '/' }) }) as never,
      isServer: false,
      origin: ORIGIN,
    });
    await router.load();
    expect(router.state.location.pathname).toBe('/');
  });

  test('generated path param route resolves', async () => {
    const router = createRouter({
      routeTree,
      history: createMpaHistory({ host: createMemoryHost({ initialHref: '/detail/7?ref=x' }) }) as never,
      isServer: false,
      origin: ORIGIN,
    });
    await router.load();
    const leaf = router.state.matches[router.state.matches.length - 1]!;
    expect(leaf.routeId).toBe('/detail/$id');
    expect((leaf.params as { id?: string }).id).toBe('7');
  });

  test('generated manifest routes cross-page navigation to the right bundle', async () => {
    const host = createMemoryHost({ initialHref: '/' });
    const history = createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) });
    const router = createRouter({
      routeTree,
      history: history as never,
      isServer: false,
      origin: ORIGIN,
    });
    await router.load();
    await router.navigate({ to: '/detail/$id', params: { id: '9' } });
    expect(host.opens).toHaveLength(1);
    expect(host.opens[0]!.page.id).toBe('detail');
  });

  test('manifest keeps /profile in the home bundle (in-page)', async () => {
    const host = createMemoryHost({ initialHref: '/' });
    const history = createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) });
    const router = createRouter({
      routeTree,
      history: history as never,
      isServer: false,
      origin: ORIGIN,
    });
    await router.load();
    await router.navigate({ to: '/profile' });
    await router.invalidate();
    // In-page: no native open, location moved within the bundle.
    expect(host.opens).toHaveLength(0);
    expect(router.state.location.pathname).toBe('/profile');
  });
});
