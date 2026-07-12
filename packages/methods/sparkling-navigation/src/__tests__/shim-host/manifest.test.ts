/// <reference types="jest" />
// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  matchSparklingRoute,
  routeBundle,
  findRouteByBundle,
} from '../../shim-host/manifest';
import type { SparklingRouteManifest } from '../../shim-host/manifest';

const manifest: SparklingRouteManifest = {
  version: 1,
  base: '/',
  routes: [
    { name: 'index', path: '/', entry: 'index' },
    { name: 'about', path: '/about', entry: 'about' },
    { name: 'users-id', path: '/users/:id()', entry: 'users-id' },
    { name: 'users-id-posts', path: '/users/:id()/posts', entry: 'users-id-posts' },
    { name: 'blog-slug', path: '/blog/:slug(.*)*', entry: 'blog-slug' },
    { name: 'files', path: '/files/:path(.*)+', entry: 'files' },
    { name: 'optional', path: '/opt/:tag?', entry: 'optional' },
  ],
};

describe('matchSparklingRoute', () => {
  it('matches the index route', () => {
    expect(matchSparklingRoute(manifest, '/')?.route.name).toBe('index');
  });

  it('matches a static route', () => {
    expect(matchSparklingRoute(manifest, '/about')?.route.name).toBe('about');
  });

  it('matches a dynamic param and extracts it', () => {
    const m = matchSparklingRoute(manifest, '/users/42');
    expect(m?.route.name).toBe('users-id');
    expect(m?.params).toEqual({ id: '42' });
  });

  it('prefers a static segment over a dynamic one (specificity)', () => {
    const m = matchSparklingRoute(manifest, '/users/42/posts');
    expect(m?.route.name).toBe('users-id-posts');
    expect(m?.params).toEqual({ id: '42' });
  });

  it('matches a repeatable splat (zero or more)', () => {
    expect(matchSparklingRoute(manifest, '/blog')?.route.name).toBe('blog-slug');
    const deep = matchSparklingRoute(manifest, '/blog/2026/07/hello');
    expect(deep?.route.name).toBe('blog-slug');
    expect(deep?.params).toEqual({ slug: ['2026', '07', 'hello'] });
  });

  it('matches a required splat (one or more) but not the empty case', () => {
    expect(matchSparklingRoute(manifest, '/files')).toBeNull();
    const m = matchSparklingRoute(manifest, '/files/a/b');
    expect(m?.params).toEqual({ path: ['a', 'b'] });
  });

  it('matches an optional trailing param present or absent', () => {
    expect(matchSparklingRoute(manifest, '/opt')?.route.name).toBe('optional');
    const m = matchSparklingRoute(manifest, '/opt/news');
    expect(m?.params).toEqual({ tag: 'news' });
  });

  it('returns null for an unknown path', () => {
    expect(matchSparklingRoute(manifest, '/nope/here')).toBeNull();
  });

  it('matches a mid-path catch-all whose regex body contains a slash', () => {
    // Nuxt emits [...id]/suffix as `/:id([^/]*)*/suffix`. The slash inside
    // the custom regex must not be treated as a segment boundary.
    const mid: SparklingRouteManifest = {
      version: 1,
      base: '/',
      routes: [
        { name: 'id-suffix', path: '/:id([^/]*)*/suffix', entry: 'a' },
        { name: 'id-all', path: '/:id(.*)*', entry: 'b' },
      ],
    };
    const m = matchSparklingRoute(mid, '/x/y/suffix');
    expect(m?.route.name).toBe('id-suffix');
    expect(m?.params).toEqual({ id: ['x', 'y'] });
    // The plain catch-all still wins when there is no trailing /suffix.
    expect(matchSparklingRoute(mid, '/x/y')?.route.name).toBe('id-all');
  });

  it('respects a non-root base', () => {
    const based: SparklingRouteManifest = {
      version: 1,
      base: '/app',
      routes: [{ name: 'home', path: '/', entry: 'index' }, { name: 'x', path: '/x', entry: 'x' }],
    };
    expect(matchSparklingRoute(based, '/app')?.route.name).toBe('home');
    expect(matchSparklingRoute(based, '/app/x')?.route.name).toBe('x');
    expect(matchSparklingRoute(based, '/x')).toBeNull();
  });
});

describe('routeBundle / findRouteByBundle', () => {
  it('defaults the bundle name to <entry>.lynx.bundle', () => {
    expect(routeBundle({ path: '/', entry: 'index' })).toBe('index.lynx.bundle');
  });

  it('honors an explicit bundle name', () => {
    expect(routeBundle({ path: '/', entry: 'index', bundle: 'home.lynx.bundle' })).toBe('home.lynx.bundle');
  });

  it('finds a route by bundle, entry, or bare name', () => {
    expect(findRouteByBundle(manifest, 'about.lynx.bundle')?.name).toBe('about');
    expect(findRouteByBundle(manifest, 'about')?.name).toBe('about');
    expect(findRouteByBundle(manifest, '/users-id.lynx.bundle')?.name).toBe('users-id');
    expect(findRouteByBundle(manifest, 'missing')).toBeUndefined();
  });
});
