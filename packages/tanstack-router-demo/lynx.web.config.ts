// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Build config used ONLY by the website (go-web), not by the native app.
// Mirrors packages/playground/lynx.web.config.ts:
//   - emits a `*.web.bundle` (in-browser <Go> preview) and a `*.lynx.bundle`
//     (served over HTTP for QR / on-device testing in Lynx Explorer),
//   - points `assetPrefix` at the deployed examples path so chunked assets
//     resolve from the website rather than the native `asset://` scheme,
//   - writes to `dist-web/` so the native `dist/` is never clobbered.
//
// It reuses the native config's entries, React/DOM shims, the TanStack Router
// generator plugin, and pluginReactLynx by spreading it.
import { defineConfig } from '@lynx-js/rspeedy'
import baseConfig from './lynx.config.js'

export default defineConfig({
  ...baseConfig,
  environments: {
    lynx: {},
    web: {},
  },
  output: {
    // NB: a fresh output (no `filename` override) so the web environment emits
    // `*.web.bundle` and the lynx environment `*.lynx.bundle`. Spreading the
    // native config's `filename: '[name].lynx.bundle'` would force both to
    // `.lynx.bundle` and they'd clobber each other.
    assetPrefix:
      'https://tiktok.github.io/sparkling/examples/tanstack-router/dist/',
    // Dedicated dir so the native build's `dist/` (asset:/// bundles) is safe.
    distPath: { root: 'dist-web' },
  },
})
