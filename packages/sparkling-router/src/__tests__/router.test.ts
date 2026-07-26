import type {
  NativeStackProtocol,
  NavResult,
  StackChangedEvent,
  StackState,
} from 'sparkling-navigation';
import {
  createRootRoute,
  createRoute,
} from '@tanstack/react-router';
import { CompositeHistory } from '../composite-history';
import { GlobalStackMirror } from '../global-stack-mirror';
import {
  buildStackLocation,
  readInitialHref,
  resolveRoute,
  type RouteManifest,
} from '../manifest';
import { createSparklingRouter } from '../router';

const manifest: RouteManifest = {
  version: 'test',
  scheme: { base: 'hybrid://lynxview_page' },
  containers: [
    {
      bundle: 'home.lynx.bundle',
      presentation: 'push',
      routes: [{ path: '/' }],
    },
    {
      bundle: 'feed.lynx.bundle',
      presentation: 'push',
      routes: [{ path: '/feed' }, { path: '/feed/$postId' }],
      containerOptions: { hide_loading: '1' },
    },
    {
      bundle: 'settings.lynx.bundle',
      presentation: 'modal',
      routes: [{ path: '/settings' }],
    },
  ],
};

class FakeTransport implements NativeStackProtocol {
  state: StackState = {
    version: 1,
    entries: [{
      id: 'feed-entry',
      path: '/feed',
      search: {},
      bundle: 'feed.lynx.bundle',
      presentation: 'push',
    }],
  };

  listeners = new Set<(event: StackChangedEvent) => void>();
  pushes: unknown[] = [];
  replaces: unknown[] = [];
  pops = 0;
  syncs: unknown[] = [];

  async push(req: unknown): Promise<NavResult> {
    this.pushes.push(req);
    return { code: 1, msg: 'ok', entryId: 'new-entry' };
  }

  async pop(): Promise<NavResult> {
    this.pops += 1;
    return { code: 1, msg: 'ok' };
  }

  async popTo(): Promise<NavResult> {
    return { code: 1, msg: 'ok' };
  }

  async replace(req: unknown): Promise<NavResult> {
    this.replaces.push(req);
    return { code: 1, msg: 'ok' };
  }

  async reset(): Promise<NavResult> {
    return { code: 1, msg: 'ok' };
  }

  async getState(): Promise<StackState> {
    return this.state;
  }

  async prefetch(): Promise<NavResult> {
    return { code: 1, msg: 'ok' };
  }

  syncOwnLocation(req: unknown): void {
    this.syncs.push(req);
  }

  subscribe(listener: (event: StackChangedEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: StackChangedEvent): void {
    this.state = event.state;
    this.listeners.forEach((listener) => listener(event));
  }
}

describe('route manifest', () => {
  it('resolves static and parameterized routes to containers', () => {
    expect(resolveRoute(manifest, '/feed')).toEqual({
      container: manifest.containers[1],
      path: '/feed',
    });
    expect(resolveRoute(manifest, '/feed/42')?.container.bundle).toBe('feed.lynx.bundle');
    expect(resolveRoute(manifest, '/missing')).toBeNull();
  });

  it('builds a native-loadable scheme without losing typed search', () => {
    const target = buildStackLocation(manifest, '/feed/42', { sort: 'new' });
    const url = new URL(target.scheme!);

    expect(target.bundle).toBe('feed.lynx.bundle');
    expect(url.searchParams.get('__path')).toBe('/feed/42');
    expect(url.searchParams.get('sort')).toBe('new');
    expect(url.searchParams.get('hide_loading')).toBe('1');
  });

  it('falls back to the first owned route outside Lynx', () => {
    expect(readInitialHref(manifest, 'settings.lynx.bundle')).toBe('/settings');
  });
});

describe('GlobalStackMirror', () => {
  it('ignores out-of-order native snapshots', async () => {
    const transport = new FakeTransport();
    const mirror = new GlobalStackMirror(transport);
    await mirror.start();

    transport.emit({ state: { version: 3, entries: [] }, reason: 'reset' });
    transport.emit({ state: { version: 2, entries: transport.state.entries }, reason: 'push' });

    expect(mirror.state.version).toBe(3);
    mirror.destroy();
  });
});

describe('CompositeHistory', () => {
  function setup() {
    const transport = new FakeTransport();
    const mirror = new GlobalStackMirror(transport);
    const history = new CompositeHistory({
      manifest,
      containerBundle: 'feed.lynx.bundle',
      containerEntryId: 'feed-entry',
      initialHref: '/feed',
      transport,
      stackMirror: mirror,
    });
    return { history, mirror, transport };
  }

  it('keeps navigation in the same container in memory', () => {
    const { history, mirror, transport } = setup();
    history.push('/feed/42?sort=new');

    expect(history.location.href).toBe('/feed/42?sort=new');
    expect(transport.pushes).toHaveLength(0);
    expect(transport.syncs).toEqual([{ path: '/feed/42', search: { sort: 'new' } }]);
    history.destroy();
    mirror.destroy();
  });

  it('translates cross-container navigation into native commands', () => {
    const { history, mirror, transport } = setup();
    history.push('/settings');

    expect(transport.pushes).toHaveLength(1);
    expect(transport.pushes[0]).toMatchObject({
      path: '/settings',
      bundle: 'settings.lynx.bundle',
      presentation: 'modal',
    });
    history.destroy();
    mirror.destroy();
  });

  it('settles TanStack navigation after native owns a hard transition', async () => {
    const { history, mirror, transport } = setup();
    const subscriber = jest.fn();
    history.subscribe(subscriber);

    history.push('/settings');
    await Promise.resolve();
    await Promise.resolve();

    expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({
      location: expect.objectContaining({ href: '/feed' }),
      action: { type: 'PUSH' },
    }));
    history.destroy();
    mirror.destroy();
  });

  it('hands back to native only after memory history reaches its root', () => {
    const { history, mirror, transport } = setup();
    history.push('/feed/42');
    history.back();
    history.back();

    expect(transport.pops).toBe(1);
    history.destroy();
    mirror.destroy();
  });
});

describe('createSparklingRouter', () => {
  it('correlates returned values with the child entry ID', async () => {
    const transport = new FakeTransport();
    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    });
    const runtime = createSparklingRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      manifest,
      containerBundle: 'feed.lynx.bundle',
      initialHref: '/',
      transport,
    });

    const result = runtime.pushWithResult('/settings');
    await Promise.resolve();
    transport.emit({
      state: {
        version: 2,
        entries: transport.state.entries,
      },
      reason: 'pop',
      result: {
        forEntryId: 'feed-entry',
        fromEntryId: 'new-entry',
        value: { saved: true },
      },
    });

    await expect(result).resolves.toEqual({ saved: true });
    runtime.destroy();
  });
});
