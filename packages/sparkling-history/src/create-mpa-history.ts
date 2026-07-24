// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assignKeyAndIndex, parseHref } from './parse-href.js';
import type {
  CreateMpaHistoryOptions,
  HistoryAction,
  HistoryLocation,
  MpaHistory,
  NavigateOptions,
  NavigationBlocker,
  ParsedHistoryState,
  SubscriberArgs,
  SubscriberHistoryAction,
} from './types.js';

/**
 * Create an MPA-aware history over a {@link NavigationHost}.
 *
 * Semantics (mirroring @tanstack/history's memory history for the in-page
 * subset, extended with page-boundary behavior):
 *
 * - The history owns an *in-page* entry stack, seeded with the href the
 *   host was launched with. `location.state.__TSR_index` is global:
 *   `hostDepth + localIndex`.
 * - `push`/`replace` consult `resolvePage(href)`. In-page destinations
 *   mutate the local stack and notify subscribers. Cross-page destinations
 *   are forwarded to `host.open(...)` and the local stack is untouched —
 *   the current page keeps rendering until the container covers or
 *   replaces it (document-navigation semantics).
 * - `back()` below the local root forwards to `host.close()` (native pop).
 *   `forward()`/`go(+n)` beyond the local top is a no-op: the native
 *   forward stack does not exist.
 * - Blockers run for JS-initiated navigation in any environment (no
 *   `typeof document` gate, unlike @tanstack/history). They cannot
 *   intercept container-initiated back (hardware/gesture/nav-bar).
 */
