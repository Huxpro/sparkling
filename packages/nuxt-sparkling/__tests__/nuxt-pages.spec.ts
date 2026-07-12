// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Ports Nuxt's official `pages:generateRoutesFromFiles` fixtures
 * (packages/nuxt/test/pages.test.ts @ v4.4.8). Each fixture's `output` is
 * the exact `NuxtPage[]` Nuxt hands to the `pages:extend` hook. We feed
 * those trees through `pagesToSparklingManifest` and assert the flattened
 * MPA manifest, then confirm the manifest matches real URLs via the
 * runtime matcher. This is the acceptance traversal: every Nuxt routing
 * feature is exercised and classified supported / degraded / unsupported.
 */

import { describe, expect, it } from 'vitest';
import { pagesToSparklingManifest } from '../src/manifest';
import type { NuxtLikePage } from '../src/manifest';
import { matchSparklingRoute } from 'sparkling-navigation/shim-host';

const pagesDir = 'pages';
const layerDir = 'layer/pages';

/** Build a manifest and index its routes by path for assertions. */
function build(pages: NuxtLikePage[]) {
  const { manifest, diagnostics } = pagesToSparklingManifest(pages, { origin: 'https://sparkling.app' });
  const byPath = new Map(manifest.routes.map((r) => [r.path, r]));
  return { manifest, diagnostics, byPath };
}

describe('index pages', () => {
  it('flattens nested index files to absolute paths', () => {
    const { byPath } = build([
      { name: 'index', path: '/', file: `${pagesDir}/index.vue`, children: [] },
      { name: 'parent', path: '/parent', file: `${pagesDir}/parent/index.vue`, children: [] },
      { name: 'parent-child', path: '/parent/child', file: `${pagesDir}/parent/child/index.vue`, children: [] },
    ]);
    expect([...byPath.keys()].sort()).toEqual(['/', '/parent', '/parent/child']);
    expect(byPath.get('/parent/child')?.bundle).toBe('parent-child.lynx.bundle');
  });
});

describe('parent/child nested routes (degraded: outlet cannot cross heaps)', () => {
  it('flattens child to an absolute path and flags the wrapper', () => {
    const { byPath, diagnostics } = build([
      {
        name: 'parent',
        path: '/parent',
        file: `${pagesDir}/parent.vue`,
        children: [
          { name: 'parent-child', path: 'child', file: `${pagesDir}/parent/child.vue`, children: [] },
        ],
      },
    ]);
    expect(byPath.has('/parent')).toBe(true);
    expect(byPath.has('/parent/child')).toBe(true);
    expect(byPath.get('/parent/child')?.bundle).toBe('parent-child.lynx.bundle');
    // The wrapper parent.vue is reported as a degraded nested outlet.
    expect(diagnostics.find((d) => d.kind === 'nested-outlet' && d.path === '/parent')?.degraded).toBe(true);
  });
});

describe('catch-all routes', () => {
  it('supports top-level and nested catch-all', () => {
    const { byPath } = build([
      { name: 'index', path: '/', file: `${pagesDir}/index.vue`, children: [] },
      {
        name: 'slug',
        path: '/:slug(.*)*',
        file: `${pagesDir}/[...slug].vue`,
        children: [
          { name: 'slug-id', path: ':id()', file: `${pagesDir}/[...slug]/[id].vue`, children: [] },
        ],
      },
    ]);
    expect(byPath.has('/:slug(.*)*')).toBe(true);
    expect(byPath.has('/:slug(.*)*/:id()')).toBe(true);
    // Runtime matching of the catch-all:
    const { manifest } = build([
      { name: 'slug', path: '/:slug(.*)*', file: `${pagesDir}/[...slug].vue`, children: [] },
    ]);
    const m = matchSparklingRoute(manifest, '/a/b/c');
    expect(m?.route.name).toBe('slug');
    expect(m?.params).toEqual({ slug: ['a', 'b', 'c'] });
  });

  it('supports a catch-all in the middle of a path', () => {
    const { byPath } = build([
      { name: 'id', path: '/:id(.*)*', file: `${pagesDir}/[...id]/index.vue`, children: [] },
      { name: 'id-suffix', path: '/:id([^/]*)*/suffix', file: `${pagesDir}/[...id]/suffix.vue`, children: [] },
    ]);
    expect(byPath.has('/:id(.*)*')).toBe(true);
    expect(byPath.has('/:id([^/]*)*/suffix')).toBe(true);
  });
});

