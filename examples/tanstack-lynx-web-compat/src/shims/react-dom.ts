// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** Minimal react-dom shim — TanStack calls flushSync; Lynx has no react-dom. */
export function flushSync<T>(fn: () => T): T {
  return fn()
}

export default { flushSync }
