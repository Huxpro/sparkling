// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // TanStack RouterCore.update touches `window` even with memory history
    // + isServer:false (upstream assumption). Lynx-for-Web provides window;
    // plain Node does not — use happy-dom to mirror the web host.
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: {
      json: './artifacts/unit-results.json',
    },
  },
})
