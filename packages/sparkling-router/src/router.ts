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
    type NavResult,
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
import {
    bindSparklingRuntime,
    type SparklingNavigationRuntime,
} from './runtime-context';

export interface SparklingRouterOptions<TRouteTree extends AnyRoute> {
    routeTree: TRouteTree;
    manifest: RouteManifest;
    containerBundle: string;
    initialHref?: string;
    context?: unknown;
    transport?: NativeStackProtocol;
    onHardNavigationError?: (error: Error) => void;
}

interface PendingResult {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    settled: boolean;
}

class NavigationResults {
    private readonly pendingByParent = new Map<string, PendingResult[]>();
    private readonly pendingByChild = new Map<string, PendingResult>();
    private readonly completedByChild = new Map<string, unknown>();
    private readonly stop: () => void;

    constructor(private readonly transport: NativeStackProtocol) {
        this.stop = transport.subscribe((event) => this.handle(event));
    }

    prepare(parentEntryId: string): {
        promise: Promise<unknown>;
        bind: (childEntryId: string) => void;
        cancel: (error: Error) => void;
    } {
        let pending!: PendingResult;
        const promise = new Promise<unknown>((resolve, reject) => {
            pending = {
                settled: false,
                resolve: (value) => {
                    pending.settled = true;
                    resolve(value);
                },
                reject: (error) => {
                    pending.settled = true;
                    reject(error);
                },
            };
            const queue = this.pendingByParent.get(parentEntryId) ?? [];
            queue.push(pending);
            this.pendingByParent.set(parentEntryId, queue);
        });
        return {
            promise,
            bind: (childEntryId) => {
                if (pending.settled) {
                    return;
                }
                if (this.completedByChild.has(childEntryId)) {
                    const value = this.completedByChild.get(childEntryId);
                    this.completedByChild.delete(childEntryId);
                    this.removeFromParent(parentEntryId, pending);
                    pending.resolve(value);
                    return;
                }
                this.pendingByChild.set(childEntryId, pending);
            },
            cancel: (error) => {
                if (pending.settled) {
                    return;
                }
                this.removeFromParent(parentEntryId, pending);
                for (const [childEntryId, candidate] of this.pendingByChild) {
                    if (candidate === pending) {
                        this.pendingByChild.delete(childEntryId);
                    }
                }
                pending.reject(error);
            },
        };
    }

    destroy(): void {
        this.stop();
        this.pendingByParent.forEach((queue) => {
            queue.forEach(({ reject }) => reject(new Error('Sparkling router was destroyed')));
        });
        this.pendingByParent.clear();
        this.pendingByChild.clear();
        this.completedByChild.clear();
    }

    private handle(event: StackChangedEvent): void {
        if (!event.result) {
            return;
        }
        const fromEntryId = event.result.fromEntryId;
        if (fromEntryId) {
            const pending = this.pendingByChild.get(fromEntryId);
            if (!pending) {
                this.completedByChild.set(fromEntryId, event.result.value);
                return;
            }
            this.pendingByChild.delete(fromEntryId);
            this.removeFromParent(event.result.forEntryId, pending);
            pending.resolve(event.result.value);
            return;
        }

        const queue = this.pendingByParent.get(event.result.forEntryId);
        const pending = queue?.shift();
        pending?.resolve(event.result.value);
        if (queue?.length === 0) {
            this.pendingByParent.delete(event.result.forEntryId);
        }
    }

    private removeFromParent(parentEntryId: string, pending: PendingResult): void {
        const queue = this.pendingByParent.get(parentEntryId);
        if (!queue) {
            return;
        }
        const index = queue.indexOf(pending);
        if (index >= 0) {
            queue.splice(index, 1);
        }
        if (queue.length === 0) {
            this.pendingByParent.delete(parentEntryId);
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
        onHardNavigationError: options.onHardNavigationError,
    });
    const router = createRouter({
        routeTree: options.routeTree,
        history,
        isServer: false,
        context: options.context as never,
    });
    const results = new NavigationResults(transport);

    const runtime = {
        router,
        history,
        stackMirror,
        navigate(
            path: string,
            search: Record<string, string> = {},
            navigationOptions: { replace?: boolean; animated?: boolean } = {},
        ): Promise<NavResult> {
            const request = {
                ...buildStackLocation(options.manifest, path, search),
                animated: navigationOptions.animated,
            };
            return navigationOptions.replace
                ? transport.replace(request)
                : transport.push(request);
        },
        async pushWithResult(
            path: string,
            search: Record<string, string> = {},
        ): Promise<unknown> {
            const request = buildStackLocation(options.manifest, path, search);
            const parentEntryId = history.currentEntryId;
            if (!parentEntryId) {
                throw new Error('Current native stack entry is not available');
            }
            const waiter = results.prepare(parentEntryId);
            try {
                const result = await transport.push(request);
                if (result.code !== 1 || !result.entryId) {
                    throw new Error(result.msg || 'Native push did not return an entry ID');
                }
                waiter.bind(result.entryId);
            } catch (error) {
                waiter.cancel(error instanceof Error ? error : new Error(String(error)));
            }
            return waiter.promise;
        },
        pop(result?: unknown, animated?: boolean): Promise<NavResult> {
            return transport.pop({ result, animated });
        },
        popTo: transport.popTo.bind(transport),
        reset: transport.reset.bind(transport),
        prefetch: transport.prefetch.bind(transport),
        destroy(): void {
            results.destroy();
            history.destroy();
            stackMirror.destroy();
        },
    };
    bindSparklingRuntime(router, runtime as SparklingNavigationRuntime);
    return runtime;
}

export type SparklingRouterRuntime = ReturnType<typeof createSparklingRouter>;
export type { CompositeHistory };
