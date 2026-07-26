// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
    createRouter,
    type AnyRoute,
} from '@tanstack/react-router';
import {
    nativeStack,
    type NativeStackProtocol,
    type StackChangedEvent,
} from 'sparkling-navigation';
import {
    CompositeHistory,
    createCompositeHistory,
} from './composite-history';
import { GlobalStackMirror } from './global-stack-mirror';
import {
    buildStackLocation,
    readInitialHref,
    type RouteManifest,
} from './manifest';

export interface SparklingRouterOptions<TRouteTree extends AnyRoute> {
    routeTree: TRouteTree;
    manifest: RouteManifest;
    containerBundle: string;
    initialHref?: string;
    context?: unknown;
    transport?: NativeStackProtocol;
}

interface PendingResult {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}

class NavigationResults {
    private readonly pending = new Map<string, PendingResult[]>();
    private readonly stop: () => void;

    constructor(private readonly transport: NativeStackProtocol) {
        this.stop = transport.subscribe((event) => this.handle(event));
    }

    wait(parentEntryId: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const queue = this.pending.get(parentEntryId) ?? [];
            queue.push({ resolve, reject });
            this.pending.set(parentEntryId, queue);
        });
    }

    rejectLatest(parentEntryId: string, error: Error): void {
        const queue = this.pending.get(parentEntryId);
        const pending = queue?.pop();
        pending?.reject(error);
        if (queue?.length === 0) {
            this.pending.delete(parentEntryId);
        }
    }

    destroy(): void {
        this.stop();
        this.pending.forEach((queue) => {
            queue.forEach(({ reject }) => reject(new Error('Sparkling router was destroyed')));
        });
        this.pending.clear();
    }

    private handle(event: StackChangedEvent): void {
        if (!event.result) {
            return;
        }
        const queue = this.pending.get(event.result.forEntryId);
        const pending = queue?.shift();
        pending?.resolve(event.result.value);
        if (queue?.length === 0) {
            this.pending.delete(event.result.forEntryId);
        }
    }
}

declare const lynx:
    | {
        __globalProps?: {
            containerID?: string;
        };
    }
    | undefined;

function readContainerEntryId(): string | undefined {
    try {
        return typeof lynx !== 'undefined' ? lynx?.__globalProps?.containerID : undefined;
    } catch {
        return undefined;
    }
}

export function createSparklingRouter<TRouteTree extends AnyRoute>(
    options: SparklingRouterOptions<TRouteTree>,
) {
    const transport = options.transport ?? nativeStack;
    const stackMirror = new GlobalStackMirror(transport);
    void stackMirror.start();
    const history = createCompositeHistory({
        manifest: options.manifest,
        containerBundle: options.containerBundle,
        containerEntryId: readContainerEntryId(),
        initialHref: options.initialHref
            ?? readInitialHref(options.manifest, options.containerBundle),
        transport,
        stackMirror,
    });
    const router = createRouter({
        routeTree: options.routeTree,
        history,
        isServer: false,
        context: options.context as never,
    });
    const results = new NavigationResults(transport);

    return {
        router,
        history,
        stackMirror,
        async pushWithResult(
            path: string,
            search: Record<string, string> = {},
        ): Promise<unknown> {
            const parentEntryId = history.currentEntryId;
            if (!parentEntryId) {
                throw new Error('Current native stack entry is not available');
            }
            const resultPromise = results.wait(parentEntryId);
            const request = buildStackLocation(options.manifest, path, search);
            const result = await transport.push(request);
            if (result.code !== 1) {
                results.rejectLatest(parentEntryId, new Error(result.msg));
            }
            return resultPromise;
        },
        destroy(): void {
            results.destroy();
            history.destroy();
            stackMirror.destroy();
        },
    };
}

export type SparklingRouterRuntime = ReturnType<typeof createSparklingRouter>;
export type { CompositeHistory };
