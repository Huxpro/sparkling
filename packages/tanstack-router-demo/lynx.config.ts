// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  source: {
    entry: {
      spike: './src/spike/index.tsx',
    },
  },
  resolve: {
    alias: {
      // Fill in React APIs missing from ReactLynx's `react` alias
      // (startTransition, use) that TanStack Router's dist links against.
      'react$': path.resolve(__dirname, 'src/shims/react.ts'),
      // TanStack Router's main entry imports { flushSync } from 'react-dom'.
      // ReactLynx has no react-dom; provide the minimal shim.
      'react-dom$': path.resolve(__dirname, 'src/shims/react-dom.ts'),
      // @tanstack/react-store pulls the uSES shim; Lynx ships its own build.
      'use-sync-external-store/shim/with-selector$':
        '@lynx-js/use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim$': '@lynx-js/use-sync-external-store/shim',
    },
  },
  output: {
    minify: false,
    assetPrefix: 'asset:///',
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
    lynx: {},
  },
  plugins: [pluginReactLynx()],
})
