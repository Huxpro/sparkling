/// <reference types="jest" />
// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Unit tests for the browser (`/web`) router handlers. These run in the
 * node jest environment with a minimal hand-rolled `window`/`CustomEvent`
 * so the browser-only code path is exercised without jsdom.
 */

// The built sparkling-method dist is ESM, which the CommonJS jest runtime
// cannot import. Mock the registry with an in-test map (mirrors the real
// register/get contract) so the handler module can self-register here.
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
const getWebMethodHandler = (name: string): Handler | undefined => registry.get(name);

// Side-effect import self-registers the handlers. Registration does not
// touch `window`; the browser globals below are only needed when a handler
// is invoked, which always happens after beforeAll.
import '../../web';

interface CapturedEvent {
  type: string;
  detail?: unknown;
}

const pushState = jest.fn();
const back = jest.fn();
const dispatched: CapturedEvent[] = [];

beforeAll(() => {
  class FakeCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  (globalThis as Record<string, unknown>).CustomEvent = FakeCustomEvent;
  (globalThis as Record<string, unknown>).window = {
    history: { pushState, back },
    dispatchEvent: (event: CapturedEvent) => {
      dispatched.push(event);
      return true;
    },
  };
});

beforeEach(() => {
  pushState.mockClear();
  back.mockClear();
  dispatched.length = 0;
});

describe('router.open (web)', () => {
  const open = () => getWebMethodHandler('router.open')!;

  it('is registered', () => {
    expect(typeof open()).toBe('function');
  });

  it('fails when scheme is missing', () => {
    const cb = jest.fn();
    open()({ containerID: 'c', protocolVersion: '1.0.0', data: {} }, cb);
    expect(cb).toHaveBeenCalledWith({ code: 0, msg: 'scheme is required' });
    expect(pushState).not.toHaveBeenCalled();
  });

  it('pushes history and dispatches sparkling:navigate for a bundle scheme', () => {
    const cb = jest.fn();
    open()(
      { containerID: 'c', protocolVersion: '1.0.0', data: { scheme: 'hybrid://lynxview_page?bundle=about.lynx.bundle' } },
      cb,
    );
    expect(pushState).toHaveBeenCalledWith(
      { page: 'about', scheme: 'hybrid://lynxview_page?bundle=about.lynx.bundle' },
      '',
      '?page=about',
    );
    expect(dispatched[0]).toMatchObject({ type: 'sparkling:navigate', detail: { page: 'about' } });
    expect(cb).toHaveBeenCalledWith({ code: 1, msg: 'ok' });
  });

  it('extracts the page name from a dev-server url= param', () => {
    const cb = jest.fn();
    open()(
      { containerID: 'c', protocolVersion: '1.0.0', data: { scheme: 'hybrid://lynxview_page?url=' + encodeURIComponent('http://127.0.0.1:5969/second.lynx.bundle') } },
      cb,
    );
    expect(pushState).toHaveBeenCalledWith(expect.objectContaining({ page: 'second' }), '', '?page=second');
    expect(cb).toHaveBeenCalledWith({ code: 1, msg: 'ok' });
  });

  it('fails when neither bundle nor url is present', () => {
    const cb = jest.fn();
    open()({ containerID: 'c', protocolVersion: '1.0.0', data: { scheme: 'hybrid://lynxview_page?foo=bar' } }, cb);
    expect(cb).toHaveBeenCalledWith({ code: 0, msg: 'No bundle or url param in scheme' });
  });

  it('fails gracefully on an unparseable scheme', () => {
    const cb = jest.fn();
    open()({ containerID: 'c', protocolVersion: '1.0.0', data: { scheme: 'not a url' } }, cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ code: 0 }));
    expect((cb.mock.calls[0][0] as { msg: string }).msg).toContain('Failed to parse scheme');
  });
});

describe('router.close (web)', () => {
  it('calls history.back and reports ok', () => {
    const cb = jest.fn();
    getWebMethodHandler('router.close')!({ containerID: 'c', protocolVersion: '1.0.0', data: null }, cb);
    expect(back).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ code: 1, msg: 'ok' });
  });
});
