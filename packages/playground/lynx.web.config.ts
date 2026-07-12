// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Build config used ONLY by the website (go-web), not by the native app.
//
// The native build (`lynx.config.ts` / `lynx.shared.config.ts`) emits Lynx
// bundles with `assetPrefix: 'asset:///'` and copies them into the Android/iOS
// asset dirs. That is not hostable over HTTP.
//
// For the website we instead emit:
//   - a `web` bundle (`*.web.bundle`) for the in-browser <Go> preview, and
//   - a `lynx` bundle (`*.lynx.bundle`) served over HTTP for QR / on-device
//     testing in Lynx Explorer (which now has Sparkling integrated).
//
// Both point `assetPrefix` at the deployed examples path so any chunked assets
// resolve from the website rather than from the native `asset://` scheme.
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import lynxSharedConfig from './lynx.shared.config.js'

export default defineConfig({
  ...lynxSharedConfig,
  environments: {
    lynx: {},
    web: {},
  },
  output: {
    assetPrefix:
      'https://tiktok.github.io/sparkling/examples/sparkling-go/dist/',
    // Write to a dedicated dir so the native build's `dist/` (asset:/// bundles
    // copied into Android/iOS) is never clobbered by the website's web build.
    distPath: { root: 'dist-web' },
  },
  // Drop the QR-code dev plugin (dev-server only); keep ReactLynx.
  plugins: [pluginReactLynx()],
})
