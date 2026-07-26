// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
    NativeStackProtocol,
    StackChangedEvent,
    StackState,
} from 'sparkling-navigation';

export type StackMirrorListener = (
    state: StackState,
    event?: StackChangedEvent,
) => void;

export class GlobalStackMirror {
    private currentState: StackState = { version: 0, entries: [] };
    private readonly listeners = new Set<StackMirrorListener>();
    private stopNativeSubscription?: () => void;
    private startPromise?: Promise<StackState>;
    private generation = 0;

    constructor(private readonly transport: NativeStackProtocol) {}

    get state(): StackState {
        return this.currentState;
    }

    async start(): Promise<StackState> {
        if (!this.startPromise) {
            const generation = this.generation;
            this.stopNativeSubscription = this.transport.subscribe((event) => {
                if (generation === this.generation) {
                    this.accept(event.state, event);
                }
            });
            this.startPromise = this.transport.getState()
                .then((state) => {
                    if (generation === this.generation) {
                        this.accept(state);
                    }
                    return this.currentState;
                })
                .catch(() => this.currentState);
        }
        return this.startPromise;
    }

    subscribe(listener: StackMirrorListener): () => void {
        this.listeners.add(listener);
        listener(this.currentState);
        return () => {
            this.listeners.delete(listener);
        };
    }

    destroy(): void {
        this.generation += 1;
        this.stopNativeSubscription?.();
        this.stopNativeSubscription = undefined;
        this.startPromise = undefined;
        this.listeners.clear();
    }

    private accept(state: StackState, event?: StackChangedEvent): void {
        if (state.version < this.currentState.version) {
            return;
        }
        if (state.version === this.currentState.version && this.currentState.entries.length > 0) {
            return;
        }
        this.currentState = state;
        this.listeners.forEach((listener) => listener(state, event));
    }
}
