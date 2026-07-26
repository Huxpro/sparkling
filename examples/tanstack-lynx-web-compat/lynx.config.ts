// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  environments: {
    lynx: {},
    web: {},
  },
  source: {
    entry: {
      suite: './src/suite-app.tsx',
    },
  },
  resolve: {
    alias: {
      react$: path.resolve(root, 'src/react-lynx-shim.ts'),
      'react-dom$': path.resolve(root, 'src/shims/react-dom.ts'),
      // Critical: TanStack react-store subscriptions need Lynx's uSES build,
      // otherwise navigate() updates router.state but the UI never re-renders.
      'use-sync-external-store/shim/with-selector$':
        '@lynx-js/use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim$': '@lynx-js/use-sync-external-store/shim',
    },
  },
  output: {
    assetPrefix: '/',
    filename: {
      bundle: '[name].[platform].bundle',
    },
  },
  plugins: [pluginReactLynx()],
})
