// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createNavigationShim } from '../shim';
import type { NavigationShim } from '../shim';
import type { HostOpenOptions, NavigationHost } from '../types';

/**
 * A "document" living in a {@link MemoryDocumentStack}. Each document owns
 * its own shim instance — modeling the real Sparkling/Lynx situation where
 * every container page runs in an isolated JS heap and only the native
 * stack connects them.
 */
export interface MemoryDocument {
  url: string;
  host: NavigationHost;
  shim: NavigationShim;
}

export interface MemoryDocumentStackOptions {
  /** Same-document policy shared by all documents (see NavigationHost). */
  isSameDocument?(from: URL, to: URL): boolean;
  /** Observe stack mutations (tests, logging). */
  onChange?(stack: MemoryDocumentStack): void;
}

/**
 * In-memory NavigationHost implementation: a stack of documents in one JS
 * heap. Useful for unit tests and for SSR-ish environments, and the
 * reference implementation of the {@link NavigationHost} contract's
 * expected stack semantics.
 */
export class MemoryDocumentStack {
  private documents: MemoryDocument[] = [];
  private options: MemoryDocumentStackOptions;

  constructor(initialUrl: string, options: MemoryDocumentStackOptions = {}) {
    this.options = options;
    this.pushDocument(initialUrl);
  }

  get depth(): number {
    return this.documents.length;
  }

  get top(): MemoryDocument {
    return this.documents[this.documents.length - 1];
  }

  at(index: number): MemoryDocument | undefined {
    return this.documents[index];
  }

  private pushDocument(url: string, replace = false): MemoryDocument {
    const stack = this;
    const host: NavigationHost = {
      initialUrl: url,
      open(nextUrl: string, options?: HostOpenOptions) {
        stack.open(nextUrl, options);
      },
      close() {
        stack.close();
      },
      go(delta: number) {
        stack.go(delta);
      },
      isSameDocument: this.options.isSameDocument,
    };
    const doc: MemoryDocument = { url, host, shim: createNavigationShim(host) };
    if (replace && this.documents.length > 0) {
      this.documents[this.documents.length - 1] = doc;
    } else {
      this.documents.push(doc);
    }
    this.options.onChange?.(this);
    return doc;
  }

  /** Native push (or replace) of a new document. */
  open(url: string, options: HostOpenOptions = {}): MemoryDocument {
    return this.pushDocument(url, options.replace === true);
  }

  /** Native pop of the top document. The bottom document never closes. */
  close(): void {
    if (this.documents.length > 1) {
      const closed = this.documents.pop();
      closed?.shim.notifyPageHide();
      this.options.onChange?.(this);
    }
  }

  /** Native traversal by delta documents (negative = back). */
  go(delta: number): void {
    if (delta >= 0) return; // no forward stack in a native container stack
    const steps = Math.min(-delta, this.documents.length - 1);
    for (let i = 0; i < steps; i += 1) {
      this.close();
    }
  }
}

/**
 * Convenience: create a single-document memory host (no stack semantics
 * needed) — enough for unit-testing shims in isolation.
 */
export function createMemoryHost(initialUrl: string, options: MemoryDocumentStackOptions = {}): NavigationHost {
  return new MemoryDocumentStack(initialUrl, options).top.host;
}
