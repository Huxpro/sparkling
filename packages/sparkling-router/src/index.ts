export {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Route,
  Router,
} from '@tanstack/react-router';
export { notFound, redirect, rootRouteId } from '@tanstack/router-core';
export type {
  AnyRoute,
  AnyRouter,
  NavigateOptions,
  RegisteredRouter,
  RouterOptions,
} from '@tanstack/router-core';
export type { RouterHistory } from '@tanstack/history';
export { createMpaHistory } from 'sparkling-history';
export { createManifestPageResolver, resolveRoute } from './manifest.js';
export type {
  ContainerPresentation,
  ResolvedRoute,
  RouteContainer,
  RouteManifest,
  RoutePattern,
} from './types.js';
