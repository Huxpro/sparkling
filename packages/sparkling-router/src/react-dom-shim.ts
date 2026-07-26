// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * TanStack Link uses ReactDOM's flushSync for browser event ordering.
 * ReactLynx has no DOM renderer, so synchronous invocation is sufficient.
 */
export function flushSync<T>(callback: () => T): T {
    return callback();
}
