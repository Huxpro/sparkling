// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { createNextAppRouter } from 'sparkling-next-router/build'

// Scan app/, generate per-route bundle entries + the route manifest.
const nextRouter = createNextAppRouter({
  appDir: './app',
  cwd: process.cwd(),
  baseScheme: 'hybrid://lynxview_page',
})

export default defineConfig({
  source: {
    entry: nextRouter.entry,
  },
  output: {
    filename: {
      bundle: '[name].lynx.bundle',
    },
  },
  environments: {
    web: {
      output: {
        assetPrefix: '/',
        distPath: { root: 'dist/web' },
      },
    },
    lynx: {
      output: {
        assetPrefix: 'asset:///',
      },
    },
  },
  tools: {
    rspack: {
      resolve: {
        // Let app code `import ... from 'next/navigation'` / 'next/link'
        // compile unmodified against the ReactLynx-compatible adapter.
        alias: nextRouter.alias,
      },
    },
  },
  plugins: [pluginReactLynx()],
})
