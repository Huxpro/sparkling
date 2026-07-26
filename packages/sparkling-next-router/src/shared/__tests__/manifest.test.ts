// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  bundleNameForPattern,
  compilePattern,
  matchRoute,
  schemeForEntry,
  type RouteManifest,
} from '../manifest';

function build(patterns: string[]): RouteManifest {
  return {
    baseScheme: 'hybrid://lynxview_page',
    routes: patterns.map((pattern) => {
      const { paramNames, regexSource, kind } = compilePattern(pattern);
      return { pattern, bundle: bundleNameForPattern(pattern), paramNames, regexSource, kind };
    }),
  };
}

describe('compilePattern', () => {
  test('static route', () => {
    const c = compilePattern('/about');
    expect(c.kind).toBe('static');
    expect(c.paramNames).toEqual([]);
    expect(new RegExp(c.regexSource).test('/about')).toBe(true);
    expect(new RegExp(c.regexSource).test('/about/x')).toBe(false);
  });

  test('root route', () => {
    const c = compilePattern('/');
    expect(new RegExp(c.regexSource).test('/')).toBe(true);
  });

  test('dynamic segment', () => {
    const c = compilePattern('/products/[id]');
    expect(c.kind).toBe('dynamic');
    expect(c.paramNames).toEqual(['id']);
    const m = '/products/42'.match(new RegExp(c.regexSource));
    expect(m?.[1]).toBe('42');
  });

  test('catch-all', () => {
    const c = compilePattern('/docs/[...slug]');
    expect(c.kind).toBe('catchall');
    expect('/docs/a/b/c'.match(new RegExp(c.regexSource))?.[1]).toBe('a/b/c');
    expect(new RegExp(c.regexSource).test('/docs')).toBe(false);
  });

  test('optional catch-all matches base and nested', () => {
    const c = compilePattern('/shop/[[...slug]]');
    expect(c.kind).toBe('optional-catchall');
    expect(new RegExp(c.regexSource).test('/shop')).toBe(true);
    expect('/shop/a/b'.match(new RegExp(c.regexSource))?.[1]).toBe('a/b');
  });
});

describe('matchRoute priority', () => {
  const manifest = build(['/', '/products/[id]', '/products/new', '/docs/[...slug]', '/[[...catchall]]']);

  test('static beats dynamic', () => {
    expect(matchRoute(manifest, '/products/new')?.entry.pattern).toBe('/products/new');
  });

  test('dynamic captures param', () => {
    const m = matchRoute(manifest, '/products/42');
    expect(m?.entry.pattern).toBe('/products/[id]');
    expect(m?.params).toEqual({ id: '42' });
  });

  test('catch-all returns array param', () => {
    const m = matchRoute(manifest, '/docs/a/b');
    expect(m?.entry.pattern).toBe('/docs/[...slug]');
    expect(m?.params).toEqual({ slug: ['a', 'b'] });
  });

  test('root optional catch-all as last resort', () => {
    expect(matchRoute(manifest, '/anything/here')?.entry.pattern).toBe('/[[...catchall]]');
  });

  test('decodes percent-encoded params', () => {
    expect(matchRoute(manifest, '/products/a%20b')?.params).toEqual({ id: 'a b' });
  });
});

describe('bundleNameForPattern', () => {
  test('flattens and encodes', () => {
    expect(bundleNameForPattern('/')).toBe('index');
    expect(bundleNameForPattern('/about')).toBe('about');
    expect(bundleNameForPattern('/products/[id]')).toBe('products___id_');
    expect(bundleNameForPattern('/docs/[...slug]')).toBe('docs___catch_slug_');
    expect(bundleNameForPattern('/shop/[[...s]]')).toBe('shop___ocatch_s_');
  });

  test('is collision-free for distinct patterns', () => {
    const patterns = ['/', '/a', '/a/b', '/a/[b]', '/[a]/b'];
    const names = patterns.map(bundleNameForPattern);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('schemeForEntry', () => {
  test('encodes the bundle file name', () => {
    const manifest = build(['/products/[id]']);
    const scheme = schemeForEntry(manifest, manifest.routes[0]);
    expect(scheme).toBe('hybrid://lynxview_page?bundle=products___id_.lynx.bundle');
  });
});