export function createMpaHistory(options: CreateMpaHistoryOptions): MpaHistory {
  const { host, resolvePage, onHostError } = options;

  const hostDepth = host.getStackDepth?.() ?? 0;

  const initialHref = options.initialHref ?? host.getInitialHref();
  const initialHostState = host.getInitialState?.();
  const entries: Array<string> = [initialHref];
  const states: Array<ParsedHistoryState> = [
    assignKeyAndIndex(
      hostDepth,
      initialHostState && typeof initialHostState === 'object'
        ? (initialHostState as Record<string, unknown>)
        : undefined,
    ),
  ];
  let index = 0;

  let location: HistoryLocation = parseHref(entries[index]!, states[index]);
  const subscribers = new Set<(opts: SubscriberArgs) => void>();
  let blockers: Array<NavigationBlocker> = [];

  const getLocation = () => parseHref(entries[index]!, states[index]);

  const history: MpaHistory = {
    get location() {
      return location;
    },
    get length() {
      return entries.length;
    },
    subscribers,
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    push(path, state, navigateOpts) {
      const nextState = assignKeyAndIndex(
        (location.state.__TSR_index ?? 0) + 1,
        state as Record<string, unknown> | undefined,
      );
      void tryNavigation(
        {
          type: 'PUSH',
          path,
          state: nextState,
        },
        navigateOpts,
        () => {
          const page = resolvePage?.(path, { currentHref: location.href }) ?? null;
          if (page) {
            const { key: _k, __TSR_key: _tk, __TSR_index: _ti, ...userState } = nextState;
            callHost(() =>
              host.open({
                href: path,
                page,
                replace: false,
                state: Object.keys(userState).length ? userState : undefined,
              }),
            );
            return;
          }
          // Start a new branch: drop any forward entries.
          if (index < entries.length - 1) {
            entries.splice(index + 1);
            states.splice(index + 1);
          }
          entries.push(path);
          states.push(nextState);
          index = entries.length - 1;
          notify({ type: 'PUSH' });
        },
      );
    },
    replace(path, state, navigateOpts) {
      const nextState = assignKeyAndIndex(
        location.state.__TSR_index ?? 0,
        state as Record<string, unknown> | undefined,
      );
      void tryNavigation(
        {
          type: 'REPLACE',
          path,
          state: nextState,
        },
        navigateOpts,
        () => {
          const page = resolvePage?.(path, { currentHref: location.href }) ?? null;
          if (page) {
            const { key: _k, __TSR_key: _tk, __TSR_index: _ti, ...userState } = nextState;
            callHost(() =>
              host.open({
                href: path,
                page,
                replace: true,
                state: Object.keys(userState).length ? userState : undefined,
              }),
            );
            return;
          }
          entries[index] = path;
          states[index] = nextState;
          notify({ type: 'REPLACE' });
        },
      );
    },
    go(n, navigateOpts) {
      void tryNavigation({ type: 'GO' }, navigateOpts, () => {
        const target = index + n;
        if (target < 0) {
          // Walk off the local root: pop the native page. Only a single
          // native pop is supported per go() — deeper multi-page jumps
          // cannot be expressed with sparkling's close-one primitive.
          callHost(() => host.close());
          return;
        }
        index = Math.min(target, entries.length - 1);
        notify({ type: 'GO', index: n });
      });
    },
    back(navigateOpts) {
      void tryNavigation({ type: 'BACK' }, navigateOpts, () => {
        if (index === 0) {
          callHost(() => host.close());
          return;
        }
        index = Math.max(index - 1, 0);
        notify({ type: 'BACK' });
      });
    },
    closePage(opts, navigateOpts) {
      void tryNavigation({ type: 'BACK' }, navigateOpts, () => {
        callHost(() => host.close(opts));
      });
    },
    forward(navigateOpts) {
      void tryNavigation({ type: 'FORWARD' }, navigateOpts, () => {
        // Clamp to the local top; there is no native forward stack.
        index = Math.min(index + 1, entries.length - 1);
        notify({ type: 'FORWARD' });
      });
    },
    canGoBack() {
      return (location.state.__TSR_index ?? 0) !== 0;
    },
    createHref(str) {
      return str;
    },
    block(blocker) {
      blockers = [...blockers, blocker];
      return () => {
        blockers = blockers.filter((b) => b !== blocker);
      };
    },
    flush() {
      // In-memory: nothing to flush.
    },
    destroy() {
      subscribers.clear();
      blockers = [];
    },
    notify(action: SubscriberHistoryAction) {
      notify(action);
    },
  };

  function notify(action: SubscriberHistoryAction) {
    location = getLocation();
    if (history._ignoreSubscribers) return;
    subscribers.forEach((subscriber) => subscriber({ location, action }));
  }

  function callHost(fn: () => void | Promise<{ ok: boolean; message?: string }>) {
    try {
      const result = fn();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<{ ok: boolean; message?: string }>).then(
          (res) => {
            if (res && res.ok === false) {
              onHostError?.(new Error(res.message ?? 'Navigation host rejected the request'));
            }
          },
          (err) => onHostError?.(err),
        );
      }
    } catch (err) {
      onHostError?.(err);
    }
  }

  async function tryNavigation(
    actionInfo:
      | { type: 'PUSH' | 'REPLACE'; path: string; state: ParsedHistoryState }
      | { type: Exclude<HistoryAction, 'PUSH' | 'REPLACE'> },
    navigateOpts: NavigateOptions | undefined,
    task: () => void,
  ): Promise<void> {
    const ignoreBlocker = navigateOpts?.ignoreBlocker ?? false;
    if (ignoreBlocker || blockers.length === 0) {
      task();
      return;
    }

    // Unlike @tanstack/history, blockers are evaluated in any JS
    // environment (their implementation gates on `typeof document`).
    for (const blocker of blockers) {
      const nextLocation =
        actionInfo.type === 'PUSH' || actionInfo.type === 'REPLACE'
          ? parseHref(actionInfo.path, actionInfo.state)
          : location;
      const isBlocked = await blocker.blockerFn({
        currentLocation: location,
        nextLocation,
        action: actionInfo.type,
      });
      if (isBlocked) {
        return;
      }
    }

    task();
  }

  return history;
}