describe('dynamic and optional params', () => {
  it('supports required, optional, prefixed and nested dynamic params', () => {
    const { byPath, diagnostics, manifest } = build([
      { name: 'index', path: '/', file: `${pagesDir}/index.vue`, children: [] },
      { name: 'slug', path: '/:slug()', file: `${pagesDir}/[slug].vue`, children: [] },
      {
        path: '/:foo?',
        file: `${pagesDir}/[[foo]]`,
        children: [{ name: 'foo', path: '', file: `${pagesDir}/[[foo]]/index.vue`, children: [] }],
      },
      { name: 'opt-slug', path: '/opt/:slug?', file: `${pagesDir}/opt/[[slug]].vue`, children: [] },
      { name: 'nonopt-slug', path: '/nonopt/:slug()', file: `${pagesDir}/nonopt/[slug].vue`, children: [] },
      { name: 'optional-opt', path: '/optional/:opt?', file: `${pagesDir}/optional/[[opt]].vue`, children: [] },
      { name: 'sub-route-slug', path: '/:sub?/route-:slug()', file: `${pagesDir}/[[sub]]/route-[slug].vue`, children: [] },
      { name: 'optional-prefix-opt', path: '/optional/prefix-:opt?', file: `${pagesDir}/optional/prefix-[[opt]].vue`, children: [] },
      { name: 'optional-opt-postfix', path: '/optional/:opt?-postfix', file: `${pagesDir}/optional/[[opt]]-postfix.vue`, children: [] },
    ]);
    expect(byPath.has('/:slug()')).toBe(true);
    expect(byPath.has('/opt/:slug?')).toBe(true);
    // The [[foo]] index child collapses onto its parent's '/:foo?' URL.
    expect(byPath.get('/:foo?')?.bundle).toBe('foo.lynx.bundle');

    // Whole-segment params match at runtime:
    expect(matchSparklingRoute(manifest, '/hello')?.route.name).toBe('slug');
    // /opt matches /opt/:slug? with the optional slug absent.
    expect(matchSparklingRoute(manifest, '/opt')?.route.name).toBe('opt-slug');
    expect(matchSparklingRoute(manifest, '/opt/x')?.params).toEqual({ slug: 'x' });
    expect(matchSparklingRoute(manifest, '/optional')?.route.name).toBe('optional-opt');

    // Mixed literal+param segments (prefix-:opt, route-:slug, :opt?-postfix)
    // are flagged as degraded for in-page matching.
    const mixed = diagnostics.filter((d) => d.kind === 'mixed-segment').map((d) => d.path).sort();
    expect(mixed).toContain('/optional/prefix-:opt?');
    expect(mixed).toContain('/optional/:opt?-postfix');
    expect(mixed).toContain('/:sub?/route-:slug()');
  });

  it('keeps required and optional variants of the same param distinct', () => {
    const { byPath } = build([
      { name: 'foo', path: '/:foo()', file: `${pagesDir}/[foo].vue`, children: [] },
      { name: 'foo', path: '/:foo?', file: `${pagesDir}/[[foo]].vue`, children: [] },
    ]);
    expect(byPath.has('/:foo()')).toBe(true);
    expect(byPath.has('/:foo?')).toBe(true);
  });

  it('supports regex-constrained and special-char param names', () => {
    const { manifest } = build([
      { name: 'a1_1a', path: '/:a1_1a()', file: `${pagesDir}/[a1_1a].vue`, children: [] },
      { name: 'c33c', path: '/:c33c?', file: `${pagesDir}/[[c3@3c]].vue`, children: [] },
    ]);
    expect(matchSparklingRoute(manifest, '/hello')?.route.name).toBe('a1_1a');
  });
});

