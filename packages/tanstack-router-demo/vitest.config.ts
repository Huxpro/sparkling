import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node, not jsdom: these tests double as proof that the router core +
    // history shim drive navigation with no DOM globals present.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
