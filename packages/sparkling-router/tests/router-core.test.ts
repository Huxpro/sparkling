import { describe, expect, test } from 'vitest';
import {
  createManifestPageResolver,
  createMpaHistory,
  createRootRoute,
  createRoute,
  createRouter,
  resolveRoute,
  type RouteManifest,
} from '../src/index.js';
import { createMemoryHost } from 'sparkling-history';

const manifest: RouteManifest = {
  version: 'prototype-1',
  scheme: { base: 'hybrid://lynxview_page' },
  containers: [
    {
      id: 'home',
      bundle: 'home.lynx.bundle',
      presentation: 'push',
      routes: [{ path: '/' }, { path: '/profile' }],
    },
    {
      id: 'feed',
      bundle: 'feed.lynx.bundle',
      presentation: 'push',
      routes: [{ path: '/feed' }, { path: '/feed/$postId' }],
    },
  ],
};

describe('sparkling-router over @tanstack/router-core', () => {
  test('router-core works without @tanstack/react-router', async () => {
    const root = createRootRoute();
    const index = createRoute({ getParentRoute: () => root, path: '/' });
    const profile = createRoute({ getParentRoute: () => root, path: '/profile' });
    const host = createMemoryHost({ initialHref: '/' });
    const router = createRouter({
      routeTree: root.addChildren([index, profile]),
      history: createMpaHistory({ host }),
      isServer: false,
      origin: 'http://sparkling.local',
    });

    await router.load();
    await router.navigate({ to: '/profile' });
    expect(router.state.location.pathname).toBe('/profile');
    expect(host.opens).toHaveLength(0);
  });

  test('the same router-core forwards cross-container navigation', async () => {
    const root = createRootRoute();
    const index = createRoute({ getParentRoute: () => root, path: '/' });
    const detail = createRoute({ getParentRoute: () => root, path: '/feed/$postId' });
    const host = createMemoryHost({ initialHref: '/' });
    const router = createRouter({
      routeTree: root.addChildren([index, detail]),
      history: createMpaHistory({
        host,
        resolvePage: createManifestPageResolver(manifest),
      }),
      isServer: false,
      origin: 'http://sparkling.local',
    });

    await router.load();
    await router.navigate({ to: '/feed/$postId', params: { postId: '42' } });
    expect(router.state.location.pathname).toBe('/');
    expect(host.opens[0]?.page.id).toBe('feed');
    expect(host.opens[0]?.href).toBe('/feed/42');
  });

  test('manifest resolution supports TanStack and Next dynamic segment syntax', () => {
    expect(resolveRoute(manifest, '/feed/42')?.params).toEqual({ postId: '42' });
    const nextManifest: RouteManifest = {
      ...manifest,
      containers: [
        {
          id: 'user',
          bundle: 'user.lynx.bundle',
          presentation: 'push',
          routes: [{ path: '/user/:id' }],
        },
      ],
    };
    expect(resolveRoute(nextManifest, '/user/alice')?.params).toEqual({ id: 'alice' });
  });
});
