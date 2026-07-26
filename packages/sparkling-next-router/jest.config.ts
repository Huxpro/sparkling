// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  // The shim ships ESM in dist; map to source so ts-jest transforms it under Jest's CJS runtime.
  moduleNameMapper: {
    '^sparkling-history-shim/sparkling-host$': '<rootDir>/../sparkling-history-shim/src/hosts/sparkling.ts',
    '^sparkling-history-shim$': '<rootDir>/../sparkling-history-shim/index.ts',
  },
  verbose: false,
};

export default config;
