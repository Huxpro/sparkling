import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mergeRsbuildConfig } from '@rsbuild/core';
import { generateSparklingRoutes } from '../generator';
import { pluginSparklingRouter } from '../plugin';
import { scanSparklingRoutes } from '../scanner';

let root: string;
let routesDirectory: string;

async function route(path: string, source: string): Promise<void> {
  const target = join(routesDirectory, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, source);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'sparkling-router-'));
  routesDirectory = join(root, 'src/routes');
  await mkdir(routesDirectory, { recursive: true });
  await route('__root.tsx', `
import { createRootRoute } from '@tanstack/react-router'
export const Route = createRootRoute()
`);
  await route('index.tsx', `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({ component: () => null })
`);
  await route('feed/_container.tsx', `
export default {
  presentation: 'push',
  containerOptions: { hide_loading: '1', "nav_bar": "dark" },
}
`);
  await route('feed/index.tsx', `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/feed/')({ component: () => null })
`);
  await route('feed/$postId.tsx', `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/feed/$postId')({ component: () => null })
`);
  await route('settings/_container.modal.tsx', `export default { presentation: 'modal' }`);
  await route('settings/index.tsx', `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/settings/')({ component: () => null })
`);
  await route('settings/-utils.ts', `export const helper = true`);
  await route('settings/view.test.tsx', `throw new Error('not a route')`);
  await route('user.$id.tsx', `
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/user/$id')({ component: () => null })
`);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('scanSparklingRoutes', () => {
  it('partitions marked subtrees and unmarked top-level files', async () => {
    const result = await scanSparklingRoutes(routesDirectory);

    expect(result.containers.map((container) => container.bundle)).toEqual([
      'feed.lynx.bundle',
      'index.lynx.bundle',
      'settings.lynx.bundle',
      'user-param-id.lynx.bundle',
    ]);
    expect(result.containers[0]).toMatchObject({
      presentation: 'push',
      containerOptions: { hide_loading: '1', nav_bar: 'dark' },
    });
    expect(result.containers[0].routes.map((item) => item.routePath)).toEqual([
      '/feed/$postId',
      '/feed',
    ]);
    expect(result.containers[2].presentation).toBe('modal');
    expect(result.containers[2].routes.map((item) => item.routePath)).toEqual([
      '/settings',
    ]);
  });
});

describe('generateSparklingRoutes', () => {
  it('uses TanStack generator to emit isolated trees, entries, and a manifest', async () => {
    const result = await generateSparklingRoutes(root);

    expect(Object.keys(result.entries)).toEqual(['feed', 'index', 'settings', 'user-param-id']);
    expect(result.manifest.containers[0].routes).toEqual([
      { path: '/feed' },
      { path: '/feed/$postId' },
    ]);

    const feedTree = await readFile(
      join(root, 'src/.sparkling-router/feed/routeTree.gen.ts'),
      'utf8',
    );
    expect(feedTree).toContain('feed/$postId');
    expect(feedTree).not.toContain('settings/index');

    const entry = await readFile(result.entries.feed, 'utf8');
    expect(entry).toContain("containerBundle: 'feed.lynx.bundle'");
    expect(entry).toContain('createSparklingRouter');
  });
});

describe('pluginSparklingRouter', () => {
  it('injects generated entries and the ReactLynx compat alias', async () => {
    const plugin = pluginSparklingRouter();
    let modify: ((
      config: Record<string, unknown>,
      utils: { mergeRsbuildConfig: typeof mergeRsbuildConfig },
    ) => Record<string, unknown> | void) | undefined;

    await plugin.setup({
      context: { rootPath: root },
      modifyRsbuildConfig(callback) {
        modify = callback as typeof modify;
      },
    } as never);

    const config: {
      source?: {
        entry?: Record<string, string>;
      };
      resolve?: { alias?: Record<string, string> };
    } = {};
    const modified = modify?.(
      config as Record<string, unknown>,
      { mergeRsbuildConfig },
    ) as typeof config | undefined;
    expect(modified?.source?.entry?.feed).toContain('entry.tsx');
    expect(modified?.resolve?.alias?.['react$']).toBe('@lynx-js/react/compat');
    expect(modified?.resolve?.alias?.['react-dom$']).toBe(
      'sparkling-router/react-dom-shim',
    );
  });
});
