// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type StackPresentation = 'push' | 'modal';

export interface StackEntry {
    id: string;
    path: string;
    search: Record<string, string>;
    bundle: string;
    presentation: StackPresentation;
}

export interface StackState {
    version: number;
    entries: StackEntry[];
}

export type StackChangeReason =
    | 'push'
    | 'pop'
    | 'replace'
    | 'reset'
    | 'user-back-gesture'
    | 'user-back-button'
    | 'system';

export interface StackChangedEvent {
    state: StackState;
    reason: StackChangeReason;
    result?: {
        forEntryId: string;
        value: unknown;
    };
}

export interface NavResult {
    code: number;
    msg: string;
    entryId?: string;
    state?: StackState;
}

export interface StackLocationRequest {
    path: string;
    search?: Record<string, string>;
    /**
     * Bridge-only resolved target. sparkling-router derives these fields from
     * its manifest; native never needs to parse or own that manifest.
     */
    bundle?: string;
    scheme?: string;
}

export interface StackPushRequest extends StackLocationRequest {
    presentation?: StackPresentation;
    usePrefetched?: boolean;
    animated?: boolean;
}

export interface StackPopRequest {
    result?: unknown;
    animated?: boolean;
}

export interface StackPopToRequest {
    entryId: string;
    animated?: boolean;
}

export interface StackReplaceRequest extends StackLocationRequest {
    presentation?: StackPresentation;
    animated?: boolean;
}

export interface StackResetEntry extends StackLocationRequest {
    presentation?: StackPresentation;
}

export interface StackResetRequest {
    entries: StackResetEntry[];
    animated?: boolean;
}

export interface StackPrefetchRequest extends StackLocationRequest {
    presentation?: StackPresentation;
}

export interface SyncOwnLocationRequest {
    path: string;
    search: Record<string, string>;
}

export interface NativeStackProtocol {
    push(req: StackPushRequest): Promise<NavResult>;
    pop(req?: StackPopRequest): Promise<NavResult>;
    popTo(req: StackPopToRequest): Promise<NavResult>;
    replace(req: StackReplaceRequest): Promise<NavResult>;
    reset(req: StackResetRequest): Promise<NavResult>;
    getState(): Promise<StackState>;
    prefetch(req: StackPrefetchRequest): Promise<NavResult>;
    syncOwnLocation(req: SyncOwnLocationRequest): void;
    subscribe(listener: (event: StackChangedEvent) => void): () => void;
}
