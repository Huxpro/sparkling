// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Documents Link-related upstream assumptions that diverge on ReactLynx.
 * These are intentional "known gaps" probes — failures here are expected signals.
 */
import { describe, expect, test } from 'vitest'
import { createHeadlessRouter } from './helpers'

describe('upstream/react-router Link assumptions (known Lynx gaps)', () => {
  test('buildLocation resolves typed destinations (works without Link DOM)', async () => {
    const { router } = createHeadlessRouter('/')
    await router.load()
    const loc = router.buildLocation({
      to: '/posts/$postId',
      params: { postId: '7' },
      search: { tab: 'hot' },
    })
    expect(loc.pathname).toBe('/posts/7')
    expect(loc.search).toMatchObject({ tab: 'hot' })
  })

  test('PROBE: HTMLAnchorElement exists in happy-dom host, but ReactLynx Link still cannot rely on <a> navigation', () => {
    // Upstream Link renders <a>. ReactLynx has no reliable anchor navigation even when
    // the Lynx-for-Web host provides HTMLAnchorElement on the outer page.
    // Soft-nav demos must use useNavigate + bindtap (or a Lynx-safe Link wrapper).
    expect(typeof (globalThis as { HTMLAnchorElement?: unknown }).HTMLAnchorElement).toBe(
      'function',
    )
  })

  test('PROBE: IntersectionObserver present in happy-dom — Link viewport-preload may still no-op inside lynx-view', () => {
    // Records host capability. Inside Worker/lynx-view the observer may be absent or inert.
    expect(typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver).toBe(
      'function',
    )
  })
})

