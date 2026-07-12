// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  HostCloseOptions,
  HostOpenTarget,
  NavigationHost,
} from '../types.js';

export interface RecordedOpen extends HostOpenTarget {}
export interface RecordedClose extends HostCloseOptions {}

export interface MemoryHost extends NavigationHost {
  /** Every open() the router asked the host to perform. */
  readonly opens: Array<RecordedOpen>;
  /** Every close() the router asked the host to perform. */
  readonly closes: Array<RecordedClose>;
}

export interface MemoryHostOptions {
  initialHref?: string;
  stackDepth?: number;
  initialState?: unknown;
}

/**
 * An in-memory {@link NavigationHost} that records the cross-page open/close
 * calls a router makes, instead of touching any real container. This is the
 * host used by the package's own tests and by the demo's headless
 * verification: it makes the boundary between "in-page SPA navigation" and
 * "native page open" observable and assertable.
 */
export function createMemoryHost(options: MemoryHostOptions = {}): MemoryHost {
  const opens: Array<RecordedOpen> = [];
  const closes: Array<RecordedClose> = [];

  return {
    opens,
    closes,
    getInitialHref() {
      return options.initialHref ?? '/';
    },
    getStackDepth() {
      return options.stackDepth ?? 0;
    },
    getInitialState() {
      return options.initialState;
    },
    open(target) {
      opens.push(target);
    },
    close(opts) {
      closes.push(opts ?? {});
    },
  };
}
