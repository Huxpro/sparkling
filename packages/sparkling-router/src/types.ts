export type ContainerPresentation = 'push' | 'modal';

export interface RoutePattern {
  path: string;
}

export interface RouteContainer {
  id: string;
  bundle: string;
  presentation: ContainerPresentation;
  routes: RoutePattern[];
  containerOptions?: Record<string, string>;
}

export interface RouteManifest {
  version: string;
  scheme: {
    base: string;
  };
  containers: RouteContainer[];
}

export interface ResolvedRoute {
  container: RouteContainer;
  params: Record<string, string>;
}
