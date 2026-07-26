// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanAppDir } from '../scan';
import { generateRouteModules } from '../codegen';

let tmpRoot: string;

function write(rel: string, content = 'export default function C() { return null }\n'): void {
  const abs = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'next-router-scan-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('scanAppDir', () => {
  test('discovers pages, layouts, dynamic + catch-all, and strips route groups', () => {
    write('app/layout.tsx');
    write('app/page.tsx');
    write('app/about/page.tsx');
    write('app/(marketing)/pricing/page.tsx');
    write('app/products/[id]/page.tsx');
    write('app/products/[id]/layout.tsx');
    write('app/docs/[...slug]/page.tsx');

    const { routes } = scanAppDir(path.join(tmpRoot, 'app'));
    const patterns = routes.map((r) => r.pattern).sort();
    expect(patterns).toEqual(['/', '/about', '/docs/[...slug]', '/pricing', '/products/[id]']);

    const products = routes.find((r) => r.pattern === '/products/[id]')!;
    expect(products.layoutFiles).toHaveLength(2); // root + nested
  });

  test('reports unsupported conventions as skipped', () => {
    write('app/page.tsx');
    write('app/api/route.ts');
    write('app/@modal/page.tsx');
    const { skipped } = scanAppDir(path.join(tmpRoot, 'app'));
    expect(skipped.some((s) => s.includes('route.*'))).toBe(true);
    expect(skipped.some((s) => s.includes('parallel route'))).toBe(true);
  });

  test('finds nearest not-found and loading', () => {
    write('app/page.tsx');
    write('app/not-found.tsx');
    write('app/products/[id]/page.tsx');
    write('app/products/loading.tsx');
    const { routes } = scanAppDir(path.join(tmpRoot, 'app'));
    const products = routes.find((r) => r.pattern === '/products/[id]')!;
    expect(products.notFoundFile).toContain('not-found');
    expect(products.loadingFile).toContain('loading');
  });
});

describe('generateRouteModules', () => {
  test('emits a manifest and one entry per route', () => {
    write('app/layout.tsx');
    write('app/page.tsx');
    write('app/products/[id]/page.tsx');
    const { routes } = scanAppDir(path.join(tmpRoot, 'app'));

    const result = generateRouteModules(tmpRoot, routes, { outDir: '.gen' });
    expect(Object.keys(result.entries).sort()).toEqual(['index', 'products___id_']);

    const manifest = fs.readFileSync(result.manifestFile, 'utf8');
    expect(manifest).toContain("pattern: \"/products/[id]\"");
    expect(manifest).toContain("kind: \"dynamic\"");

    const entry = fs.readFileSync(result.entries['products___id_'], 'utf8');
    expect(entry).toContain('SparklingNextRoot');
    expect(entry).toContain('root.render');
    expect(entry).toContain('route="/products/[id]"');
  });

  test('removes stale entries on regeneration', () => {
    write('app/page.tsx');
    write('app/old/page.tsx');
    let scan = scanAppDir(path.join(tmpRoot, 'app'));
    generateRouteModules(tmpRoot, scan.routes, { outDir: '.gen' });
    expect(fs.existsSync(path.join(tmpRoot, '.gen', 'old.entry.tsx'))).toBe(true);

    fs.rmSync(path.join(tmpRoot, 'app', 'old'), { recursive: true });
    scan = scanAppDir(path.join(tmpRoot, 'app'));
    generateRouteModules(tmpRoot, scan.routes, { outDir: '.gen' });
    expect(fs.existsSync(path.join(tmpRoot, '.gen', 'old.entry.tsx'))).toBe(false);
  });

  test('throws on bundle name collision', () => {
    // Two patterns flattening to the same bundle name would collide; force it
    // by creating a literal folder that matches another's flattened name.
    write('app/a/b/page.tsx');
    write('app/a__b/page.tsx');
    const { routes } = scanAppDir(path.join(tmpRoot, 'app'));
    expect(() => generateRouteModules(tmpRoot, routes, { outDir: '.gen' })).toThrow(/collision/);
  });
});
