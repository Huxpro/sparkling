/// <reference types="jest" />
// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { push } from '../../stack/push'
import { pop } from '../../stack/pop'
import { popTo } from '../../stack/popTo'
import { replace } from '../../stack/replace'
import { reset } from '../../stack/reset'
import { getState } from '../../stack/getState'
import { prefetch } from '../../stack/prefetch'
import { syncOwnLocation } from '../../stack/syncOwnLocation'
import { STACK_CHANGED_EVENT, subscribeStackChanged } from '../../stack/events'

jest.mock('sparkling-method', () => ({
  call: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}), { virtual: true })

describe('stack protocol JS API', () => {
  let pipe: { call: jest.Mock; on: jest.Mock; off: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    pipe = jest.requireMock('sparkling-method')
  })

  it('validates push path', async () => {
    const result = await push({ path: '' })
    expect(result.code).toBe(-1)
    expect(pipe.call).not.toHaveBeenCalled()
  })

  it('calls router.stack.push', async () => {
    pipe.call.mockImplementation((_m: string, _p: unknown, cb: (v: unknown) => void) => {
      cb({ code: 1, entryId: 'c1', msg: 'ok' })
    })
    const result = await push({ path: '/feed', search: { q: '1' } })
    expect(result).toEqual({ code: 1, entryId: 'c1', msg: 'ok' })
    expect(pipe.call).toHaveBeenCalledWith(
      'router.stack.push',
      expect.objectContaining({ path: '/feed', search: { q: '1' } }),
      expect.any(Function),
    )
  })

  it('calls pop / popTo / replace / reset', async () => {
    pipe.call.mockImplementation((_m: string, _p: unknown, cb: (v: unknown) => void) => {
      cb({ code: 1, entryId: 'x' })
    })
    await expect(pop({ result: { ok: true } })).resolves.toMatchObject({ code: 1 })
    await expect(popTo({ entryId: 'x' })).resolves.toMatchObject({ code: 1 })
    await expect(replace({ path: '/feed' })).resolves.toMatchObject({ code: 1 })
    await expect(reset({ entries: [{ path: '/', presentation: 'push' }] })).resolves.toMatchObject({
      code: 1,
    })
  })

  it('rejects empty popTo entryId', async () => {
    await expect(popTo({ entryId: '  ' })).resolves.toMatchObject({ code: -1 })
  })

  it('getState unwraps data payload', async () => {
    pipe.call.mockImplementation((_m: string, _p: unknown, cb: (v: unknown) => void) => {
      cb({
        code: 1,
        data: { version: 3, entries: [{ id: 'a', path: '/', search: {}, bundle: 'home', presentation: 'push' }] },
      })
    })
    const state = await getState()
    expect(state.version).toBe(3)
    expect(state.entries).toHaveLength(1)
  })

  it('prefetch and syncOwnLocation call bridge methods', async () => {
    pipe.call.mockImplementation((_m: string, _p: unknown, cb: (v: unknown) => void) => {
      cb({ code: 1, msg: 'ok' })
    })
    await expect(prefetch({ path: '/feed' })).resolves.toEqual({ code: 1, msg: 'ok' })
    syncOwnLocation({ path: '/feed/1', search: { x: '1' } })
    expect(pipe.call).toHaveBeenCalledWith(
      'router.stack.syncOwnLocation',
      { path: '/feed/1', search: { x: '1' } },
      expect.any(Function),
    )
  })

  it('subscribes to stack changed events', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeStackChanged(listener)
    expect(pipe.on).toHaveBeenCalledWith(STACK_CHANGED_EVENT, expect.any(Function))
    const wrapped = pipe.on.mock.calls[0][1] as (payload: unknown) => void
    wrapped({
      state: { version: 1, entries: [] },
      reason: 'user-back-gesture',
    })
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'user-back-gesture' }),
    )
    unsubscribe()
    expect(pipe.off).toHaveBeenCalled()
  })
})
