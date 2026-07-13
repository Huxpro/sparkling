// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Href parsing, ported from @tanstack/history (MIT) so locations produced by
// this package are bit-compatible with what TanStack Router expects.
import type { HistoryLocation, ParsedHistoryState } from './types.js';

/**
 * Sanitize a path to prevent open-redirect vulnerabilities: strips ASCII
 * control characters and collapses leading double slashes.
 */
export function sanitizePath(path: string): string {
  // eslint-disable-next-line no-control-regex
  let sanitized = path.replace(/[\u0000-\u001F\u007F]/g, '');
  if (sanitized.startsWith('//')) {
    sanitized = '/' + sanitized.replace(/^\/+/, '');
  }
  return sanitized;
}

export function createRandomKey(): string {
  return (Math.random() + 1).toString(36).substring(7);
}

export function assignKeyAndIndex(
  index: number,
  state: Record<string, unknown> | undefined,
): ParsedHistoryState {
  const key = createRandomKey();
  return {
    ...(state ?? {}),
    key, // TODO(upstream): remove in v2 — use __TSR_key instead
    __TSR_key: key,
    __TSR_index: index,
  } as ParsedHistoryState;
}

export function parseHref(
  href: string,
  state: ParsedHistoryState | undefined,
): HistoryLocation {
  const sanitizedHref = sanitizePath(href);
  const hashIndex = sanitizedHref.indexOf('#');
  const searchIndex = sanitizedHref.indexOf('?');

  const addedKey = createRandomKey();

  return {
    href: sanitizedHref,
    pathname: sanitizedHref.substring(
      0,
      hashIndex > 0
        ? searchIndex > 0
          ? Math.min(hashIndex, searchIndex)
          : hashIndex
        : searchIndex > 0
          ? searchIndex
          : sanitizedHref.length,
    ),
    hash: hashIndex > -1 ? sanitizedHref.substring(hashIndex) : '',
    search:
      searchIndex > -1
        ? sanitizedHref.slice(searchIndex, hashIndex === -1 ? undefined : hashIndex)
        : '',
    state: state || { __TSR_index: 0, key: addedKey, __TSR_key: addedKey },
  };
}
