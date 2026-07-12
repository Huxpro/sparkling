import { defineConfig } from '@rsbuild/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default bundle directory: the playground's web build output
// Override via LYNX_BUNDLE_DIR env variable for CLI integration
const bundleDir = process.env.LYNX_BUNDLE_DIR
  || path.join(__dirname, '../playground/dist/web');

// run:web passes PORT / BROWSER env variables (rsbuild does not read
// them on its own).
const port = Number.parseInt(process.env.PORT ?? '', 10);
const openBrowser = process.env.BROWSER !== 'none';

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
    port: Number.isFinite(port) ? port : 4200,
    open: openBrowser,
    publicDir: [
      {
        name: path.resolve(bundleDir),
      },
    ],
  },
  output: {
    assetPrefix: '/',
  },
});
