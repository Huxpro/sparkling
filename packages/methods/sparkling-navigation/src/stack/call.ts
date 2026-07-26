// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import pipe from 'sparkling-method';
import type { NavResult } from './types';

type PipeEnvelope = {
  code?: number
  msg?: string
  data?: unknown
  entryId?: string
}

/**
 * Invoke a stack bridge method and return the full NavResult envelope.
 * Unlike pipe.callAsync (which unwraps `.data` on success), stack methods
 * put `code` / `entryId` / `msg` at the top level of the callback payload.
 */
export function callStackMethod<TParams>(
  method: string,
  params: TParams,
): Promise<NavResult> {
  return new Promise((resolve) => {
    pipe.call(method, params ?? {}, (raw: unknown) => {
      const response = (raw ?? {}) as PipeEnvelope
      const code = typeof response.code === 'number' ? response.code : -1
      if (code === 1) {
        const entryId =
          response.entryId ??
          (response.data as { entryId?: string } | undefined)?.entryId ??
          ''
        resolve({
          code: 1,
          entryId,
          msg: response.msg ?? 'ok',
        })
        return
      }
      resolve({
        code,
        msg: response.msg ?? 'Unknown error',
        entryId: response.entryId,
      })
    })
  })
}

export function callStackMethodRaw<TParams, TResult>(
  method: string,
  params: TParams,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    pipe.call(method, params ?? {}, (raw: unknown) => {
      const response = (raw ?? {}) as PipeEnvelope
      const code = typeof response.code === 'number' ? response.code : -1
      if (code === 1) {
        resolve((response.data ?? response) as TResult)
        return
      }
      reject(new Error(response.msg ?? `Pipe call failed: ${method}`))
    })
  })
}
