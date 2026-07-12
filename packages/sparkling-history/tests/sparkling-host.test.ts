// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// The sparkling host adapter: scheme building, param transport, and
// round-tripping the launch query back into an initial location.
import { describe, expect, test, vi } from 'vitest';
import { createSparklingHost } from '../src/hosts/sparkling.js';
import { createMpaHistory } from '../src/create-mpa-history.js';
import { createManifestPageResolver, type PageManifest } from '../src/resolve-page.js';

const manifest: PageManifest = {
  pages: [
    { id: 'main', paths: ['/'] },
    { id: 'detail', paths: ['/detail'], containerParams: { title: 'Detail', hide_nav_bar: '1' } },
  ],
};

function fakeNavigation() {
  const openCalls: Array<{ scheme: string; options?: Record<string, unknown> }> = [];
  const closeCalls: Array<{ animated?: boolean } | undefined> = [];
  return {
    openCalls,
    closeCalls,
    open(
      params: { scheme: string; options?: Record<string, unknown> },
      cb: (r: { code: number; msg: string }) => void,
    ) {
      openCalls.push(params);
      cb({ code: 1, msg: 'ok' });
    },
    close(params: { animated?: boolean } | undefined, cb: (r: { code: number; msg: string }) => void) {
      closeCalls.push(params);
      cb({ code: 1, msg: 'ok' });
    },
  };
}

describe('createSparklingHost', () => {
  test('open builds a hybrid scheme with bundle + transport params', () => {
    const navigation = fakeNavigation();
    const host = createSparklingHost({ navigation, getQueryItems: () => ({}) });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });

    history.push('/detail/42?ref=home', { scrollTo: 10 });

    expect(navigation.openCalls).toHaveLength(1);
    const url = new URL(navigation.openCalls[0]!.scheme);
    expect(url.protocol).toBe('hybrid:');
    expect(url.searchParams.get('bundle')).toBe('detail.lynx.bundle');
    // container params from manifest
    expect(url.searchParams.get('title')).toBe('Detail');
    expect(url.searchParams.get('hide_nav_bar')).toBe('1');
    // MPA transport
    expect(url.searchParams.get('__mpa_href')).toBe('/detail/42?ref=home');
    expect(url.searchParams.get('__mpa_depth')).toBe('1');
    expect(JSON.parse(url.searchParams.get('__mpa_state')!)).toEqual({ scrollTo: 10 });
  });

  test('replace passes options.replace to sparkling open', () => {
    const navigation = fakeNavigation();
    const host = createSparklingHost({ navigation, getQueryItems: () => ({}) });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.replace('/detail');
    expect(navigation.openCalls[0]!.options).toEqual({ replace: true });
  });

  test('back at root calls sparkling close', () => {
    const navigation = fakeNavigation();
    const host = createSparklingHost({
      navigation,
      getQueryItems: () => ({ __mpa_href: '/detail', __mpa_depth: '1' }),
    });
    const resolvePage = createManifestPageResolver(manifest);
    const history = createMpaHistory({ host, resolvePage });
    history.back();
    expect(navigation.closeCalls).toHaveLength(1);
  });

  test('reconstructs initial href/depth/state from query items (round-trip)', () => {
    const navigation = fakeNavigation();
    // Simulate the queryItems a page was launched with.
    const host = createSparklingHost({
      navigation,
      getQueryItems: () => ({
        __mpa_href: '/detail/42?ref=home',
        __mpa_depth: '3',
        __mpa_state: JSON.stringify({ scrollTo: 50 }),
      }),
    });
    const history = createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) });

    expect(history.location.pathname).toBe('/detail/42');
    expect(history.location.search).toBe('?ref=home');
    expect(history.location.state.__TSR_index).toBe(3);
    expect((history.location.state as { scrollTo?: number }).scrollTo).toBe(50);
  });

  test('spaces in scheme are encoded as %20, not +', () => {
    const navigation = fakeNavigation();
    const host = createSparklingHost({ navigation, getQueryItems: () => ({}) });
    const history = createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) });
    history.push('/detail?q=hello world');
    expect(navigation.openCalls[0]!.scheme).not.toContain('+');
    expect(navigation.openCalls[0]!.scheme).toContain('%20');
  });

  test('open failure (code !== 1) surfaces through onHostError', async () => {
    const onHostError = vi.fn();
    const navigation = {
      open(_p: unknown, cb: (r: { code: number; msg: string }) => void) {
        cb({ code: 0, msg: 'router unavailable' });
      },
      close(_p: unknown, cb: (r: { code: number; msg: string }) => void) {
        cb({ code: 1, msg: 'ok' });
      },
    };
    const host = createSparklingHost({ navigation, getQueryItems: () => ({}) });
    const history = createMpaHistory({
      host,
      resolvePage: createManifestPageResolver(manifest),
      onHostError,
    });
    history.push('/detail');
    await new Promise((r) => setTimeout(r, 0));
    expect(onHostError).toHaveBeenCalled();
  });
});
