// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Deterministic WHATWG-subset URL implementation.
 *
 * The shim always uses this implementation (rather than a host `URL`)
 * because engines disagree about non-special schemes: e.g. WHATWG says
 * `new URL('sparkling://app/x').origin === 'null'`, which would make every
 * in-app URL "cross-origin" to a synthetic `sparkling://app` origin. Here
 * `origin` is uniformly `protocol + '//' + host` whenever an authority is
 * present, for special and non-special schemes alike.
 *
 * Supported: absolute URLs with authority, relative resolution against a
 * base (path merge + dot-segment normalization), search params, hash.
 * Not supported (not needed by routers): userinfo, IPv6 literals,
 * punycode, file: URLs without authority.
 */

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function normalizePath(path: string): string {
  if (path === '') return '/';
  const isAbsolute = path.startsWith('/');
  const segments = path.split('/');
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') {
      out.pop();
    } else {
      out.push(segment);
    }
  }
  let result = (isAbsolute ? '/' : '') + out.join('/');
  if (result === '') result = '/';
  // Preserve a trailing slash (meaningful for relative resolution).
  if (path.length > 1 && path.endsWith('/') && !result.endsWith('/')) {
    result += '/';
  }
  return result;
}

export class UrlSearchParamsShim {
  private pairs: Array<[string, string]> = [];

  constructor(init?: string | Array<[string, string]> | Record<string, string>) {
    if (typeof init === 'string') {
      const query = init.startsWith('?') ? init.slice(1) : init;
      if (query.length > 0) {
        for (const piece of query.split('&')) {
          if (!piece) continue;
          const eq = piece.indexOf('=');
          const rawKey = eq === -1 ? piece : piece.slice(0, eq);
          const rawValue = eq === -1 ? '' : piece.slice(eq + 1);
          this.pairs.push([decodeComponent(rawKey), decodeComponent(rawValue)]);
        }
      }
    } else if (Array.isArray(init)) {
      for (const [k, v] of init) this.pairs.push([String(k), String(v)]);
    } else if (init && typeof init === 'object') {
      for (const k of Object.keys(init)) this.pairs.push([k, String(init[k])]);
    }
  }

  get size(): number {
    return this.pairs.length;
  }

  get(name: string): string | null {
    const found = this.pairs.find(([k]) => k === name);
    return found ? found[1] : null;
  }

  getAll(name: string): string[] {
    return this.pairs.filter(([k]) => k === name).map(([, v]) => v);
  }

  has(name: string): boolean {
    return this.pairs.some(([k]) => k === name);
  }

  set(name: string, value: string): void {
    const idx = this.pairs.findIndex(([k]) => k === name);
    if (idx === -1) {
      this.pairs.push([name, String(value)]);
    } else {
      this.pairs[idx] = [name, String(value)];
      this.pairs = this.pairs.filter(([k], i) => k !== name || i === idx);
    }
  }

  append(name: string, value: string): void {
    this.pairs.push([name, String(value)]);
  }

  delete(name: string): void {
    this.pairs = this.pairs.filter(([k]) => k !== name);
  }

  forEach(cb: (value: string, key: string, parent: UrlSearchParamsShim) => void): void {
    for (const [k, v] of [...this.pairs]) cb(v, k, this);
  }

  entries(): IterableIterator<[string, string]> {
    return this.pairs.map(([k, v]) => [k, v] as [string, string]).values();
  }

  keys(): IterableIterator<string> {
    return this.pairs.map(([k]) => k).values();
  }

  values(): IterableIterator<string> {
    return this.pairs.map(([, v]) => v).values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  toString(): string {
    return this.pairs
      .map(([k, v]) => `${encodeComponent(k)}=${encodeComponent(v)}`)
      .join('&');
  }
}

function decodeComponent(input: string): string {
  try {
    return decodeURIComponent(input.replace(/\+/g, ' '));
  } catch {
    return input;
  }
}

function encodeComponent(input: string): string {
  // encodeURIComponent, but keep query-safe characters readable and encode
  // spaces as %20 (native URL parsers do not understand '+').
  return encodeURIComponent(input).replace(/%2F/gi, '/').replace(/%3A/gi, ':');
}

export class UrlShim {
  protocol = '';
  host = '';
  pathname = '/';
  search = '';
  hash = '';

