// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Empirical feature-support matrix. These drive a REAL @tanstack/react-router
// instance headlessly over `createMpaHistory`, exercising each router feature
// and asserting the outcome. This is the evidence behind the support matrix in
// docs/en/guide/tanstack-router.md: a passing test here means "supported in
// the in-page subset"; the mpa.test.ts / sparkling-host.test.ts suites cover
// the cross-page (native) behaviors.
//
// `origin` is passed explicitly to every router: router-core reads a bare
// `window` global otherwise, which is undeclared in a native Lynx runtime.
import { describe, expect, test, vi } from 'vitest';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  notFound,
} from '@tanstack/react-router';
import { createMpaHistory, createMemoryHost, createManifestPageResolver } from 'sparkling-history';
import type { PageManifest } from 'sparkling-history';

const ORIGIN = 'http://sparkling.local';

function mkRouter(routeTree: unknown, initialHref = '/') {
  const history = createMpaHistory({ host: createMemoryHost({ initialHref }) });
  return createRouter({
    routeTree: routeTree as never,
    history: history as never,
    isServer: false,
    origin: ORIGIN,
  });
}

describe('TanStack Router feature support over createMpaHistory (in-page subset)', () => {
  test('nested routes + outlet: parent and child both match', async () => {
    const root = createRootRoute();
    const layout = createRoute({ getParentRoute: () => root, id: 'layout' });
    const child = createRoute({ getParentRoute: () => layout, path: '/child' });
    const tree = root.addChildren([layout.addChildren([child])]);
    const router = mkRouter(tree, '/child');
    await router.load();
    const ids = router.state.matches.map((m) => m.routeId);
    // root + pathless layout + child all participate in the match chain.
    expect(ids).toContain('/layout');
    expect(ids).toContain(child.id);
    expect(ids.length).toBe(3);
  });

  test('path params are parsed', async () => {
    const root = createRootRoute();
    const detail = createRoute({ getParentRoute: () => root, path: '/detail/$id' });
    const router = mkRouter(root.addChildren([detail]), '/detail/99');
    await router.load();
    const match = router.state.matches.find((m) => m.routeId === detail.id);
    expect((match?.params as { id?: string }).id).toBe('99');
  });

  test('validated search params', async () => {
    const root = createRootRoute();
    const search = createRoute({
      getParentRoute: () => root,
      path: '/s',
      // The default search parser coerces `n=7` to the number 7, so validate
      // by coercing whatever type arrives.
      validateSearch: (s: Record<string, unknown>) => ({ n: Number(s.n ?? 0) }),
    });
    const router = mkRouter(root.addChildren([search]), '/s?n=7');
    await router.load();
    const match = router.state.matches.find((m) => m.routeId === search.id);
    expect((match?.search as { n?: number }).n).toBe(7);
  });

  test('loaders run and expose loaderData', async () => {
    const root = createRootRoute();
    const idx = createRoute({
      getParentRoute: () => root,
      path: '/',
      loader: async () => ({ value: 42 }),
    });
    const router = mkRouter(root.addChildren([idx]));
    await router.load();
    const match = router.state.matches.find((m) => m.routeId === idx.id);
    expect((match?.loaderData as { value?: number }).value).toBe(42);
  });

  test('beforeLoad + route context', async () => {
    const root = createRootRoute();
    const idx = createRoute({
      getParentRoute: () => root,
      path: '/',
      beforeLoad: () => ({ user: 'alice' }),
      loader: ({ context }: { context: { user: string } }) => ({ who: context.user }),
    });
    const router = mkRouter(root.addChildren([idx]));
    await router.load();
    const match = router.state.matches.find((m) => m.routeId === idx.id);
    expect((match?.loaderData as { who?: string }).who).toBe('alice');
  });

  test('redirect() in beforeLoad changes the resolved location', async () => {
    const root = createRootRoute();
    const guarded = createRoute({
      getParentRoute: () => root,
      path: '/guarded',
      beforeLoad: () => {
        throw redirect({ to: '/login' });
      },
    });
    const login = createRoute({ getParentRoute: () => root, path: '/login' });
    const router = mkRouter(root.addChildren([guarded, login]), '/guarded');
    await router.load();
    expect(router.state.location.pathname).toBe('/login');
  });

  test('notFound() surfaces a not-found match', async () => {
    const root = createRootRoute();
    const idx = createRoute({
      getParentRoute: () => root,
      path: '/',
      loader: () => {
        throw notFound();
      },
    });
    const router = mkRouter(root.addChildren([idx]));
    await router.load();
    const match = router.state.matches.find((m) => m.routeId === idx.id);
    expect(match?.status).toBe('notFound');
  });

  test('loader errors surface as an error match', async () => {
    const root = createRootRoute();
    const idx = createRoute({
      getParentRoute: () => root,
      path: '/',
      loader: () => {
        throw new Error('boom');
      },
    });
    const router = mkRouter(root.addChildren([idx]));
    await router.load();
    const match = router.state.matches.find((m) => m.routeId === idx.id);
    expect(match?.status).toBe('error');
  });

  test('imperative navigate() updates location and matches', async () => {
    const root = createRootRoute();
    const idx = createRoute({ getParentRoute: () => root, path: '/' });
    const about = createRoute({ getParentRoute: () => root, path: '/about' });
    const router = mkRouter(root.addChildren([idx, about]));
    await router.load();
    await router.navigate({ to: '/about' });
    await router.invalidate();
    expect(router.state.location.pathname).toBe('/about');
  });

  test('route masking: masked location differs from real location', async () => {
    const root = createRootRoute();
    const idx = createRoute({ getParentRoute: () => root, path: '/' });
    const photo = createRoute({ getParentRoute: () => root, path: '/photo/$id' });
    const router = mkRouter(root.addChildren([idx, photo]));
    await router.load();
    await router.navigate({ to: '/photo/$id', params: { id: '1' }, mask: { to: '/' } as never });
    await router.invalidate();
    // The real location is the photo; the mask records '/' in history state.
    expect(router.state.location.pathname).toBe('/photo/1');
    expect(router.state.location.maskedLocation?.pathname).toBe('/');
  });
});

