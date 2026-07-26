// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  isPathOwnedBy,
  matchPathPattern,
  normalizePathname,
  resolveContainerForPath,
} from '../path-match'

describe('path-match', () => {
  it('normalizes pathnames', () => {
    expect(normalizePathname('feed')).toBe('/feed')
    expect(normalizePathname('/feed/')).toBe('/feed')
    expect(normalizePathname('')).toBe('/')
  })

  it('matches static and dynamic segments', () => {
    expect(matchPathPattern('/feed', '/feed')).toBe(true)
    expect(matchPathPattern('/feed/$postId', '/feed/42')).toBe(true)
    expect(matchPathPattern('/feed/$postId', '/feed')).toBe(false)
    expect(matchPathPattern('/user/$id', '/feed/1')).toBe(false)
  })

  it('resolves the longest matching container', () => {
    const containers = [
      { bundle: 'home', routes: [{ path: '/' }] },
      { bundle: 'feed', routes: [{ path: '/feed' }, { path: '/feed/$postId' }] },
      { bundle: 'user', routes: [{ path: '/user/$id' }] },
    ]
    expect(resolveContainerForPath('/feed/9', containers)?.bundle).toBe('feed')
    expect(resolveContainerForPath('/user/1', containers)?.bundle).toBe('user')
    expect(resolveContainerForPath('/missing', containers)).toBeUndefined()
    expect(isPathOwnedBy('/feed/1', ['/feed/$postId'])).toBe(true)
  })
})
