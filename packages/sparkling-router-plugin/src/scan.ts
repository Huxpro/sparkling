import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { readCreateFileRoutePath, readExportedObject } from './static-config.js';
import type { CompileRoutesOptions, RouteSource } from './types.js';

const ROUTE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function normalizePath(path: string): string {
  const normalized = `/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

function tanstackPathFromFile(routesDirectory: string, file: string): string {
  const source = readFileSync(file, 'utf8');
  const explicitPath = readCreateFileRoutePath(source, file);
  if (explicitPath) return explicitPath;
  const routeFile = toPosix(relative(routesDirectory, file)).replace(/\.(tsx?|jsx?)$/, '');
  const segments = routeFile
    .split('/')
    .flatMap((segment) => segment.split('.'))
    .filter((segment) => segment !== 'index' && !segment.startsWith('_'));
  return normalizePath(segments.join('/'));
}

function findTanstackBoundary(routesDirectory: string, file: string): string | undefined {
  let directory = dirname(file);
  while (directory.startsWith(routesDirectory)) {
    for (const extension of ROUTE_EXTENSIONS) {
      const candidate = join(directory, `_container${extension}`);
      if (existsSync(candidate)) return candidate;
      const modalCandidate = join(directory, `_container.modal${extension}`);
      if (existsSync(modalCandidate)) return modalCandidate;
    }
    if (directory === routesDirectory) break;
    directory = dirname(directory);
  }
  return undefined;
}

function defaultContainerId(path: string): string {
  return path.split('/').filter(Boolean)[0] ?? 'root';
}

export function scanTanstackRoutes(options: CompileRoutesOptions): RouteSource[] {
  return walk(options.routesDirectory)
    .filter((file) => ROUTE_EXTENSIONS.has(extname(file)))
    .filter((file) => !basename(file).startsWith('__root'))
    .filter((file) => !basename(file).startsWith('_container'))
    .map((file) => {
      const path = tanstackPathFromFile(options.routesDirectory, file);
      const boundary = findTanstackBoundary(options.routesDirectory, file);
      const config = boundary
        ? readExportedObject(readFileSync(boundary, 'utf8'), boundary, 'container')
        : readExportedObject(readFileSync(file, 'utf8'), file, 'container');
      const inferredModal = boundary ? basename(boundary).includes('.modal.') : false;
      const containerId = config?.id ?? defaultContainerId(path);
      return {
        file,
        path,
        containerId,
        presentation: config?.presentation ?? (inferredModal ? 'modal' : 'push'),
        containerOptions: config?.containerOptions,
      };
    });
}

function nextRoutePath(routesDirectory: string, file: string): string {
  const directory = toPosix(relative(routesDirectory, dirname(file)));
  const segments = directory
    .split('/')
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map((segment) => {
      const dynamic = segment.match(/^\[(?:\.\.\.)?(.+)]$/);
      return dynamic ? `:${dynamic[1]}` : segment;
    });
  return normalizePath(segments.join('/'));
}

function nearestNextContainer(routesDirectory: string, file: string): {
  file?: string;
  id: string;
  presentation: 'push' | 'modal';
  containerOptions?: Record<string, string>;
} {
  let directory = dirname(file);
  while (directory.startsWith(routesDirectory)) {
    for (const extension of ROUTE_EXTENSIONS) {
      const candidate = join(directory, `container${extension}`);
      if (!existsSync(candidate)) continue;
      const config = readExportedObject(
        readFileSync(candidate, 'utf8'),
        candidate,
        'container',
      );
      const segment = basename(directory);
      return {
        file: candidate,
        id: config?.id ?? (segment === basename(routesDirectory) ? 'root' : segment),
        presentation: config?.presentation ?? 'push',
        containerOptions: config?.containerOptions,
      };
    }
    if (directory === routesDirectory) break;
    directory = dirname(directory);
  }
  const path = nextRoutePath(routesDirectory, file);
  return {
    id: defaultContainerId(path),
    presentation: 'push',
  };
}

export function scanNextRoutes(options: CompileRoutesOptions): RouteSource[] {
  return walk(options.routesDirectory)
    .filter((file) => /^page\.(tsx?|jsx?)$/.test(basename(file)))
    .map((file) => {
      const boundary = nearestNextContainer(options.routesDirectory, file);
      return {
        file,
        path: nextRoutePath(options.routesDirectory, file),
        containerId: boundary.id,
        presentation: boundary.presentation,
        containerOptions: boundary.containerOptions,
      };
    });
}
