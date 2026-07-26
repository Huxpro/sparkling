import {
  getState,
  push,
  subscribeStackChanges,
  syncOwnLocation,
} from '../../stack/stack';

const mockCall = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();

jest.mock('sparkling-method', () => ({
  __esModule: true,
  default: {
    call: mockCall,
    on: mockOn,
    off: mockOff,
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('native stack protocol', () => {
  it('sends resolved hard-navigation metadata through one bridge method', async () => {
    mockCall.mockImplementation((_method, _params, callback) => {
      callback({ code: 1, msg: 'ok', data: { entryId: 'entry-2' } });
    });

    await expect(push({
      path: '/feed/42',
      search: { sort: 'new' },
      bundle: 'feed.lynx.bundle',
      scheme: 'hybrid://lynxview_page?bundle=feed.lynx.bundle',
    })).resolves.toEqual({
      code: 1,
      msg: 'ok',
      entryId: 'entry-2',
      state: undefined,
    });
    expect(mockCall).toHaveBeenCalledWith(
      'router.stack',
      expect.objectContaining({
        command: 'push',
        path: '/feed/42',
        bundle: 'feed.lynx.bundle',
      }),
      expect.any(Function),
    );
  });

  it('returns getState data and rejects failed snapshots', async () => {
    mockCall.mockImplementationOnce((_method, _params, callback) => {
      callback({
        code: 1,
        msg: 'ok',
        data: { state: { version: 2, entries: [] } },
      });
    });
    await expect(getState()).resolves.toEqual({ version: 2, entries: [] });

    mockCall.mockImplementationOnce((_method, _params, callback) => {
      callback({ code: 0, msg: 'not available' });
    });
    await expect(getState()).rejects.toThrow('not available');
  });

  it('normalizes native event envelopes and unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeStackChanges(listener);
    const nativeListener = mockOn.mock.calls[0][1];
    nativeListener([{
      code: 1,
      data: {
        state: { version: 3, entries: [] },
        reason: 'user-back-gesture',
      },
    }]);

    expect(listener).toHaveBeenCalledWith({
      state: { version: 3, entries: [] },
      reason: 'user-back-gesture',
    });
    unsubscribe();
    expect(mockOff).toHaveBeenCalledWith('router.stackchanged', nativeListener);
  });

  it('uses fire-and-forget semantics for own-location synchronization', () => {
    mockCall.mockImplementation((_method, _params, callback) => {
      callback({ code: 1, msg: 'ok' });
    });
    syncOwnLocation({ path: '/feed/42', search: {} });

    expect(mockCall).toHaveBeenCalledWith(
      'router.stack',
      { command: 'syncOwnLocation', path: '/feed/42', search: {} },
      expect.any(Function),
    );
  });
});
