import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // vue-router only needs @vue/runtime-core; the full `vue` build
      // touches document.createElement at import (no DOM in Lynx/Node).
      vue: '@vue/runtime-core',
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.spec.ts'],
    server: {
      deps: {
        // Inline these so vi.mock('sparkling-method') applies through the
        // prebuilt dist and vue-router picks up the `vue` alias.
        inline: ['vue-router', 'sparkling-navigation', 'sparkling-method', 'web-navigation-shim'],
      },
    },
  },
});
