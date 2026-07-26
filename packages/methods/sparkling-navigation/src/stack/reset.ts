// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callStackMethod } from './call';
import type { NavResult, StackResetRequest } from './types';

export function reset(req: StackResetRequest): Promise<NavResult> {
  if (!req || !Array.isArray(req.entries)) {
    return Promise.resolve({ code: -1, msg: 'Invalid params: entries must be an array' })
  }
  return callStackMethod('router.stack.reset', {
    entries: req.entries,
  })
}
