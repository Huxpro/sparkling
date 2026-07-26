// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useRouter } from '@tanstack/react-router';
import type {
    NavResult,
    StackPopToRequest,
    StackPrefetchRequest,
    StackResetRequest,
} from 'sparkling-navigation';

export interface SparklingNavigationRuntime {
    navigate(
        path: string,
        search?: Record<string, string>,
        options?: { replace?: boolean; animated?: boolean },
    ): Promise<NavResult>;
    pushWithResult(
        path: string,
        search?: Record<string, string>,
    ): Promise<unknown>;
    pop(result?: unknown, animated?: boolean): Promise<NavResult>;
    popTo(request: StackPopToRequest): Promise<NavResult>;
    reset(request: StackResetRequest): Promise<NavResult>;
    prefetch(request: StackPrefetchRequest): Promise<NavResult>;
}

const runtimes = new WeakMap<object, SparklingNavigationRuntime>();

/** @internal Associates a TanStack router with its native navigation runtime. */
export function bindSparklingRuntime(
    router: object,
    runtime: SparklingNavigationRuntime,
): void {
    runtimes.set(router, runtime);
}

export function getSparklingRuntime(router: object): SparklingNavigationRuntime {
    const runtime = runtimes.get(router);
    if (!runtime) {
        throw new Error('The router was not created by createSparklingRouter');
    }
    return runtime;
}

/** Access hard-container navigation from a generated RouterProvider tree. */
export function useSparklingRouter(): SparklingNavigationRuntime {
    return getSparklingRuntime(useRouter());
}
