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
jest.mock('sparkling-method', () => ({}), { virtual: true });
const handler = (name: string): Handler => registry.get(name)!;

import '../../web';

// --- fake DOM/network globals -------------------------------------------

interface FakeInput {
  type: string;
  accept: string;
  multiple: boolean;
  capture?: string;
  files: Array<{ name: string; size: number; type: string }> | null;
  onchange: (() => void) | null;
  _cancel: (() => void) | null;
  addEventListener(type: string, cb: () => void): void;
  click(): void;
}

let lastInput: FakeInput | null;
let clickBehavior: 'select' | 'cancel' | 'empty';
let selectedFiles: Array<{ name: string; size: number; type: string }>;
const anchorClicks: Array<{ href: string; download: string }> = [];

function makeInput(): FakeInput {
  const input: FakeInput = {
    type: '',
    accept: '',
    multiple: false,
    files: null,
    onchange: null,
    _cancel: null,
    addEventListener(type, cb) {
      if (type === 'cancel') this._cancel = cb;
    },
    click() {
      if (clickBehavior === 'cancel') {
        this._cancel?.();
      } else {
        this.files = clickBehavior === 'select' ? selectedFiles : [];
        this.onchange?.();
      }
    },
  };
  lastInput = input;
  return input;
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).document = {
    createElement: (tag: string) => {
      if (tag === 'input') return makeInput();
      // anchor for downloadFile
      return {
        href: '',
        download: '',
        click() {
          anchorClicks.push({ href: (this as { href: string }).href, download: (this as { download: string }).download });
        },
      };
    },
  };
  (globalThis as Record<string, unknown>).URL = Object.assign(URL, {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => undefined,
  });
});

beforeEach(() => {
  lastInput = null;
  clickBehavior = 'select';
  selectedFiles = [{ name: 'a.png', size: 10, type: 'image/png' }];
  anchorClicks.length = 0;
});

function call(name: string, data: unknown): Promise<{ code: number; msg: string; data?: unknown }> {
  return new Promise((resolve) => {
    handler(name)({ containerID: 'c', protocolVersion: '1.0.0', data }, (r) => resolve(r as { code: number; msg: string; data?: unknown }));
  });
}

describe('media.chooseMedia (web)', () => {
  it('builds the accept string from mediaTypes and returns file descriptors', async () => {
    const result = await call('media.chooseMedia', { mediaTypes: ['image'], maxCount: 1 });
    expect(lastInput?.accept).toBe('image/*');
    expect(result.code).toBe(1);
    expect(result.data).toEqual([
      { tempFilePath: 'blob:mock', size: 10, type: 'image/png', name: 'a.png' },
    ]);
  });

  it('accepts both image and video and honors multiple', async () => {
    selectedFiles = [
      { name: 'a.png', size: 1, type: 'image/png' },
      { name: 'b.mp4', size: 2, type: 'video/mp4' },
    ];
    const result = await call('media.chooseMedia', { mediaTypes: ['image', 'video'], maxCount: 2 });
    expect(lastInput?.accept).toBe('image/*,video/*');
    expect(lastInput?.multiple).toBe(true);
    expect((result.data as unknown[]).length).toBe(2);
  });

  it('sets capture for the camera source', async () => {
    await call('media.chooseMedia', { sourceType: 'camera', cameraType: 'front' });
    expect(lastInput?.capture).toBe('user');
  });

  it('reports cancellation', async () => {
    clickBehavior = 'cancel';
    expect(await call('media.chooseMedia', {})).toEqual({ code: 0, msg: 'User cancelled' });
  });

  it('reports no file selected', async () => {
    clickBehavior = 'empty';
    expect(await call('media.chooseMedia', {})).toEqual({ code: 0, msg: 'No file selected' });
  });
});

describe('media.downloadFile (web)', () => {
  it('requires a url', async () => {
    expect(await call('media.downloadFile', {})).toEqual({ code: 0, msg: 'url is required' });
  });

  it('downloads via an anchor click on success', async () => {
    (globalThis as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(),
    });
    const result = await call('media.downloadFile', { url: 'https://x/y', extension: 'png' });
    expect(result.code).toBe(1);
    expect(anchorClicks[0].download).toBe('download.png');
  });

  it('reports an HTTP error', async () => {
    (globalThis as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    expect((await call('media.downloadFile', { url: 'https://x/y' })).code).toBe(0);
  });
});

describe('media.uploadFile / uploadImage (web)', () => {
  it('requires a url', async () => {
    expect(await call('media.uploadFile', {})).toEqual({ code: 0, msg: 'url is required' });
    expect(await call('media.uploadImage', {})).toEqual({ code: 0, msg: 'url is required' });
  });

  it('POSTs form data and returns the JSON response', async () => {
    (globalThis as Record<string, unknown>).FormData = class {
      append() {}
    };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ blob: async () => new Blob() }) // fetch(filePath)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 7 }) }); // upload POST
    (globalThis as Record<string, unknown>).fetch = fetchMock;

    const result = await call('media.uploadFile', { url: 'https://up', filePath: 'blob:file', params: { album: 'x' } });
    expect(result).toEqual({ code: 1, msg: 'ok', data: { id: 7 } });
    expect((fetchMock.mock.calls[1][1] as { method: string }).method).toBe('POST');
  });

  it('reports an HTTP error from the upload', async () => {
    (globalThis as Record<string, unknown>).FormData = class {
      append() {}
    };
    (globalThis as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, blob: async () => new Blob() });
    expect((await call('media.uploadFile', { url: 'https://up' })).code).toBe(0);
  });
});

describe('media.saveDataURL (web)', () => {
  it('is explicitly unsupported', async () => {
    expect(await call('media.saveDataURL', { dataURL: 'data:...' })).toEqual({
      code: 0,
      msg: 'media.saveDataURL is not supported on web',
    });
  });
});
