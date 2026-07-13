// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * In-container history behavior.
 *
 * Ported from vue-router's official memory-history suite
 * (vuejs/router `packages/router/__tests__/history/memory.spec.ts`) —
 * within a container, HybridHistory must behave exactly like vue-router's
 * `createMemoryHistory`. Cases that cross the container boundary (where the
 * two histories intentionally diverge) are covered in `cross-container.spec.ts`.
 */

import { describe, expect, it, vi } from 'vitest'
import { createHybridHistory } from '../history'
import { createSparklingSchemeCodec, ROUTE_PARAM } from '../codec'
import { defineRouteManifest } from '../manifest'
import { createMemoryNavigationEnvironment } from '../hosts/memory'
import type { HistoryLocation, HybridRouterHistory } from '../types'

const loc: HistoryLocation = '/foo'
const loc2: HistoryLocation = '/bar'

const manifest = defineRouteManifest({
  pages: [
    { bundle: 'main', routes: ['/', '/foo', '/bar', '/somewhere', '/other', '/1', '/2', '/3', '/4', '/5'] },
  ],
})
const codec = createSparklingSchemeCodec(manifest)

/** START equivalent: a hybrid history starts at its container's route. */
const START: HistoryLocation = '/'

function createHistory(base?: string): HybridRouterHistory {
  const env = createMemoryNavigationEnvironment()
  const container = env.open(codec.encode(START, { depth: 0 })!)
  return createHybridHistory({ host: container.host, codec, base })
}

describe('Hybrid history (in-container, ported from memory history)', () => {
  it('starts at the container route', () => {
    const history = createHistory()
    expect(history.location).toEqual(START)
  })

  it('can push a location', () => {
    const history = createHistory()
    history.push('/somewhere?foo=foo#hey')
    expect(history.location).toEqual('/somewhere?foo=foo#hey')
  })

  it('can replace a location', () => {
    const history = createHistory()
    history.replace('/somewhere?foo=foo#hey')
    expect(history.location).toEqual('/somewhere?foo=foo#hey')
  })

  it('does not trigger listeners with push', () => {
    const history = createHistory()
    const spy = vi.fn()
    history.listen(spy)
    history.push(loc)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not trigger listeners with replace', () => {
    const history = createHistory()
    const spy = vi.fn()
    history.listen(spy)
    history.replace(loc)
    expect(spy).not.toHaveBeenCalled()
  })

  it('can go back', () => {
    const history = createHistory()
    history.push(loc)
    history.push(loc2)
    history.go(-1)
    expect(history.location).toEqual(loc)
    history.go(-1)
    expect(history.location).toEqual(START)
  })

  it('stores a state', () => {
    const history = createHistory()
    history.push(loc, { foo: 'bar' })
    expect(history.state).toEqual({ foo: 'bar' })
    history.push(loc, { foo: 'baz' })
    expect(history.state).toEqual({ foo: 'baz' })
    history.go(-1)
    expect(history.state).toEqual({ foo: 'bar' })
  })

  it('does nothing with forward if at end of log', () => {
    const history = createHistory()
    history.go(1)
    expect(history.location).toEqual(START)
  })

  it('can moves back and forth in history queue', () => {
    const history = createHistory()
    history.push(loc)
    history.push(loc2)
    history.go(-1)
    history.go(-1)
    expect(history.location).toEqual(START)
    history.go(1)
    expect(history.location).toEqual(loc)
    history.go(1)
    expect(history.location).toEqual(loc2)
  })

  it('can push in the middle of the history', () => {
    const history = createHistory()
    history.push(loc)
    history.push(loc2)
    history.go(-1)
    history.go(-1)
    expect(history.location).toEqual(START)
    history.push(loc2)
    expect(history.location).toEqual(loc2)
    // does nothing
    history.go(1)
    expect(history.location).toEqual(loc2)
  })

  it('can listen to navigations', () => {
    const history = createHistory()
    const spy = vi.fn()
    history.listen(spy)
    history.push(loc)
    history.go(-1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(START, loc, {
      direction: 'back',
      delta: -1,
      type: 'pop',
    })
    history.go(1)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith(loc, START, {
      direction: 'forward',
      delta: 1,
      type: 'pop',
    })
  })

  it('can stop listening to navigation', () => {
    const history = createHistory()
    const spy = vi.fn()
    const spy2 = vi.fn()
    // remove right away
    history.listen(spy)()
    const remove = history.listen(spy2)
    history.push(loc)
    history.go(-1)
    expect(spy).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)
    remove()
    history.go(1)
    expect(spy).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('removing the same listener is a noop', () => {
    const history = createHistory()
    const spy = vi.fn()
    const spy2 = vi.fn()
    const rem = history.listen(spy)
    const rem2 = history.listen(spy2)
    rem()
    rem()
    history.push(loc)
    history.go(-1)
    expect(spy).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)
    rem2()
    rem2()
    history.go(1)
    expect(spy).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('removes all listeners with destroy', () => {
    const history = createHistory()
    history.push('/other')
    const spy = vi.fn()
    history.listen(spy)
    history.destroy()
    history.push('/2')
    history.go(-1)
    expect(spy).not.toHaveBeenCalled()
  })

  it('can be reused after destroy', () => {
    const history = createHistory()
    history.push('/1')
    history.push('/2')
    history.push('/3')
    history.go(-1)

    expect(history.location).toBe('/2')
    history.destroy()
    history.go(-1)
    expect(history.location).toBe(START)
    history.push('/4')
    history.push('/5')
    expect(history.location).toBe('/5')
    history.go(-1)
    expect(history.location).toBe('/4')
  })

  it('can avoid listeners with back and forward', () => {
    const history = createHistory()
    const spy = vi.fn()
    history.listen(spy)
    history.push(loc)
    history.go(-1, false)
    expect(spy).not.toHaveBeenCalled()
    history.go(1, false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('handles a non-empty base', () => {
    expect(createHistory('/foo/').base).toBe('/foo')
    expect(createHistory('/foo').base).toBe('/foo')
  })

  // ── Intentional divergences from memory history ──────────────────────
  // In vue-router's memory history, going back past the start of the queue
  // clamps. A hybrid container instead pops the NATIVE stack: back on the
  // first entry closes the container, like the system back button.

  it('going back past the queue start closes the container', () => {
    const env = createMemoryNavigationEnvironment()
    const container = env.open(codec.encode(START, { depth: 0 })!)
    const history = createHybridHistory({ host: container.host, codec })
    expect(env.stack).toHaveLength(1)
    history.go(-1)
    expect(env.stack).toHaveLength(0)
  })

  it('restores initial state from the initial url', () => {
    const env = createMemoryNavigationEnvironment()
    const url = codec.encode('/foo', { depth: 2, state: { fromPrev: 1 } })!
    const container = env.open(url)
    const history = createHybridHistory({ host: container.host, codec })
    expect(history.location).toBe('/foo')
    expect(history.state).toEqual({ fromPrev: 1 })
    expect(history.depth).toBe(2)
  })

  it('createHref produces a scheme for owned routes', () => {
    const history = createHistory()
    const href = history.createHref('/foo')
    expect(href).toContain('bundle=main.lynx.bundle')
    expect(href).toContain(`${ROUTE_PARAM}=${encodeURIComponent('/foo')}`)
  })

  it('createHref falls back to base + path for unowned routes', () => {
    const history = createHistory('/base')
    expect(history.createHref('/not-in-manifest')).toBe('/base/not-in-manifest')
  })
})
