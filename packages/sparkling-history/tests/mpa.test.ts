// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// MPA-specific behavior: the boundary between in-page SPA navigation and
// native page opens, seeded stack depth, and cross-page back → close.
import { describe, expect, test } from 'vitest';
import { createMpaHistory } from '../src/create-mpa-history.js';
import { createMemoryHost } from '../src/hosts/memory.js';
import { createManifestPageResolver, type PageManifest } from '../src/resolve-page.js';

const manifest: PageManifest = {
  pages: [
    { id: 'main', paths: ['/'] },
    { id: 'detail', paths: ['/detail'], containerParams: { title: 'Detail' } },
    { id: 'settings', paths: ['/settings'] },
  ],
};

describe('createMpaHistory — cross-page navigation', () => {
  test('in-page push stays local; does NOT call host.open', () => {
    const host = createMemoryHost({ initialHref: '/' });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });

    // '/' and '/about-in-main' both belong to page 'main'
    history.push('/nested');
    expect(host.opens).toHaveLength(0);
    expect(history.location.pathname).toBe('/nested');
  });

  test('cross-page push calls host.open and does NOT mutate local stack', () => {
    const host = createMemoryHost({ initialHref: '/' });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });

    history.push('/detail/42?ref=home');
    // Local stack untouched — the current page keeps rendering until the
    // container covers it (document-navigation semantics).
    expect(history.location.pathname).toBe('/');
    expect(host.opens).toHaveLength(1);
    expect(host.opens[0]!.href).toBe('/detail/42?ref=home');
    expect(host.opens[0]!.page.id).toBe('detail');
    expect(host.opens[0]!.replace).toBe(false);
  });

  test('cross-page push forwards container params from the manifest', () => {
    const host = createMemoryHost({ initialHref: '/' });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.push('/detail/42');
    expect(host.opens[0]!.page.containerParams).toEqual({ title: 'Detail' });
  });

  test('cross-page push carries user state (minus internal keys)', () => {
    const host = createMemoryHost({ initialHref: '/' });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.push('/settings', { tab: 'privacy' });
    expect(host.opens[0]!.state).toEqual({ tab: 'privacy' });
  });

  test('cross-page replace maps to host.open({ replace: true })', () => {
    const host = createMemoryHost({ initialHref: '/' });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.replace('/settings');
    expect(host.opens[0]!.replace).toBe(true);
  });

  test('back at local root → host.close (native pop)', () => {
    const host = createMemoryHost({ initialHref: '/detail/42', stackDepth: 1 });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.back();
    expect(host.closes).toHaveLength(1);
  });

  test('back after in-page push pops locally, not the native page', () => {
    const host = createMemoryHost({ initialHref: '/detail', stackDepth: 1 });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.push('/detail/sub'); // in-page (same page 'detail')
    expect(history.location.pathname).toBe('/detail/sub');
    history.back();
    expect(history.location.pathname).toBe('/detail');
    expect(host.closes).toHaveLength(0); // did not pop the native page
  });

  test('stack depth seeds __TSR_index so canGoBack is true on a pushed page', () => {
    const host = createMemoryHost({ initialHref: '/detail/42', stackDepth: 2 });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    // Even at the local root, we are 2 pages deep natively.
    expect(history.location.state.__TSR_index).toBe(2);
    expect(history.canGoBack()).toBe(true);
  });

  test('root page: canGoBack is false at depth 0', () => {
    const host = createMemoryHost({ initialHref: '/', stackDepth: 0 });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    expect(history.canGoBack()).toBe(false);
  });

  test('initial location reconstructed from host initial href + state', () => {
    const host = createMemoryHost({
      initialHref: '/detail/42?ref=home',
      stackDepth: 1,
      initialState: { scrollTo: 100 },
    });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    expect(history.location.pathname).toBe('/detail/42');
    expect(history.location.search).toBe('?ref=home');
    expect((history.location.state as { scrollTo?: number }).scrollTo).toBe(100);
  });

  test('onHostError fires when host.open rejects', async () => {
    let captured: unknown;
    const host = createMemoryHost({ initialHref: '/' });
    // Override open to reject.
    host.open = () => Promise.resolve({ ok: false, message: 'boom' });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({
      host,
      resolvePage,
      onHostError: (e) => {
        captured = e;
      },
    });
    history.push('/detail');
    await new Promise((r) => setTimeout(r, 0));
    expect(captured).toBeInstanceOf(Error);
  });
});
