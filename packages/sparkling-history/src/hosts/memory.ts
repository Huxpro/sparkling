// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  HostCloseOptions,
  HostOpenTarget,
  NavigationHost,
  StackChangedEvent,
  StackSubscriber,
} from '../types.js';

export interface RecordedOpen extends HostOpenTarget {}
export interface RecordedClose extends HostCloseOptions {}

export interface MemoryHost extends NavigationHost {
  /** Every open() the router asked the host to perform. */
  readonly opens: Array<RecordedOpen>;
  /** Every close() the router asked the host to perform. */
  readonly closes: Array<RecordedClose>;
  /** Stack events emitted so far (also delivered to subscribers). */
  readonly events: Array<StackChangedEvent>;
  /** Current simulated native stack depth. */
  depth(): number;
  /**
   * Simulate the container popping this page on its own (hardware back /
   * edge gesture / nav-bar back) — the event JS cannot intercept, only
   * observe. Emits a `container-back` stack event.
   */
  simulateContainerBack(result?: unknown): void;
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
 *
 * Unlike the sparkling binding (whose native SDK is command-only today),
 * the memory host implements the full event face, so the intended stack
 * protocol — pop results, container-initiated back — is specified and
 * testable ahead of native support.
 */
export function createMemoryHost(options: MemoryHostOptions = {}): MemoryHost {
  const opens: Array<RecordedOpen> = [];
  const closes: Array<RecordedClose> = [];
  const events: Array<StackChangedEvent> = [];
  const subscribers = new Set<StackSubscriber>();
  let depth = options.stackDepth ?? 0;

  function emit(event: StackChangedEvent) {
    events.push(event);
    subscribers.forEach((s) => s(event));
  }

  return {
    opens,
    closes,
    events,
    depth: () => depth,
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
      if (!target.replace) depth += 1;
      emit({ reason: target.replace ? 'replace' : 'push', depth });
    },
    close(opts) {
      closes.push(opts ?? {});
      depth = Math.max(depth - 1, 0);
      emit({ reason: 'pop', depth, ...(opts?.result !== undefined ? { result: opts.result } : {}) });
    },
    subscribeStack(subscriber) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    simulateContainerBack(result?: unknown) {
      depth = Math.max(depth - 1, 0);
      emit({ reason: 'container-back', depth, ...(result !== undefined ? { result } : {}) });
    },
  };
}
