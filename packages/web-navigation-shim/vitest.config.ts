import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // vue-router only needs @vue/runtime-core APIs. The full `vue` build
      // (runtime-dom) touches `document.createElement` at import time,
      // which neither Node nor a Lynx JS context provides — the same
      // reason Lynx renderers build on runtime-core.
      vue: '@vue/runtime-core',
    },
  },
  test: {
    // Deliberately plain Node (no jsdom): the shim must be self-sufficient
    // in a non-browser JS context, which is exactly the Lynx situation.
    environment: 'node',
    include: ['__tests__/**/*.spec.ts'],
    server: {
      deps: {
        // Route vue-router through the Vite pipeline so the `vue` alias
        // above applies to its imports as well.
        inline: ['vue-router'],
      },
    },
  },
});
