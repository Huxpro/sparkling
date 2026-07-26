// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import pipe from 'sparkling-method';
import type {
    NativeStackProtocol,
    NavResult,
    StackChangedEvent,
    StackPopRequest,
    StackPopToRequest,
    StackPrefetchRequest,
    StackPushRequest,
    StackReplaceRequest,
    StackResetRequest,
    StackState,
    SyncOwnLocationRequest,
} from './stack.d';

export const STACK_CHANGED_EVENT = 'router.stackchanged';
const STACK_METHOD = 'router.stack';

type StackCommand =
    | 'push'
    | 'pop'
    | 'popTo'
    | 'replace'
    | 'reset'
    | 'getState'
    | 'prefetch'
    | 'syncOwnLocation';

interface PipeResponse {
    code?: number;
    msg?: string;
    data?: {
        entryId?: string;
        state?: StackState;
    };
}

const localListeners = new Set<(event: StackChangedEvent) => void>();

function normalizeResult(value: unknown): NavResult {
    const response = (value ?? {}) as PipeResponse;
    const code = typeof response.code === 'number' ? response.code : -1;
    return {
        code,
        msg: response.msg ?? (code === 1 ? 'ok' : 'Unknown error'),
        entryId: response.data?.entryId,
        state: response.data?.state,
    };
}

function callStack(command: StackCommand, payload: Record<string, unknown> = {}): Promise<NavResult> {
    return new Promise((resolve) => {
        pipe.call(STACK_METHOD, { command, ...payload }, (value: unknown) => {
            resolve(normalizeResult(value));
        });
    });
}

function isStackState(value: unknown): value is StackState {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<StackState>;
    return typeof candidate.version === 'number' && Array.isArray(candidate.entries);
}

function unwrapEvent(value: unknown): StackChangedEvent | null {
    let candidate = Array.isArray(value) ? value[0] : value;
    if (candidate && typeof candidate === 'object' && 'data' in candidate) {
        candidate = (candidate as { data?: unknown }).data;
    }
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }
    const event = candidate as Partial<StackChangedEvent>;
    if (!isStackState(event.state) || typeof event.reason !== 'string') {
        return null;
    }
    return event as StackChangedEvent;
}

/** @internal Used by the web bridge, which has no Lynx GlobalEventEmitter. */
export function emitLocalStackChanged(event: StackChangedEvent): void {
    localListeners.forEach((listener) => listener(event));
}

export function push(req: StackPushRequest): Promise<NavResult> {
    return callStack('push', req as unknown as Record<string, unknown>);
}

export function pop(req: StackPopRequest = {}): Promise<NavResult> {
    return callStack('pop', req as Record<string, unknown>);
}

export function popTo(req: StackPopToRequest): Promise<NavResult> {
    return callStack('popTo', req as unknown as Record<string, unknown>);
}

export function replace(req: StackReplaceRequest): Promise<NavResult> {
    return callStack('replace', req as unknown as Record<string, unknown>);
}

export function reset(req: StackResetRequest): Promise<NavResult> {
    return callStack('reset', req as unknown as Record<string, unknown>);
}

export async function getState(): Promise<StackState> {
    const result = await callStack('getState');
    if (result.code !== 1 || !result.state) {
        throw new Error(result.msg);
    }
    return result.state;
}

export function prefetch(req: StackPrefetchRequest): Promise<NavResult> {
    return callStack('prefetch', req as unknown as Record<string, unknown>);
}

export function syncOwnLocation(req: SyncOwnLocationRequest): void {
    void callStack('syncOwnLocation', req as unknown as Record<string, unknown>);
}

export function subscribeStackChanges(listener: (event: StackChangedEvent) => void): () => void {
    localListeners.add(listener);

    let nativeListener: ((value: unknown) => void) | undefined;
    try {
        nativeListener = (value: unknown) => {
            const event = unwrapEvent(value);
            if (event) {
                listener(event);
            }
        };
        pipe.on(STACK_CHANGED_EVENT, nativeListener);
    } catch {
        // Web and unit-test environments do not expose Lynx GlobalEventEmitter.
    }

    return () => {
        localListeners.delete(listener);
        if (nativeListener) {
            try {
                pipe.off(STACK_CHANGED_EVENT, nativeListener);
            } catch {
                // The native runtime may already have been destroyed.
            }
        }
    };
}

export const nativeStack: NativeStackProtocol = {
    push,
    pop,
    popTo,
    replace,
    reset,
    getState,
    prefetch,
    syncOwnLocation,
    subscribe: subscribeStackChanges,
};
