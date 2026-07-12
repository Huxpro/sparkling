// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginVueLynx } from 'vue-lynx/plugin'
import { pluginRouteManifest } from 'sparkling-history/codegen'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pagesDir = path.join(__dirname, 'src/pages')

// File-based convention: every directory under src/pages/ is a page bundle.
const entry = Object.fromEntries(
  fs
    .readdirSync(pagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => [dirent.name, `./src/pages/${dirent.name}/index.ts`]),
)

export default defineConfig({
  source: { entry },
  output: {
    filename: {
      bundle: '[name].lynx.bundle',
    },
  },
  environments: {
    web: {
      output: {
        assetPrefix: '/',
        distPath: {
          root: 'dist/web',
        },
      },
    },
    lynx: {
      output: {
        assetPrefix: 'asset:///',
      },
    },
  },
  plugins: [
    pluginVueLynx({
      optionsApi: false,
      enableCSSSelector: true,
    }),
    // Generates src/generated/route-manifest.ts from src/pages/*/routes.json —
    // the shared route table every page bundle embeds (see sparkling-history).
    pluginRouteManifest({
      pagesDir,
      outFile: path.join(__dirname, 'src/generated/route-manifest.ts'),
    }),
  ],
})
