import { defineConfig } from '@rsbuild/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default bundle directory: the playground's web build output
// Override via LYNX_BUNDLE_DIR env variable for CLI integration
const bundleDir = process.env.LYNX_BUNDLE_DIR
  || path.join(__dirname, '../playground/dist/web');

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  html: {
    title: 'Sparkling Web Preview',
    template: './src/index.html',
  },
  server: {
    port: 4200,
    publicDir: [
      {
        name: path.resolve(bundleDir),
        // Serve the example bundles in dev only. The static build must NOT
        // carry any example's bundles — when embedded it loads them at runtime
        // from `?base=<url>`, so one build serves every example.
        copyOnBuild: false,
      },
    ],
  },
  output: {
    // Relative asset paths ('auto') let the built shell be dropped under any
    // path (e.g. the docs site's /mpa-preview/) and embedded in an <iframe>,
    // independent of the deploy base. Dev keeps the root prefix for LYNX_BUNDLE_DIR.
    assetPrefix: process.env.WEBSHELL_ASSET_PREFIX || '/',
  },
});
