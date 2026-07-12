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
// It reuses the native config's entries, React/DOM shims, and pluginReactLynx
// by spreading it, but deliberately DROPS the TanStack Router generator plugin
// (`tools`) — see below.
import { defineConfig } from '@lynx-js/rspeedy'
import baseConfig from './lynx.config.js'

export default defineConfig({
  ...baseConfig,
  source: {
    ...baseConfig.source,
    // The website only surfaces `spike` and `home` (the entries that render
    // meaningfully standalone in the web preview). Building just these keeps
    // the website bundle set minimal.
    entry: {
      spike: './src/spike/index.tsx',
      home: './src/pages.gen/home/index.tsx',
    },
  },
  // Drop the base config's `tools.rspack` (the @tanstack/router-plugin
  // generator). This build is run on the website deploy (Vercel), where we want
  // the exact same lean pipeline the playground uses — plain rspeedy +
  // pluginReactLynx — with no extra build-time codegen. The generated
  // `src/routeTree.gen.ts` is committed, so the plugin's regeneration is not
  // needed here; the native `build`/`dev` scripts still run it.
  tools: {},
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
