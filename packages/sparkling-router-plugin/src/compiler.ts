import { relative } from 'node:path';
import type { RouteContainer, RouteManifest } from 'sparkling-router';
import { scanNextRoutes, scanTanstackRoutes } from './scan.js';
import type { CompileRoutesOptions, CompileRoutesResult, RouteSource } from './types.js';

function compileManifest(
  routes: RouteSource[],
  options: CompileRoutesOptions,
): RouteManifest {
  const containers = new Map<string, RouteContainer>();
  for (const route of routes) {
    const current = containers.get(route.containerId);
    if (current) {
      if (current.presentation !== route.presentation) {
        throw new Error(
          `Container "${route.containerId}" mixes ${current.presentation} and ${route.presentation} presentation`,
        );
      }
      current.routes.push({ path: route.path });
      continue;
    }
    containers.set(route.containerId, {
      id: route.containerId,
      bundle: `${route.containerId}.lynx.bundle`,
      presentation: route.presentation,
      routes: [{ path: route.path }],
      containerOptions: route.containerOptions,
    });
  }

  return {
    version: options.version ?? 'prototype-1',
    scheme: { base: options.schemeBase ?? 'hybrid://lynxview_page' },
    containers: [...containers.values()]
      .map((container) => ({
        ...container,
        routes: container.routes.sort((left, right) => left.path.localeCompare(right.path)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function compileRoutes(options: CompileRoutesOptions): CompileRoutesResult {
  const routes =
    options.convention === 'tanstack'
      ? scanTanstackRoutes(options)
      : scanNextRoutes(options);
  if (routes.length === 0) {
    throw new Error(`No ${options.convention} routes found in ${options.routesDirectory}`);
  }
  const manifest = compileManifest(routes, options);
  const entries = Object.fromEntries(
    manifest.containers.map((container) => {
      const source = routes.find((route) => route.containerId === container.id)!;
      return [container.id, relative(process.cwd(), source.file)];
    }),
  );
  return {
    manifest,
    entries,
    routes,
    diagnostics: [
      options.convention === 'tanstack'
        ? 'Use @tanstack/router-generator for routeTree.gen.ts; Sparkling only adds container partitioning.'
        : 'Next app-dir files compile to the same neutral manifest; React bindings remain a separate frontend.',
    ],
  };
}
