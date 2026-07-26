// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Codegen boundary semantics: AST marker extraction, `-container` directory
// boundaries, and the R3 containment check (a route nested under another
// page's prefix without its own marker fails the build).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { collectTanstackRoutes } from '../scripts/lib/collect-routes.mjs';
import {
  buildPages,
  extractExportedObjectLiteral,
} from '../scripts/lib/page-manifest.mjs';

const roots: string[] = [];
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'sparkling-routes-'));
  roots.push(root);
  for (const [file, src] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), src);
  }
  return root;
}
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

describe('AST marker extraction', () => {
  test('reads object literals, satisfies-wrapped and nested', () => {
    const v = extractExportedObjectLiteral(
      `export const page = { id: 'x', presentation: 'modal', containerParams: { title: 'T' } } satisfies Record<string, unknown>;`,
      'page',
      'x.tsx',
    );
    expect(v).toEqual({ id: 'x', presentation: 'modal', containerParams: { title: 'T' } });
  });

  test('fails loud on a re-exported marker', () => {
    expect(() =>
      extractExportedObjectLiteral(`const page = { id: 'x' };\nexport { page };`, 'page', 'x.tsx'),
    ).toThrow(/re-exports/);
  });

  test('fails loud on a dynamic marker', () => {
    expect(() =>
      extractExportedObjectLiteral(`export const page = { id: getId() };`, 'page', 'x.tsx'),
    ).toThrow(/statically evaluable/);
  });
});

describe('-container directory boundaries', () => {
  test('routes inherit the nearest -container marker; in-file page wins', () => {
    const root = fixture({
      'index.tsx': `export const page = { id: 'home', root: true };\nexport const Route = 0 as never; // createFileRoute('/')`,
      'feed/-container.ts': `export const container = { id: 'feed', containerParams: { title: 'Feed' } };`,
      'feed/index.tsx': `import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/feed')({});`,
      'feed/$postId.tsx': `import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/feed/$postId')({});`,
      'feed/compose.tsx': `import { createFileRoute } from '@tanstack/react-router';\nexport const page = { id: 'compose', presentation: 'modal' };\nexport const Route = createFileRoute('/feed/compose')({});`,
    });
    const routes = collectTanstackRoutes(root);
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r.page?.id]));
    expect(byPath['/feed']).toBe('feed');
    expect(byPath['/feed/$postId']).toBe('feed');
    expect(byPath['/feed/compose']).toBe('compose'); // in-file override
    const pages = buildPages(routes);
    const feed = pages.find((p) => p.id === 'feed')!;
    expect(feed.containerParams).toEqual({ title: 'Feed' });
    expect(feed.defaultHref).toBe('/feed');
  });

  test('layout route files are rejected (pruning scope guard)', () => {
    const root = fixture({
      '_layout.tsx': `export const Route = 0 as never;`,
    });
    expect(() => collectTanstackRoutes(root)).toThrow(/layout route/);
  });
});

describe('boundary containment (R3 static check)', () => {
  test('a route under another page prefix without its own marker fails the build', () => {
    const root = fixture({
      'index.tsx': `export const page = { id: 'home', root: true };\nimport { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({});`,
      'detail.$id.tsx': `export const page = { id: 'detail' };\nimport { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/detail/$id')({});`,
      'detail.reviews.tsx': `import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/detail/reviews')({});`,
    });
    expect(() => buildPages(collectTanstackRoutes(root))).toThrow(/wrong container/);
  });
});
