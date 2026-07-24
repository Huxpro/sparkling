// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// The host event face: stack events, pop results, and the read-only stack
// mirror. The memory host specifies the protocol the native SDK will grow
// into; these tests are its executable contract.
import { describe, expect, test } from 'vitest';
import { createMemoryHost } from '../src/hosts/memory.js';
import { createMpaHistory } from '../src/create-mpa-history.js';
import { createStackMirror } from '../src/stack-mirror.js';
import type { StackChangedEvent } from '../src/types.js';

describe('memory host stack events', () => {
  test('open/close emit push/pop events with updated depth', () => {
    const host = createMemoryHost({ stackDepth: 1 });
    const seen: Array<StackChangedEvent> = [];
    host.subscribeStack!((e) => seen.push(e));

    void host.open({ href: '/detail', page: { id: 'detail' }, replace: false });
    void host.close();

    expect(seen.map((e) => e.reason)).toEqual(['push', 'pop']);
    expect(seen.map((e) => e.depth)).toEqual([2, 1]);
  });

  test('closePage carries a result back through the pop event', () => {
    const host = createMemoryHost({ stackDepth: 2 });
    const history = createMpaHistory({ host });
    const seen: Array<StackChangedEvent> = [];
    host.subscribeStack!((e) => seen.push(e));

    history.closePage({ result: { picked: 42 } });

    expect(host.closes[0]).toMatchObject({ result: { picked: 42 } });
    expect(seen[0]).toMatchObject({ reason: 'pop', depth: 1, result: { picked: 42 } });
  });

  test('closePage pops the container even when the local stack is deep', () => {
    const host = createMemoryHost();
    const history = createMpaHistory({ host });
    history.push('/a');
    history.push('/b'); // local in-page entries, no cross-page resolver

    history.closePage();

    expect(host.closes).toHaveLength(1);
  });

  test('closePage respects blockers', () => {
    const host = createMemoryHost();
    const history = createMpaHistory({ host });
    history.block({ blockerFn: () => true });

    history.closePage();

    // Blocked synchronously before reaching the host? Blockers are async;
    // flush microtasks.
    return Promise.resolve().then(() => {
      expect(host.closes).toHaveLength(0);
    });
  });

  test('container-initiated back is observable but not interceptable', () => {
    const host = createMemoryHost({ stackDepth: 1 });
    const seen: Array<StackChangedEvent> = [];
    host.subscribeStack!((e) => seen.push(e));

    host.simulateContainerBack('gesture-result');

    expect(seen[0]).toMatchObject({
      reason: 'container-back',
      depth: 0,
      result: 'gesture-result',
    });
  });
});

describe('createStackMirror', () => {
  test('mirrors depth and last result from host events', () => {
    const host = createMemoryHost({ stackDepth: 1 });
    const mirror = createStackMirror(host);
    expect(mirror.live).toBe(true);
    expect(mirror.getSnapshot().depth).toBe(1);

    let notified = 0;
    mirror.subscribe(() => notified++);
    void host.open({ href: '/x', page: { id: 'x' }, replace: false });
    void host.close({ result: 'r' });

    expect(notified).toBe(2);
    expect(mirror.getSnapshot()).toMatchObject({ depth: 1, lastResult: 'r' });
    mirror.destroy();
  });

  test('degrades to a static snapshot on command-only hosts', () => {
    const commandOnly = {
      getInitialHref: () => '/',
      getStackDepth: () => 3,
      open: () => {},
      close: () => {},
    };
    const mirror = createStackMirror(commandOnly);
    expect(mirror.live).toBe(false);
    expect(mirror.getSnapshot().depth).toBe(3);
  });
});
