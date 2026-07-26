// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  getRedirectTypeFromError,
  getURLFromRedirectError,
  isNotFoundError,
  isRedirectError,
  notFound,
  permanentRedirect,
  redirect,
  RedirectType,
} from '../errors';

function capture(fn: () => never): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected throw');
}

describe('redirect', () => {
  test('redirect throws a digest error recognized as redirect', () => {
    const e = capture(() => redirect('/login'));
    expect(isRedirectError(e)).toBe(true);
    expect(getURLFromRedirectError(e as never)).toBe('/login');
    expect(getRedirectTypeFromError(e as never)).toBe(RedirectType.replace);
  });

  test('redirect with push type', () => {
    const e = capture(() => redirect('/next', RedirectType.push));
    expect(getRedirectTypeFromError(e as never)).toBe(RedirectType.push);
  });

  test('permanentRedirect uses 308', () => {
    const e = capture(() => permanentRedirect('/moved')) as { digest: string };
    expect(isRedirectError(e)).toBe(true);
    expect(e.digest.endsWith('308;')).toBe(true);
  });

  test('digest wire format matches Next.js', () => {
    const e = capture(() => redirect('/x', RedirectType.push)) as { digest: string };
    expect(e.digest).toBe('NEXT_REDIRECT;push;/x;307;');
  });

  test('URLs containing semicolons round-trip', () => {
    const e = capture(() => redirect('/x;y;z'));
    expect(getURLFromRedirectError(e as never)).toBe('/x;y;z');
  });
});

describe('notFound', () => {
  test('notFound throws a recognized digest error', () => {
    const e = capture(() => notFound());
    expect(isNotFoundError(e)).toBe(true);
    expect(isRedirectError(e)).toBe(false);
  });
});

describe('negative cases', () => {
  test('plain errors are neither redirect nor notFound', () => {
    expect(isRedirectError(new Error('boom'))).toBe(false);
    expect(isNotFoundError(new Error('boom'))).toBe(false);
    expect(isRedirectError(null)).toBe(false);
    expect(isRedirectError({ digest: 'NEXT_REDIRECT;bad' })).toBe(false);
  });
});
