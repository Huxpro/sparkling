// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { UrlSearchParamsShim } from 'sparkling-history-shim';

/**
 * API-compatible with Next.js ReadonlyURLSearchParams: mutation methods throw.
 */
export class ReadonlyURLSearchParams extends UrlSearchParamsShim {
  override append(): never {
    throw readonlyError();
  }
  override delete(): never {
    throw readonlyError();
  }
  override set(): never {
    throw readonlyError();
  }
}

function readonlyError(): Error {
  return new Error('Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams');
}
