// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@rsbuild/core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const bundleDir = process.env.LYNX_BUNDLE_DIR || path.join(__dirname, '../dist')

export default defineConfig({
  source: {
    entry: {
      index: path.join(__dirname, 'index.ts'),
    },
  },
  html: {
    title: 'TanStack × Lynx Web Compat',
    template: path.join(__dirname, 'index.html'),
  },
  server: {
    port: 4310,
    publicDir: [
      {
        name: path.resolve(bundleDir),
        copyOnBuild: true,
      },
    ],
  },
  output: {
    distPath: {
      root: path.join(__dirname, '../harness-dist'),
    },
    assetPrefix: '/',
  },
})
