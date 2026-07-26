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
    private started = false;

    constructor(private readonly transport: NativeStackProtocol) {}

    get state(): StackState {
        return this.currentState;
    }

    async start(): Promise<StackState> {
        if (!this.started) {
            this.started = true;
            this.stopNativeSubscription = this.transport.subscribe((event) => {
                this.accept(event.state, event);
            });
            try {
                this.accept(await this.transport.getState());
            } catch {
                // The event subscription remains active and can converge later.
            }
        }
        return this.currentState;
    }

    subscribe(listener: StackMirrorListener): () => void {
        this.listeners.add(listener);
        listener(this.currentState);
        return () => {
            this.listeners.delete(listener);
        };
    }

    destroy(): void {
        this.stopNativeSubscription?.();
        this.stopNativeSubscription = undefined;
        this.started = false;
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
