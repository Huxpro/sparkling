// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const g = globalThis as Record<string, unknown>

if (typeof g.scrollTo !== 'function') {
  g.scrollTo = () => {}
}

if (typeof g.queueMicrotask !== 'function') {
  g.queueMicrotask = (cb: () => void) => {
    Promise.resolve().then(cb)
  }
}

export {}
