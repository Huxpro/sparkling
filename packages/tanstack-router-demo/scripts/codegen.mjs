// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// One-shot codegen for the file-based MPA demo:
//   1. routeTree.gen.ts        — via the official @tanstack/router-generator
//   2. routes.manifest.ts + page entries — via our MPA extension (gen-mpa.mjs)
//
// The rspeedy build also regenerates (1) on the fly via the router-plugin, but
// (2) must exist before the build starts (lynx.config.ts imports the generated
// page-entries), and both must exist for `vitest` / `tsc`. Run this first.
import { Generator, getConfig } from '@tanstack/router-generator';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = process.cwd();

// 1. Official TanStack route-tree generator (standalone, no bundler).
const config = await getConfig({}, root);
await new Generator({ config, root }).run();

// 2. Our MPA manifest + per-page entries.
const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, 'gen-mpa.mjs')], { stdio: 'inherit', cwd: root });

console.log('codegen: routeTree.gen.ts + routes.manifest.ts + page entries written');
