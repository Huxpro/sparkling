// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type Presentation = 'push' | 'modal';

export interface ScannedRoute {
    absolutePath: string;
    relativePath: string;
    routePath: string;
    routeSegments: string[];
    kind: 'route' | 'index' | 'layout';
}

export interface ScannedContainer {
    id: string;
    bundle: string;
    presentation: Presentation;
    containerOptions?: Record<string, string>;
    boundaryFile?: string;
    routes: ScannedRoute[];
}

export interface ScanResult {
    rootRouteFile: string;
    containers: ScannedContainer[];
}

export interface SparklingRouterPluginOptions {
    routesDirectory?: string;
    generatedDirectory?: string;
    schemeBase?: string;
    manifestVersion?: string;
    disableLogging?: boolean;
}

export interface GeneratedSparklingRoutes {
    entries: Record<string, string>;
    manifestPath: string;
    manifest: {
        version: string;
        scheme: { base: string };
        containers: Array<{
            bundle: string;
            presentation: Presentation;
            routes: Array<{ path: string }>;
            containerOptions?: Record<string, string>;
        }>;
    };
}
