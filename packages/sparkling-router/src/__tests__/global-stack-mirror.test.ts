// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { GlobalStackMirror } from '../global-stack-mirror'

describe('GlobalStackMirror', () => {
  it('ignores stale versions and notifies listeners', () => {
    const mirror = new GlobalStackMirror()
    const listener = jest.fn()
    mirror.subscribe(listener)

    mirror.apply({
      state: {
        version: 2,
        entries: [
          {
            id: 'a',
            path: '/',
            search: {},
            bundle: 'home',
            presentation: 'push',
          },
        ],
      },
      reason: 'push',
    })
    expect(mirror.getState().version).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)

    mirror.apply({
      state: { version: 1, entries: [] },
      reason: 'pop',
    })
    expect(mirror.getState().version).toBe(2)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
