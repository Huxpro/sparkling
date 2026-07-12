/// <reference types="jest" />
// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The built sparkling-method dist is ESM, which the CommonJS jest runtime
// cannot import. Mock the registry with an in-test map.
type Handler = (params: unknown, cb: (r: unknown) => void) => void;
const registry = new Map<string, Handler>();
jest.mock(
  'sparkling-method/web-registry',
  () => ({
    registerWebMethod: (name: string, handler: Handler) => registry.set(name, handler),
    getWebMethodHandler: (name: string) => registry.get(name),
  }),
  { virtual: true },
);
const handler = (name: string): Handler => registry.get(name)!;

import '../../web';

let store: Map<string, string>;

beforeAll(() => {
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
});

beforeEach(() => {
  store = new Map();
});

function call(name: string, data: unknown): { code: number; msg: string; data?: unknown } {
  let result: { code: number; msg: string; data?: unknown } = { code: -99, msg: '' };
  handler(name)({ containerID: 'c', protocolVersion: '1.0.0', data }, (r) => {
    result = r as typeof result;
  });
  return result;
}

describe('storage.setItem / getItem / removeItem (web)', () => {
  it('setItem then getItem round-trips a string under the namespaced key', () => {
    expect(call('storage.setItem', { key: 'token', data: 'abc' })).toEqual({ code: 1, msg: 'ok' });
    expect(store.get('sparkling:token')).toBe('abc');
    expect(call('storage.getItem', { key: 'token' })).toEqual({ code: 1, msg: 'ok', data: 'abc' });
  });

  it('namespaces by biz when provided', () => {
    call('storage.setItem', { key: 'k', data: 'v', biz: 'profile' });
    expect(store.get('sparkling:profile:k')).toBe('v');
    expect(call('storage.getItem', { key: 'k', biz: 'profile' }).data).toBe('v');
  });

  it('JSON-stringifies non-string values on setItem', () => {
    call('storage.setItem', { key: 'obj', data: { a: 1 } });
    expect(store.get('sparkling:obj')).toBe('{"a":1}');
  });

  it('getItem returns null for a missing key', () => {
    expect(call('storage.getItem', { key: 'nope' })).toEqual({ code: 1, msg: 'ok', data: null });
  });

  it('removeItem deletes the namespaced key', () => {
    call('storage.setItem', { key: 'k', data: 'v' });
    expect(call('storage.removeItem', { key: 'k' })).toEqual({ code: 1, msg: 'ok' });
    expect(store.has('sparkling:k')).toBe(false);
  });

  it('each handler rejects a missing key', () => {
    for (const name of ['storage.getItem', 'storage.setItem', 'storage.removeItem']) {
      expect(call(name, {})).toEqual({ code: 0, msg: 'key is required' });
    }
  });

  it('reports localStorage errors as code 0', () => {
    const original = (globalThis as Record<string, unknown>).localStorage;
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('quota');
      },
    };
    expect(call('storage.getItem', { key: 'k' }).code).toBe(0);
    expect(call('storage.setItem', { key: 'k', data: 'v' }).code).toBe(0);
    expect(call('storage.removeItem', { key: 'k' }).code).toBe(0);
    (globalThis as Record<string, unknown>).localStorage = original;
  });
});