  constructor(url: string, base?: string | UrlShim) {
    const trimmed = String(url).trim();
    if (SCHEME_RE.test(trimmed)) {
      this.parseAbsolute(trimmed);
      return;
    }
    if (base === undefined) {
      throw new TypeError(`Invalid URL: '${url}' (relative URL without a base)`);
    }
    const b = typeof base === 'string' ? new UrlShim(base) : base;
    this.protocol = b.protocol;
    this.host = b.host;
    if (trimmed.startsWith('//')) {
      this.parseAbsolute(`${b.protocol}${trimmed}`);
    } else if (trimmed.startsWith('/')) {
      this.parsePathSearchHash(trimmed);
    } else if (trimmed.startsWith('?')) {
      this.pathname = b.pathname;
      const hashIdx = trimmed.indexOf('#');
      this.search = normalizeSearch(hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx));
      this.hash = hashIdx === -1 ? '' : trimmed.slice(hashIdx);
    } else if (trimmed.startsWith('#')) {
      this.pathname = b.pathname;
      this.search = b.search;
      this.hash = trimmed === '#' ? '' : trimmed;
    } else if (trimmed === '') {
      this.pathname = b.pathname;
      this.search = b.search;
    } else {
      // Relative path: merge against the base directory.
      const dir = b.pathname.slice(0, b.pathname.lastIndexOf('/') + 1);
      this.parsePathSearchHash(dir + trimmed);
    }
  }

  private parseAbsolute(input: string): void {
    const schemeEnd = input.indexOf(':');
    this.protocol = input.slice(0, schemeEnd + 1).toLowerCase();
    let rest = input.slice(schemeEnd + 1);
    if (rest.startsWith('//')) {
      rest = rest.slice(2);
      let authorityEnd = rest.length;
      for (let i = 0; i < rest.length; i++) {
        const c = rest[i];
        if (c === '/' || c === '?' || c === '#') {
          authorityEnd = i;
          break;
        }
      }
      this.host = rest.slice(0, authorityEnd).toLowerCase();
      rest = rest.slice(authorityEnd);
    } else {
      this.host = '';
    }
    this.parsePathSearchHash(rest === '' ? '/' : rest);
  }

  private parsePathSearchHash(input: string): void {
    let rest = input;
    const hashIdx = rest.indexOf('#');
    if (hashIdx !== -1) {
      this.hash = rest.slice(hashIdx) === '#' ? '' : rest.slice(hashIdx);
      rest = rest.slice(0, hashIdx);
    } else {
      this.hash = '';
    }
    const queryIdx = rest.indexOf('?');
    if (queryIdx !== -1) {
      this.search = normalizeSearch(rest.slice(queryIdx));
      rest = rest.slice(0, queryIdx);
    } else {
      this.search = '';
    }
    this.pathname = normalizePath(rest === '' ? '/' : rest);
  }

  get origin(): string {
    return this.host !== '' ? `${this.protocol}//${this.host}` : 'null';
  }

  get hostname(): string {
    const portIdx = this.host.lastIndexOf(':');
    return portIdx === -1 ? this.host : this.host.slice(0, portIdx);
  }

  get href(): string {
    const authority = this.host !== '' ? `//${this.host}` : '';
    return `${this.protocol}${authority}${this.pathname}${this.search}${this.hash}`;
  }

  get searchParams(): UrlSearchParamsShim {
    return new UrlSearchParamsShim(this.search);
  }

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.href;
  }
}

function normalizeSearch(search: string): string {
  if (search === '' || search === '?') return '';
  return search.startsWith('?') ? search : `?${search}`;
}

/**
 * Install `URL`/`URLSearchParams` globals when the runtime lacks them
 * (availability differs across PrimJS versions). No-op when present.
 */
export function ensureUrlGlobals(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  if (typeof target.URL !== 'function') {
    target.URL = UrlShim;
  }
  if (typeof target.URLSearchParams !== 'function') {
    target.URLSearchParams = UrlSearchParamsShim;
  }
}
