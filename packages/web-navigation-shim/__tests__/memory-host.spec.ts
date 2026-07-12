// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';
import { MemoryDocumentStack } from '../src/hosts/memory';

const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('MemoryDocumentStack (MPA semantics reference)', () => {
  it('cross-document assign opens a new document with its own shim (isolated heap model)', () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    const first = stack.top;

    first.shim.location.assign('/detail');

    expect(stack.depth).toBe(2);
    expect(stack.top.url).toBe('https://app.local/detail');
    // The two documents own independent history stacks:
    expect(stack.top.shim).not.toBe(first.shim);
    expect(stack.top.shim.history.length).toBe(1);
    expect(first.shim.history.length).toBe(1);
  });

  it('history.back() on a fresh document pops the native stack and reveals the previous document intact', async () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    const first = stack.top;
    first.shim.history.pushState({ scroll: 120 }, '', '/?expanded=1');

    first.shim.location.assign('/detail');
    const second = stack.top;
    expect(second.url).toBe('https://app.local/detail');

    // Native back from the detail page:
    second.shim.history.back();
    expect(stack.depth).toBe(1);
    // Previous document's local state survived (it never tore down):
    expect(stack.top).toBe(first);
    expect(first.shim.location.search).toBe('?expanded=1');
    expect(first.shim.history.state).toEqual({ scroll: 120 });
    await microtask();
  });

  it('replace() swaps the top document instead of pushing', () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    stack.top.shim.location.assign('/a');
    expect(stack.depth).toBe(2);
    stack.top.shim.location.replace('/b');
    expect(stack.depth).toBe(2);
    expect(stack.top.url).toBe('https://app.local/b');
  });

  it('go(-n) crossing local stack bottom traverses multiple native documents', () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    stack.top.shim.location.assign('/a');
    stack.top.shim.location.assign('/b');
    expect(stack.depth).toBe(3);

    // From /b, go(-2) has no local entries to consume → native go(-2)
    stack.top.shim.history.go(-2);
    expect(stack.depth).toBe(1);
    expect(stack.top.url).toBe('https://app.local/');
  });

  it('mixed local + native traversal: local entries are consumed locally first', async () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    stack.top.shim.location.assign('/list');
    const list = stack.top;
    list.shim.history.pushState({}, '', '/list?page=2');

    // go(-1) stays within the document…
    list.shim.history.go(-1);
    await microtask();
    expect(stack.depth).toBe(2);
    expect(list.shim.location.pathname + list.shim.location.search).toBe('/list');

    // …and one more go(-1) crosses to the native stack.
    list.shim.history.go(-1);
    expect(stack.depth).toBe(1);
  });

  it('closing the last document is refused (root container stays)', () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    stack.top.shim.history.back();
    expect(stack.depth).toBe(1);
  });

  it('pagehide fires on the closed document', () => {
    const stack = new MemoryDocumentStack('https://app.local/');
    stack.top.shim.location.assign('/bye');
    const closing = stack.top;
    let hidden = false;
    closing.shim.window.addEventListener('pagehide', () => {
      hidden = true;
    });
    closing.shim.history.back();
    expect(hidden).toBe(true);
    expect(closing.shim.document.visibilityState).toBe('hidden');
  });
});
