// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Ported from @tanstack/history createMemoryHistory.test.ts (upstream).
 * Validates the soft-nav history substrate Lynx / Sparkling rely on.
 */
import { describe, expect, test } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'

describe('upstream/@tanstack/history createMemoryHistory', () => {
  test('back', () => {
    const initialEntry = '/initial'
    const history = createMemoryHistory({ initialEntries: [initialEntry] })
    history.push('/a')
    history.push('/b')
    history.push('/c')
    history.back()
    expect(history.location.pathname).toBe('/b')
    history.back()
    expect(history.location.pathname).toBe('/a')
    history.back()
    expect(history.location.pathname).toBe(initialEntry)
    history.back()
    expect(history.location.pathname).toBe(initialEntry)
  })

  test('forward', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    history.push('/a')
    history.push('/b')
    history.push('/c')
    history.back()
    history.back()
    expect(history.location.pathname).toBe('/a')
    history.forward()
    expect(history.location.pathname).toBe('/b')
    history.forward()
    expect(history.location.pathname).toBe('/c')
    history.forward()
    expect(history.location.pathname).toBe('/c')
  })

  test('push and back #1916', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    history.push('/a')
    history.push('/b')
    history.push('/c')
    history.back()
    expect(history.location.pathname).toBe('/b')
    history.push('/d')
    expect(history.location.pathname).toBe('/d')
    history.back()
    expect(history.location.pathname).toBe('/b')
  })

  test('length', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    expect(history.length).toBe(1)
    history.push('/a')
    expect(history.length).toBe(2)
    history.replace('/b')
    expect(history.length).toBe(2)
  })

  test('state', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    history.push('/a', { i: 1 })
    expect((history.location.state as { i?: number }).i).toBe(1)
    history.replace('/b', { i: 2 })
    expect((history.location.state as { i?: number }).i).toBe(2)
  })

  test('canGoBack', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    expect(history.canGoBack()).toBe(false)
    history.push('/a')
    expect(history.canGoBack()).toBe(true)
  })
})