describe('navigation blocking works with no DOM (createMpaHistory guarantee)', () => {
  test('a blocker prevents an in-page push even without a global document', async () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    const host = createMemoryHost({ initialHref: '/' });
    const history = createMpaHistory({ host });
    const blockerFn = vi.fn(() => true);
    history.block({ blockerFn });
    await history.push('/blocked');
    expect(history.location.pathname).toBe('/');
    expect(blockerFn).toHaveBeenCalledTimes(1);
  });
});

describe('cross-page navigation is forwarded to the host (MPA behavior)', () => {
  const manifest: PageManifest = {
    pages: [
      { id: 'home', paths: ['/'] },
      { id: 'detail', paths: ['/detail'] },
    ],
  };

  test('router.navigate to another page calls host.open, not an in-page transition', async () => {
    const root = createRootRoute();
    const idx = createRoute({ getParentRoute: () => root, path: '/' });
    const detail = createRoute({ getParentRoute: () => root, path: '/detail/$id' });
    const host = createMemoryHost({ initialHref: '/' });
    const history = createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) });
    const router = createRouter({
      routeTree: root.addChildren([idx, detail]) as never,
      history: history as never,
      isServer: false,
      origin: ORIGIN,
    });
    await router.load();
    await router.navigate({ to: '/detail/$id', params: { id: '7' } });
    // The current page stays put; the host was asked to open the detail page.
    expect(router.state.location.pathname).toBe('/');
    expect(host.opens).toHaveLength(1);
    expect(host.opens[0]!.page.id).toBe('detail');
    expect(host.opens[0]!.href).toContain('/detail/7');
  });
});
