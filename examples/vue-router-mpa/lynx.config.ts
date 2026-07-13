// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginRouteManifest } from 'sparkling-history/codegen'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const exampleName = path.basename(__dirname)
const pagesDir = path.join(__dirname, 'src/pages')

export default defineConfig({
  // Build both a Lynx bundle (`*.lynx.bundle`, on-device / QR preview) and a
  // web bundle (`*.web.bundle`, consumed by @lynx-js/web-core in the website's
  // live <Go> preview).
  environments: {
    lynx: {},
    web: {},
  },
  // One entry per page bundle. Each becomes its own Lynx container / JS heap
  // at runtime; each `src/pages/<name>/routes.json` declares which routes that
  // bundle owns (see the generated route manifest below).
  source: {
    entry: {
      main: './src/pages/main/index.ts',
      users: './src/pages/users/index.ts',
      settings: './src/pages/settings/index.ts',
    },
  },
  output: {
    // The website serves each example's `dist/` under this public path.
    assetPrefix: `https://tiktok.github.io/sparkling/examples/${exampleName}/dist/`,
  },
  plugins: [
    pluginQRCode(),
    pluginVueLynx({
      optionsApi: false,
      enableCSSSelector: true,
    }),
    // Generates src/generated/route-manifest.ts from src/pages/*/routes.json —
    // the shared route table every page bundle embeds so isolated heaps agree
    // on which page owns which route (see sparkling-history).
    pluginRouteManifest({
      pagesDir,
      outFile: path.join(__dirname, 'src/generated/route-manifest.ts'),
    }),
  ],
})
