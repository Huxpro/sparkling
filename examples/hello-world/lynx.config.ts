// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

// Derive the example name from the directory so `assetPrefix` stays correct
// even if the example is renamed or copied.
const exampleName = path.basename(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  // Build both a Lynx bundle (`*.lynx.bundle`, for on-device / QR preview) and
  // a web bundle (`*.web.bundle`, consumed by @lynx-js/web-core in the website's
  // live web preview via <Go>).
  environments: {
    lynx: {},
    web: {},
  },
  source: {
    entry: {
      main: './src/index.tsx',
    },
  },
  output: {
    // The website serves each example's `dist/` under this public path, so the
    // web bundle must resolve its chunks/assets from there when deployed.
    assetPrefix: `https://tiktok.github.io/sparkling/examples/${exampleName}/dist/`,
  },
  plugins: [
    pluginQRCode(),
    pluginReactLynx(),
  ],
})