describe('deeply nested routes collapse to one bundle per URL', () => {
  it('index child wins the parent URL; the layout wrapper is flagged', () => {
    const { byPath, diagnostics } = build([
      {
        path: '/page1',
        file: `${pagesDir}/page1.vue`,
        children: [
          { name: 'page1-id', path: ':id()', file: `${pagesDir}/page1/[id].vue`, children: [] },
          { name: 'page1', path: '', file: `${pagesDir}/page1/index.vue`, children: [] },
        ],
      },
    ]);
    // /page1 resolves to the index child's bundle, not the wrapper's.
    expect(byPath.get('/page1')?.bundle).toBe('page1.lynx.bundle');
    expect(byPath.get('/page1/:id()')?.bundle).toBe('page1-id.lynx.bundle');
    expect(diagnostics.some((d) => d.kind === 'nested-outlet' && d.path === '/page1')).toBe(true);
  });

  it('handles multi-level nested merges (param.vue + index/index + siblings)', () => {
    const { byPath } = build([
      {
        path: '/param',
        file: `${pagesDir}/param.vue`,
        children: [
          {
            path: '',
            file: `${layerDir}/param/index.vue`,
            children: [
              { name: 'param-index', path: '', file: `${pagesDir}/param/index/index.vue`, children: [] },
              { name: 'param-index-sibling', path: 'sibling', file: `${layerDir}/param/index/sibling.vue`, children: [] },
            ],
          },
          { name: 'param-sibling', path: 'sibling', file: `${pagesDir}/param/sibling.vue`, children: [] },
        ],
      },
    ]);
    expect(byPath.get('/param')?.bundle).toBe('param-index.lynx.bundle');
    expect(byPath.has('/param/sibling')).toBe(true);
  });
});

describe('route groups (URL-transparent)', () => {
  it('drops the parenthesized folder from the URL and carries groups meta', () => {
    const { byPath } = build([
      { name: 'index', path: '/', file: `${pagesDir}/(foo)/index.vue`, meta: { groups: ['foo'] }, children: [] },
      {
        path: '/about',
        file: `${pagesDir}/(foo)/about.vue`,
        meta: { groups: ['foo'] },
        children: [
          {
            path: '',
            file: `${pagesDir}/(bar)/about/index.vue`,
            meta: { groups: ['bar'] },
            children: [
              { name: 'about', path: '', file: `${pagesDir}/(bar)/about/(foo)/index.vue`, meta: { groups: ['bar', 'foo'] }, children: [] },
            ],
          },
        ],
      },
    ]);
    expect(byPath.has('/')).toBe(true);
    expect(byPath.has('/about')).toBe(true);
    // deepest index child wins /about and carries merged groups
    expect(byPath.get('/about')?.meta?.groups).toEqual(['bar', 'foo']);
  });
});

describe('unicode and special characters', () => {
  it('preserves Nuxt-encoded unicode paths and matches them', () => {
    const enc = encodeURIComponent('测试');
    const { byPath, manifest } = build([
      { name: '测试', path: `/${enc}`, file: `${pagesDir}/测试.vue`, children: [] },
    ]);
    expect(byPath.has(`/${enc}`)).toBe(true);
    expect(matchSparklingRoute(manifest, `/${enc}`)?.route.name).toBe('测试');
  });
});

describe('redirects', () => {
  it('encodes a static redirect in meta and flags it', () => {
    const { byPath, diagnostics } = build([
      { name: 'home', path: '/old', file: `${pagesDir}/old.vue`, redirect: '/new', children: [] },
    ]);
    expect(byPath.get('/old')?.meta?.redirect).toBe('/new');
    expect(diagnostics.some((d) => d.kind === 'redirect' && d.path === '/old')).toBe(true);
  });
});
