// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
    readdir,
    readFile,
} from 'node:fs/promises';
import {
    basename,
    dirname,
    extname,
    join,
    relative,
    sep,
} from 'node:path';
import type {
    Presentation,
    ScanResult,
    ScannedContainer,
    ScannedRoute,
} from './types';

const ROUTE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ROUTE_PIECE_SUFFIXES = new Set([
    'lazy',
    'loader',
    'component',
    'pendingComponent',
    'errorComponent',
    'notFoundComponent',
]);

function portable(path: string): string {
    return path.split(sep).join('/');
}

async function routeFiles(directory: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        if (
            entry.name === '.sparkling-router'
            || entry.name === 'node_modules'
            || entry.name.startsWith('.')
        ) {
            continue;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            result.push(...await routeFiles(path));
        } else if (
            ROUTE_EXTENSIONS.has(extname(entry.name))
            && !entry.name.startsWith('-')
            && !/\.d\.[cm]?[jt]sx?$/.test(entry.name)
            && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)
        ) {
            result.push(path);
        }
    }
    return result.sort();
}

function withoutExtension(path: string): string {
    return path.slice(0, -extname(path).length);
}

function routeTokens(relativePath: string): string[] {
    return withoutExtension(relativePath)
        .split('/')
        .flatMap((segment) => segment.split('.'));
}

function isContainerBoundary(relativePath: string): boolean {
    return /^_container(?:\.modal)?$/.test(
        basename(withoutExtension(relativePath)),
    );
}

function isPathless(token: string): boolean {
    return (
        (token.startsWith('(') && token.endsWith(')'))
        || token.startsWith('_')
    );
}

function toRoute(relativePath: string): ScannedRoute | null {
    if (isContainerBoundary(relativePath)) {
        return null;
    }
    const tokens = routeTokens(relativePath);
    const finalToken = tokens[tokens.length - 1];
    if (finalToken === '__root') {
        return null;
    }
    if (ROUTE_PIECE_SUFFIXES.has(finalToken)) {
        return null;
    }

    const isIndex = finalToken === 'index';
    const isLayout = finalToken === '_layout';
    const pathTokens = (isIndex || isLayout ? tokens.slice(0, -1) : tokens)
        .filter((token) => !isPathless(token));
    const routePath = pathTokens.length > 0 ? `/${pathTokens.join('/')}` : '/';

    return {
        absolutePath: '',
        relativePath,
        routePath,
        routeSegments: pathTokens,
        kind: isLayout ? 'layout' : isIndex ? 'index' : 'route',
    };
}

function slug(value: string): string {
    const normalized = value
        .replace(/\$/g, 'param-')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    return normalized || 'index';
}

function nearestBoundary(
    routeRelativePath: string,
    boundaries: Map<string, string>,
): string | undefined {
    let directory = portable(dirname(routeRelativePath));
    if (directory === '.') {
        directory = '';
    }
    while (true) {
        const boundary = boundaries.get(directory);
        if (boundary) {
            return boundary;
        }
        if (!directory) {
            return undefined;
        }
        const parent = portable(dirname(directory));
        directory = parent === '.' ? '' : parent;
    }
}

async function readBoundaryOptions(
    path: string,
): Promise<{ presentation: Presentation; containerOptions?: Record<string, string> }> {
    const source = await readFile(path, 'utf8');
    const presentationMatch = source.match(/presentation\s*:\s*['"](push|modal)['"]/);
    const presentation: Presentation = (
        basename(path).includes('.modal.')
        || presentationMatch?.[1] === 'modal'
    ) ? 'modal' : 'push';
    const optionsBlock = source.match(/containerOptions\s*:\s*\{([\s\S]*?)\}/)?.[1];
    const containerOptions: Record<string, string> = {};

    if (optionsBlock) {
        const pairPattern = /(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$-]*))\s*:\s*['"]([^'"]*)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = pairPattern.exec(optionsBlock)) !== null) {
            containerOptions[match[1] ?? match[2]] = match[3];
        }
    }

    return {
        presentation,
        containerOptions: Object.keys(containerOptions).length > 0
            ? containerOptions
            : undefined,
    };
}

function uniqueBundle(base: string, used: Set<string>): string {
    let candidate = `${slug(base)}.lynx.bundle`;
    let suffix = 2;
    while (used.has(candidate)) {
        candidate = `${slug(base)}-${suffix}.lynx.bundle`;
        suffix += 1;
    }
    used.add(candidate);
    return candidate;
}

export async function scanSparklingRoutes(
    routesDirectory: string,
): Promise<ScanResult> {
    const files = await routeFiles(routesDirectory);
    const relativeFiles = files.map((path) => portable(relative(routesDirectory, path)));
    const rootRouteFile = relativeFiles.find((path) => withoutExtension(path) === '__root');
    if (!rootRouteFile) {
        throw new Error(`Sparkling Router requires ${join(routesDirectory, '__root.tsx')}`);
    }

    const boundaries = new Map<string, string>();
    relativeFiles.forEach((path, index) => {
        if (isContainerBoundary(path)) {
            const directory = portable(dirname(path));
            boundaries.set(directory === '.' ? '' : directory, files[index]);
        }
    });

    const usedBundles = new Set<string>();
    const boundaryContainers = new Map<string, ScannedContainer>();
    for (const [directory, boundaryFile] of boundaries) {
        const options = await readBoundaryOptions(boundaryFile);
        boundaryContainers.set(boundaryFile, {
            id: directory || 'root',
            bundle: uniqueBundle(directory || 'root', usedBundles),
            presentation: options.presentation,
            containerOptions: options.containerOptions,
            boundaryFile,
            routes: [],
        });
    }

    const containers: ScannedContainer[] = [...boundaryContainers.values()];
    const layouts: ScannedRoute[] = [];

    relativeFiles.forEach((relativePath, index) => {
        const route = toRoute(relativePath);
        if (!route) {
            return;
        }
        route.absolutePath = files[index];
        if (route.kind === 'layout') {
            layouts.push(route);
            return;
        }

        const boundaryFile = nearestBoundary(relativePath, boundaries);
        if (boundaryFile) {
            boundaryContainers.get(boundaryFile)?.routes.push(route);
            return;
        }

        const id = route.routeSegments.join('-') || 'index';
        containers.push({
            id,
            bundle: uniqueBundle(id, usedBundles),
            presentation: 'push',
            routes: [route],
        });
    });

    layouts.forEach((layout) => {
        const boundaryFile = nearestBoundary(layout.relativePath, boundaries);
        if (boundaryFile) {
            boundaryContainers.get(boundaryFile)?.routes.push(layout);
            return;
        }
        const layoutDirectory = portable(dirname(layout.relativePath));
        containers.forEach((container) => {
            if (container.routes.some((route) => (
                layoutDirectory === '.'
                || route.relativePath.startsWith(`${layoutDirectory}/`)
            ))) {
                container.routes.push(layout);
            }
        });
    });

    containers.forEach((container) => {
        container.routes.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    });

    return {
        rootRouteFile,
        containers: containers
            .filter((container) => container.routes.some((route) => route.kind !== 'layout'))
            .sort((left, right) => left.id.localeCompare(right.id)),
    };
}
