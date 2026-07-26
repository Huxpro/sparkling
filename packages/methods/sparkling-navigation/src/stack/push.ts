// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callStackMethod } from './call';
import type { NavResult, StackPushRequest } from './types';

export function push(req: StackPushRequest): Promise<NavResult> {
  if (!req || typeof req.path !== 'string' || !req.path.trim()) {
    return Promise.resolve({ code: -1, msg: 'Invalid params: path must be a non-empty string' })
  }
  return callStackMethod('router.stack.push', {
    path: req.path.trim(),
    search: req.search ?? {},
    presentation: req.presentation ?? 'push',
    usePrefetched: req.usePrefetched ?? false,
    animated: req.animated ?? true,
  })
}
