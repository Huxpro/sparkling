// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// In-page (single-page) semantics of createMpaHistory. These are ported from
// @tanstack/history's createMemoryHistory tests to prove that, when every
// destination stays in-page (no page resolver), the shim behaves exactly like
// TanStack's memory history — the property that makes it a drop-in.
import { describe, expect, test, vi } from 'vitest';
import { createMpaHistory } from '../src/create-mpa-history.js';
import { createMemoryHost } from '../src/hosts/memory.js';

function memHistory(initialHref = '/') {
  // No resolvePage → all navigations stay in-page.
  return createMpaHistory({ host: createMemoryHost({ initialHref }) });
}

describe('createMpaHistory — in-page parity with memory history', () => {
  test('back', () => {
    const history = memHistory('/initial');
    history.push('/a');
    history.push('/b');
    history.push('/c');
    history.back();
    expect(history.location.pathname).toBe('/b');
    history.back();
    expect(history.location.pathname).toBe('/a');
    history.back();
    expect(history.location.pathname).toBe('/initial');
  });

  test('forward', () => {
    const history = memHistory();
    history.push('/a');
    history.push('/b');
    history.push('/c');
    history.back();
    history.back();
    expect(history.location.pathname).toBe('/a');
    history.forward();
    expect(history.location.pathname).toBe('/b');
    history.forward();
    expect(history.location.pathname).toBe('/c');
    history.forward();
    expect(history.location.pathname).toBe('/c');
  });

  test('push and back #1916', () => {
    const history = memHistory();
    history.push('/a');
    expect(history.location.pathname).toBe('/a');
    history.push('/b');
    history.push('/c');
    history.back();
    expect(history.location.pathname).toBe('/b');
    history.push('/d');
    expect(history.location.pathname).toBe('/d');
    history.back();
    expect(history.location.pathname).toBe('/b');
  });

  test('length', () => {
    const history = memHistory();
    expect(history.length).toBe(1);
    history.push('/a');
    expect(history.length).toBe(2);
    history.replace('/b');
    expect(history.length).toBe(2);
    history.push('/c');
    expect(history.length).toBe(3);
  });

  test('state carried on push/replace', () => {
    const history = memHistory();
    history.push('/a', { i: 1 });
    expect((history.location.state as { i?: number }).i).toBe(1);
    history.replace('/b', { i: 2 });
    expect((history.location.state as { i?: number }).i).toBe(2);
    history.push('/c', { i: 3 });
    expect((history.location.state as { i?: number }).i).toBe(3);
  });

  test('__TSR_index increments/decrements', () => {
    const history = memHistory();
    expect(history.location.state.__TSR_index).toBe(0);
    history.push('/a');
    expect(history.location.state.__TSR_index).toBe(1);
    history.push('/b');
    expect(history.location.state.__TSR_index).toBe(2);
    history.back();
    expect(history.location.state.__TSR_index).toBe(1);
  });

  test('subscribers are notified with action', () => {
    const history = memHistory();
    const sub = vi.fn();
    const unsub = history.subscribe(sub);
    history.push('/a');
    expect(sub).toHaveBeenCalledWith(
      expect.objectContaining({ action: { type: 'PUSH' } }),
    );
    unsub();
    history.push('/b');
    expect(sub).toHaveBeenCalledTimes(1);
  });

  test('block prevents navigation', async () => {
    const history = memHistory();
    const blockerFn = vi.fn(() => true);
    const unblock = history.block({ blockerFn, enableBeforeUnload: false });
    await history.push('/a');
    expect(history.location.pathname).toBe('/');
    expect(blockerFn).toHaveBeenCalled();
    unblock();
  });

  test('block allows navigation when blockerFn returns false', async () => {
    const history = memHistory();
    const blockerFn = vi.fn(() => false);
    const unblock = history.block({ blockerFn, enableBeforeUnload: false });
    await history.push('/a');
    expect(history.location.pathname).toBe('/a');
    expect(blockerFn).toHaveBeenCalled();
    unblock();
  });

  test('unblock removes blocker', async () => {
    const history = memHistory();
    const blockerFn = vi.fn(() => true);
    const unblock = history.block({ blockerFn, enableBeforeUnload: false });
    unblock();
    await history.push('/a');
    expect(history.location.pathname).toBe('/a');
    expect(blockerFn).not.toHaveBeenCalled();
  });

  test('ignoreBlocker bypasses blockers (unlike @tanstack/history, works with no document)', async () => {
    const history = memHistory();
    const blockerFn = vi.fn(() => true);
    history.block({ blockerFn, enableBeforeUnload: false });
    await history.push('/a', undefined, { ignoreBlocker: true });
    expect(history.location.pathname).toBe('/a');
    expect(blockerFn).not.toHaveBeenCalled();
  });
});
