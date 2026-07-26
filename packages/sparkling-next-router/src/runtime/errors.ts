// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Error digests follow Next.js wire formats exactly, so code (and libraries)
 * that inspect `error.digest` behave identically on Lynx.
 */

export const REDIRECT_DIGEST_PREFIX = 'NEXT_REDIRECT';
export const HTTP_FALLBACK_DIGEST_PREFIX = 'NEXT_HTTP_ERROR_FALLBACK';

export enum RedirectType {
  push = 'push',
  replace = 'replace',
}

export interface DigestError extends Error {
  digest: string;
}

export function redirect(url: string, type: RedirectType = RedirectType.replace): never {
  const error = new Error(REDIRECT_DIGEST_PREFIX) as DigestError;
  error.digest = `${REDIRECT_DIGEST_PREFIX};${type};${url};307;`;
  throw error;
}

export function permanentRedirect(url: string, type: RedirectType = RedirectType.replace): never {
  const error = new Error(REDIRECT_DIGEST_PREFIX) as DigestError;
  error.digest = `${REDIRECT_DIGEST_PREFIX};${type};${url};308;`;
  throw error;
}

export function notFound(): never {
  const error = new Error(`${HTTP_FALLBACK_DIGEST_PREFIX};404`) as DigestError;
  error.digest = `${HTTP_FALLBACK_DIGEST_PREFIX};404`;
  throw error;
}

export function isRedirectError(error: unknown): error is DigestError {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const digest = (error as DigestError).digest;
  if (typeof digest !== 'string') return false;
  const parts = digest.split(';');
  if (parts.length < 4) return false;
  const prefix = parts[0];
  const type = parts[1];
  const status = parts[parts.length - 2];
  return (
    prefix === REDIRECT_DIGEST_PREFIX &&
    (type === 'push' || type === 'replace') &&
    (status === '307' || status === '308')
  );
}

export function isNotFoundError(error: unknown): error is DigestError {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return false;
  const digest = (error as DigestError).digest;
  return typeof digest === 'string' && digest === `${HTTP_FALLBACK_DIGEST_PREFIX};404`;
}

export function getURLFromRedirectError(error: DigestError): string {
  // URL may itself contain ';' — same slicing as Next.js.
  return error.digest.split(';').slice(2, -2).join(';');
}

export function getRedirectTypeFromError(error: DigestError): RedirectType {
  return error.digest.split(';')[1] === 'push' ? RedirectType.push : RedirectType.replace;
}
