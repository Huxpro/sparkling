// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
    StackLocationRequest,
    StackPresentation,
} from 'sparkling-navigation';

export interface RouteManifestRoute {
    path: string;
}

export interface RouteManifestContainer {
    bundle: string;
    presentation: StackPresentation;
    routes: RouteManifestRoute[];
    containerOptions?: Record<string, string>;
}

export interface RouteManifest {
    version: string;
    scheme: {
        base: string;
    };
    containers: RouteManifestContainer[];
}

export interface ResolvedRoute {
    container: RouteManifestContainer;
    path: string;
}

function forEachRecord(
    record: Record<string, string>,
    callback: (key: string, value: string) => void,
): void {
    Object.keys(record).forEach((key) => callback(key, record[key]));
}

export function normalizePath(path: string): string {
    const normalized = `/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
    return normalized || '/';
}

function pathSegments(path: string): string[] {
    const normalized = normalizePath(path);
    return normalized === '/' ? [] : normalized.slice(1).split('/');
}

function matchScore(pattern: string, path: string): number | null {
    const patternParts = pathSegments(pattern);
    const pathParts = pathSegments(path);
    let score = 0;

    for (let index = 0; index < patternParts.length; index += 1) {
        const segment = patternParts[index];
        const actual = pathParts[index];

        if (segment === '$' || segment === '*') {
            return score + 1;
        }
        if (actual === undefined) {
            return null;
        }
        if (segment.startsWith('$') || segment.startsWith(':')) {
            score += 2;
            continue;
        }
        if (segment !== actual) {
            return null;
        }
        score += 4;
    }

    return patternParts.length === pathParts.length ? score : null;
}

export function resolveRoute(manifest: RouteManifest, path: string): ResolvedRoute | null {
    const normalizedPath = normalizePath(path);
    let best: { container: RouteManifestContainer; score: number } | undefined;

    for (const container of manifest.containers) {
        for (const route of container.routes) {
            const score = matchScore(route.path, normalizedPath);
            if (score !== null && (!best || score > best.score)) {
                best = { container, score };
            }
        }
    }

    return best ? { container: best.container, path: normalizedPath } : null;
}

export function buildStackLocation(
    manifest: RouteManifest,
    path: string,
    search: Record<string, string> = {},
): StackLocationRequest & { presentation: StackPresentation } {
    const resolved = resolveRoute(manifest, path);
    if (!resolved) {
        throw new Error(`No Sparkling container owns route "${normalizePath(path)}"`);
    }

    const url = new URL(manifest.scheme.base);
    forEachRecord(search, (key, value) => url.searchParams.set(key, value));
    forEachRecord(resolved.container.containerOptions ?? {}, (key, value) => {
        url.searchParams.set(key, value);
    });
    url.searchParams.set('bundle', resolved.container.bundle);
    url.searchParams.set('__path', resolved.path);

    return {
        path: resolved.path,
        search,
        bundle: resolved.container.bundle,
        scheme: url.toString(),
        presentation: resolved.container.presentation,
    };
}

export function searchRecord(search: string): Record<string, string> {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

export function locationHref(path: string, search: Record<string, string>): string {
    const params = new URLSearchParams();
    forEachRecord(search, (key, value) => params.set(key, value));
    const query = params.toString();
    return `${normalizePath(path)}${query ? `?${query}` : ''}`;
}

declare const lynx:
    | {
        __globalProps?: {
            queryItems?: Record<string, unknown>;
        };
    }
    | undefined;

export function readInitialHref(
    manifest: RouteManifest,
    containerBundle: string,
    fallback = '/',
): string {
    let queryItems: Record<string, unknown> = {};
    try {
        queryItems = typeof lynx !== 'undefined' ? lynx?.__globalProps?.queryItems ?? {} : {};
    } catch {
        queryItems = {};
    }

    const container = manifest.containers.find((item) => item.bundle === containerBundle);
    const path = typeof queryItems.__path === 'string'
        ? queryItems.__path
        : container?.routes[0]?.path ?? fallback;
    const reserved = new Set([
        '__path',
        'bundle',
        'url',
        ...Object.keys(container?.containerOptions ?? {}),
    ]);
    const search: Record<string, string> = {};

    Object.keys(queryItems).forEach((key) => {
        const value = queryItems[key];
        if (!reserved.has(key) && value != null) {
            search[key] = String(value);
        }
    });

    return locationHref(path, search);
}
