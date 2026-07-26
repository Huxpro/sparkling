// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callStackMethod } from './call';
import type { NavResult, StackPopToRequest } from './types';

export function popTo(req: StackPopToRequest): Promise<NavResult> {
  if (!req || typeof req.entryId !== 'string' || !req.entryId.trim()) {
    return Promise.resolve({ code: -1, msg: 'Invalid params: entryId must be a non-empty string' })
  }
  return callStackMethod('router.stack.popTo', {
    entryId: req.entryId.trim(),
    animated: req.animated ?? true,
  })
}
