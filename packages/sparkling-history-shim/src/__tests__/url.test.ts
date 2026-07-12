// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { UrlShim, UrlSearchParamsShim } from '../url';

describe('UrlShim', () => {
  test('parses absolute non-special scheme URLs with authority', () => {
    const url = new UrlShim('sparkling://app/products/42?tab=specs#top');
    expect(url.protocol).toBe('sparkling:');
    expect(url.host).toBe('app');
    expect(url.pathname).toBe('/products/42');
    expect(url.search).toBe('?tab=specs');
    expect(url.hash).toBe('#top');
    expect(url.origin).toBe('sparkling://app');
    expect(url.href).toBe('sparkling://app/products/42?tab=specs#top');
  });

  test('origin is protocol//host even for custom schemes (unlike WHATWG null)', () => {
    expect(new UrlShim('hybrid://lynxview_page?bundle=x').origin).toBe('hybrid://lynxview_page');
  });

  test('parses http URLs', () => {
    const url = new UrlShim('https://example.com:8080/a/b?x=1');
    expect(url.origin).toBe('https://example.com:8080');
    expect(url.hostname).toBe('example.com');
    expect(url.pathname).toBe('/a/b');
  });

  test('resolves root-relative URLs against a base', () => {
    const url = new UrlShim('/settings?x=1', 'sparkling://app/products/42?tab=specs');
    expect(url.href).toBe('sparkling://app/settings?x=1');
  });

  test('resolves path-relative URLs against the base directory', () => {
    expect(new UrlShim('edit', 'sparkling://app/products/42').href).toBe('sparkling://app/products/edit');
    expect(new UrlShim('../about', 'sparkling://app/products/42').href).toBe('sparkling://app/about');
    expect(new UrlShim('./x', 'sparkling://app/a/b/').href).toBe('sparkling://app/a/b/x');
  });

  test('resolves search-only and hash-only URLs', () => {
    const base = 'sparkling://app/list?page=1#frag';
    expect(new UrlShim('?page=2', base).href).toBe('sparkling://app/list?page=2');
    expect(new UrlShim('#other', base).href).toBe('sparkling://app/list?page=1#other');
  });

  test('normalizes dot segments and empty paths', () => {
    expect(new UrlShim('sparkling://app').pathname).toBe('/');
    expect(new UrlShim('sparkling://app/a/./b/../c').pathname).toBe('/a/c');
  });

  test('throws on relative URL without base', () => {
    expect(() => new UrlShim('/nope')).toThrow(TypeError);
  });

  test('searchParams reflect the query', () => {
    const url = new UrlShim('sparkling://app/x?a=1&b=two%20words&b=3');
    expect(url.searchParams.get('a')).toBe('1');
    expect(url.searchParams.get('b')).toBe('two words');
    expect(url.searchParams.getAll('b')).toEqual(['two words', '3']);
  });
});

describe('UrlSearchParamsShim', () => {
  test('set replaces all values for a key', () => {
    const params = new UrlSearchParamsShim('a=1&b=2&a=3');
    params.set('a', 'x');
    expect(params.toString()).toBe('a=x&b=2');
  });

  test('append/delete/has/forEach/iteration', () => {
    const params = new UrlSearchParamsShim();
    params.append('k', 'v1');
    params.append('k', 'v2');
    expect(params.has('k')).toBe(true);
    expect([...params.entries()]).toEqual([['k', 'v1'], ['k', 'v2']]);
    const seen: string[] = [];
    params.forEach((value, key) => seen.push(`${key}=${value}`));
    expect(seen).toEqual(['k=v1', 'k=v2']);
    params.delete('k');
    expect(params.has('k')).toBe(false);
  });

  test('encodes spaces as %20, not +', () => {
    const params = new UrlSearchParamsShim();
    params.set('q', 'two words');
    expect(params.toString()).toBe('q=two%20words');
  });

  test('decodes + as space when parsing', () => {
    expect(new UrlSearchParamsShim('q=two+words').get('q')).toBe('two words');
  });
});
