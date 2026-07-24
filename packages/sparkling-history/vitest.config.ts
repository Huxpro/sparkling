import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic — no DOM needed. This is deliberately a non-jsdom suite:
    // one of the shim's guarantees is that navigation blocking works with
    // no global `document`, which @tanstack/history cannot claim.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
