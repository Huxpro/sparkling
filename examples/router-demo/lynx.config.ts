// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'
import { sparklingRouter } from 'sparkling-router-plugin/rspack'

const exampleName = path.basename(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  environments: {
    lynx: {},
    web: {},
  },
  source: {
    entry: {
      // S0: single soft-nav container entry (home + in-container feed soft routes).
      main: './src/entries/main.tsx',
    },
  },
  resolve: {
    alias: {
      // Shim adds React.use placeholder required by @tanstack/react-router ≥1.17x
      react$: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/react-lynx-shim.ts',
      ),
    },
  },
  output: {
    assetPrefix: `https://tiktok.github.io/sparkling/examples/${exampleName}/dist/`,
  },
  tools: {
    rspack: {
      plugins: [
        sparklingRouter({
          routesDirectory: 'src/routes',
          manifestOutput: 'src/route-manifest.gen.json',
          containersOutput: 'src/generated/containers',
        }),
        tanstackRouter({
          target: 'react',
          routesDirectory: './src/routes',
          generatedRouteTree: './src/routeTree.gen.ts',
          // Container markers are owned by sparkling-router-plugin, not TanStack.
          routeFileIgnorePattern: '_container',
        }),
      ],
    },
  },
  plugins: [pluginQRCode(), pluginReactLynx()],
})
