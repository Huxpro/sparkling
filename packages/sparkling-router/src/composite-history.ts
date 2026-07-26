// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
    createMemoryHistory,
    type NavigateOptions,
    type NavigationBlocker,
    type RouterHistory,
} from '@tanstack/history';
import type { NativeStackProtocol } from 'sparkling-navigation';
import type { GlobalStackMirror } from './global-stack-mirror';
import {
    buildStackLocation,
    locationHref,
    resolveRoute,
    searchRecord,
    type RouteManifest,
} from './manifest';

export interface CompositeHistoryOptions {
    manifest: RouteManifest;
    containerBundle: string;
    containerEntryId?: string;
    initialHref: string;
    transport: NativeStackProtocol;
    stackMirror: GlobalStackMirror;
}

function splitHref(href: string): {
    pathname: string;
    search: Record<string, string>;
} {
    const url = new URL(href, 'sparkling://router');
    return {
        pathname: url.pathname,
        search: searchRecord(url.search),
    };
}

export class CompositeHistory implements RouterHistory {
    private readonly memory: RouterHistory;
    private readonly stopMirror: () => void;
    private converging = false;

    constructor(private readonly options: CompositeHistoryOptions) {
        this.memory = createMemoryHistory({ initialEntries: [options.initialHref] });
        this.memory.subscribe(() => {
            if (this.converging) {
                return;
            }
            const current = splitHref(this.memory.location.href);
            options.transport.syncOwnLocation({
                path: current.pathname,
                search: current.search,
            });
        });
        this.stopMirror = options.stackMirror.subscribe((state) => {
            const ownEntry = state.entries.find(
                (entry) => entry.bundle === options.containerBundle
                    && entry.id === this.currentEntryId,
            ) ?? state.entries.find((entry) => entry.bundle === options.containerBundle);
            if (!ownEntry) {
                return;
            }
            const href = locationHref(ownEntry.path, ownEntry.search);
            if (href !== this.memory.location.href) {
                this.converging = true;
                this.memory.replace(href);
                this.converging = false;
            }
        });
    }

    get location(): RouterHistory['location'] {
        return this.memory.location;
    }

    get length(): number {
        return this.memory.length;
    }

    get subscribers(): RouterHistory['subscribers'] {
        return this.memory.subscribers;
    }

    get currentEntryId(): string | undefined {
        if (this.options.containerEntryId) {
            return this.options.containerEntryId;
        }
        const entries = this.options.stackMirror.state.entries;
        for (let index = entries.length - 1; index >= 0; index -= 1) {
            if (entries[index].bundle === this.options.containerBundle) {
                return entries[index].id;
            }
        }
        return undefined;
    }

    subscribe: RouterHistory['subscribe'] = (callback) => this.memory.subscribe(callback);

    push = (href: string, state?: unknown, navigateOptions?: NavigateOptions): void => {
        const target = splitHref(href);
        const resolved = resolveRoute(this.options.manifest, target.pathname);
        if (!resolved) {
            throw new Error(`No route matches "${target.pathname}"`);
        }
        if (resolved.container.bundle === this.options.containerBundle) {
            this.memory.push(href, state, navigateOptions);
            return;
        }
        const request = buildStackLocation(
            this.options.manifest,
            target.pathname,
            target.search,
        );
        void this.options.transport.push(request);
    };

    replace = (href: string, state?: unknown, navigateOptions?: NavigateOptions): void => {
        const target = splitHref(href);
        const resolved = resolveRoute(this.options.manifest, target.pathname);
        if (!resolved) {
            throw new Error(`No route matches "${target.pathname}"`);
        }
        if (resolved.container.bundle === this.options.containerBundle) {
            this.memory.replace(href, state, navigateOptions);
            return;
        }
        const request = buildStackLocation(
            this.options.manifest,
            target.pathname,
            target.search,
        );
        void this.options.transport.replace(request);
    };

    go = (index: number, navigateOptions?: NavigateOptions): void => {
        const memoryIndex = this.memory.location.state.__TSR_index;
        if (index < 0 && memoryIndex + index < 0) {
            void this.options.transport.pop();
            return;
        }
        this.memory.go(index, navigateOptions);
    };

    back = (navigateOptions?: NavigateOptions): void => {
        if (this.memory.canGoBack()) {
            this.memory.back(navigateOptions);
        } else {
            void this.options.transport.pop();
        }
    };

    forward = (navigateOptions?: NavigateOptions): void => {
        this.memory.forward(navigateOptions);
    };

    canGoBack = (): boolean => (
        this.memory.canGoBack()
        || this.options.stackMirror.state.entries.length > 1
    );

    createHref = (href: string): string => href;

    block = (blocker: NavigationBlocker): (() => void) => this.memory.block(blocker);

    flush = (): void => {
        this.memory.flush();
    };

    destroy = (): void => {
        this.stopMirror();
        this.memory.destroy();
    };

    notify: RouterHistory['notify'] = (action) => {
        this.memory.notify(action);
    };
}

export function createCompositeHistory(
    options: CompositeHistoryOptions,
): CompositeHistory {
    return new CompositeHistory(options);
}
