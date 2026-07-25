import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { compileRoutes } from '../src/index.js';

function write(root: string, file: string, source: string) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function createTanstackFixture() {
  const root = mkdtempSync(join(tmpdir(), 'sparkling-tanstack-'));
  write(root, '__root.tsx', 'export const Route = {}');
  write(
    root,
    'index.tsx',
    "import { createFileRoute } from '@tanstack/react-router';\n" +
      "export const container = { id: 'root' };\n" +
      "export const Route = createFileRoute('/')({});\n",
  );
  write(
    root,
    'feed/_container.tsx',
    "export const container = { id: 'feed', containerOptions: { title: 'Feed' } };\n",
  );
  write(
    root,
    'feed/index.tsx',
    "export const Route = createFileRoute('/feed')({});\n",
  );
  write(
    root,
    'feed/$postId.tsx',
    "export const Route = createFileRoute('/feed/$postId')({});\n",
  );
  write(
    root,
    'settings/_container.modal.tsx',
    "export const container = { id: 'settings', presentation: 'modal' };\n",
  );
  write(
    root,
    'settings/index.tsx',
    "export const Route = createFileRoute('/settings')({});\n",
  );
  return root;
}

function createNextFixture() {
  const root = mkdtempSync(join(tmpdir(), 'sparkling-next-'));
  write(root, 'container.ts', "export const container = { id: 'root' };\n");
  write(root, 'page.tsx', 'export default function Page() {}');
  write(
    root,
    'feed/container.ts',
    "export const container = { id: 'feed', containerOptions: { title: 'Feed' } };\n",
  );
  write(root, 'feed/page.tsx', 'export default function Page() {}');
  write(root, 'feed/[postId]/page.tsx', 'export default function Page() {}');
  write(
    root,
    'settings/container.ts',
    "export const container = { id: 'settings', presentation: 'modal' };\n",
  );
  write(root, 'settings/page.tsx', 'export default function Page() {}');
  return root;
}

describe('sparkling-router-plugin', () => {
  test('TanStack convention partitions _container subtrees', () => {
    const result = compileRoutes({
      convention: 'tanstack',
      routesDirectory: createTanstackFixture(),
      version: 'test',
    });
    expect(result.manifest.containers).toEqual([
      {
        id: 'feed',
        bundle: 'feed.lynx.bundle',
        presentation: 'push',
        routes: [{ path: '/feed' }, { path: '/feed/$postId' }],
        containerOptions: { title: 'Feed' },
      },
      {
        id: 'root',
        bundle: 'root.lynx.bundle',
        presentation: 'push',
        routes: [{ path: '/' }],
        containerOptions: undefined,
      },
      {
        id: 'settings',
        bundle: 'settings.lynx.bundle',
        presentation: 'modal',
        routes: [{ path: '/settings' }],
        containerOptions: undefined,
      },
    ]);
    expect(result.diagnostics[0]).toContain('@tanstack/router-generator');
  });

  test('Next app-dir frontend emits the same neutral manifest', () => {
    const tanstack = compileRoutes({
      convention: 'tanstack',
      routesDirectory: createTanstackFixture(),
      version: 'test',
    });
    const next = compileRoutes({
      convention: 'next',
      routesDirectory: createNextFixture(),
      version: 'test',
    });
    const normalizeDynamic = (value: unknown) =>
      JSON.parse(JSON.stringify(value).replaceAll(':postId', '$postId'));
    expect(normalizeDynamic(next.manifest)).toEqual(tanstack.manifest);
    expect(next.diagnostics[0]).toContain('same neutral manifest');
  });

  test('static configuration is parsed without evaluating route source', () => {
    const root = mkdtempSync(join(tmpdir(), 'sparkling-safe-'));
    write(
      root,
      'index.tsx',
      "throw new Error('must not execute');\n" +
        "export const container = { id: 'safe' };\n" +
        "export const Route = createFileRoute('/')({});\n",
    );
    const result = compileRoutes({ convention: 'tanstack', routesDirectory: root });
    expect(result.manifest.containers[0]?.id).toBe('safe');
  });
});
