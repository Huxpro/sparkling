// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import pipe from 'sparkling-method';
import type { StackPrefetchRequest } from './types';

export function prefetch(
  req: StackPrefetchRequest,
): Promise<{ code: number; msg?: string }> {
  if (!req || typeof req.path !== 'string' || !req.path.trim()) {
    return Promise.resolve({ code: -1, msg: 'Invalid params: path must be a non-empty string' })
  }
  return new Promise((resolve) => {
    pipe.call(
      'router.stack.prefetch',
      {
        path: req.path.trim(),
        search: req.search ?? {},
      },
      (raw: unknown) => {
        const response = (raw ?? {}) as { code?: number; msg?: string }
        resolve({
          code: typeof response.code === 'number' ? response.code : -1,
          msg: response.msg,
        })
      },
    )
  })
}
