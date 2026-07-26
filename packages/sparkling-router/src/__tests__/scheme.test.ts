// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { initialPathFromQueryItems, pathToScheme } from '../scheme'
import type { RouteManifest } from '../types'

const manifest: RouteManifest = {
  version: '1',
  scheme: { base: 'hybrid://lynxview_page' },
  containers: [
    {
      bundle: 'home.lynx.bundle',
      presentation: 'push',
      routes: [{ path: '/' }],
    },
    {
      bundle: 'feed.lynx.bundle',
      presentation: 'push',
      routes: [{ path: '/feed' }, { path: '/feed/$postId' }],
      containerOptions: { hide_nav_bar: '1' },
    },
  ],
}

describe('scheme', () => {
  it('translates path + search into a hybrid scheme', () => {
    const result = pathToScheme('/feed/7?tab=hot', manifest)
    expect(result).toBeDefined()
    expect(result!.container.bundle).toBe('feed.lynx.bundle')
    expect(result!.scheme).toContain('bundle=feed.lynx.bundle')
    expect(result!.scheme).toContain('__path=%2Ffeed%2F7')
    expect(result!.scheme).toContain('tab=hot')
    expect(result!.scheme).toContain('hide_nav_bar=1')
  })

  it('reads __path from queryItems', () => {
    expect(initialPathFromQueryItems({ __path: '/feed/1' })).toBe('/feed/1')
    expect(initialPathFromQueryItems({})).toBe('/')
  })
})
