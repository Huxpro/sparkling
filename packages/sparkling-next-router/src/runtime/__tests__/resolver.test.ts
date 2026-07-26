// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { UrlShim } from 'sparkling-history-shim';
import { bundleNameForPattern, compilePattern, type RouteManifest } from '../../shared/manifest';
import { createManifestResolver } from '../resolver';

function build(patterns: string[]): RouteManifest {
  return {
    baseScheme: 'hybrid://lynxview_page',
    routes: patterns.map((pattern) => {
      const { paramNames, regexSource, kind } = compilePattern(pattern);
      return { pattern, bundle: bundleNameForPattern(pattern), paramNames, regexSource, kind };
    }),
  };
}

const manifest = build(['/', '/products/[id]', '/about']);

function u(path: string): UrlShim {
  return new UrlShim(path, 'sparkling://app/');
}

describe('createManifestResolver', () => {
  test('same bundle as current route → same-page', () => {
    const resolver = createManifestResolver(manifest, '/products/[id]');
    const res = resolver.resolve(u('/products/99'), u('/products/1'));
    expect(res.kind).toBe('same-page');
  });

  test('different bundle → cross-page with that bundle scheme', () => {
    const resolver = createManifestResolver(manifest, '/');
    const res = resolver.resolve(u('/products/1'), u('/'));
    expect(res.kind).toBe('cross-page');
    if (res.kind === 'cross-page') {
      expect(res.scheme).toContain('products___id_.lynx.bundle');
    }
  });

  test('unknown route → external', () => {
    const resolver = createManifestResolver(manifest, '/');
    const res = resolver.resolve(u('/nope/nowhere'), u('/'));
    expect(res.kind).toBe('external');
  });

  test('static route resolves its own bundle for same-page detection', () => {
    const resolver = createManifestResolver(manifest, '/about');
    expect(resolver.resolve(u('/about'), u('/about')).kind).toBe('same-page');
    expect(resolver.resolve(u('/'), u('/about')).kind).toBe('cross-page');
  });
});
