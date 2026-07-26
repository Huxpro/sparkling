// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { callStackMethod } from './call';
import type { NavResult, StackPopRequest } from './types';

export function pop(req?: StackPopRequest): Promise<NavResult> {
  return callStackMethod('router.stack.pop', {
    result: req?.result,
    animated: req?.animated ?? true,
  })
}
