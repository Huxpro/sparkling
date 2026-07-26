// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import pipe from 'sparkling-method';
import type { StackSyncOwnLocationRequest } from './types';

/**
 * Fire-and-forget write-back of this container's soft-nav location.
 * Native uses it to keep the stack mirror consistent with deep routes.
 */
export function syncOwnLocation(req: StackSyncOwnLocationRequest): void {
  if (!req || typeof req.path !== 'string' || !req.path.trim()) {
    return
  }
  pipe.call(
    'router.stack.syncOwnLocation',
    {
      path: req.path.trim(),
      search: req.search ?? {},
    },
    () => {
      // intentionally ignore — sync is best-effort
    },
  )
}
