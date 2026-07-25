import type { ResolvedRoute, RouteManifest, RoutePattern } from './types.js';

function matchPattern(pattern: RoutePattern, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.path.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index++) {
    const patternSegment = patternSegments[index]!;
    const pathSegment = pathSegments[index]!;
    if (patternSegment.startsWith('$') || patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }
    if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

export function resolveRoute(
  manifest: RouteManifest,
  pathname: string,
): ResolvedRoute | undefined {
  for (const container of manifest.containers) {
    for (const route of container.routes) {
      const params = matchPattern(route, pathname);
      if (params) {
        return { container, params };
      }
    }
  }
  return undefined;
}

export function createManifestPageResolver(manifest: RouteManifest) {
  return (href: string, context: { currentHref: string }) => {
    const current = resolveRoute(manifest, new URL(context.currentHref, 'sparkling://app').pathname);
    const next = resolveRoute(manifest, new URL(href, 'sparkling://app').pathname);
    if (!next || next.container.id === current?.container.id) {
      return null;
    }
    return {
      id: next.container.id,
      containerParams: {
        presentation: next.container.presentation,
        ...next.container.containerOptions,
      },
    };
  };
}
