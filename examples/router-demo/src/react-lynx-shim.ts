// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * ReactLynx compat + shims required by newer @tanstack/react-router builds
 * that touch `React.use` (React 19). Lynx compat does not export `use`;
 * provide an undefined placeholder so ESM linking succeeds (runtime path
 * guards with optional chaining / presence checks).
 */
export * from '@lynx-js/react/compat'
export { root } from '@lynx-js/react'

// React 19 API stub — TanStack Router only reads it when available.
export const use = undefined as unknown as typeof import('react').use

import * as Compat from '@lynx-js/react/compat'
export default Compat
