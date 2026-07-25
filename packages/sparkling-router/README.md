# Sparkling Router

`sparkling-router` is the framework-neutral runtime layer for URL-first
navigation across Sparkling containers.

The prototype deliberately keeps `@tanstack/router-core` as its underlying
router and type system rather than copying that implementation. TanStack does
not publish framework-neutral `createRouter` / `createRoute` constructors from
`router-core`; those factories are supplied by framework bindings. ReactLynx
therefore uses the official `@tanstack/react-router` binding, connected to
Sparkling through the `RouterHistory` compatible implementation in
`sparkling-history`.

```ts
import {
  createManifestPageResolver,
  createMpaHistory,
  createRouter,
} from 'sparkling-router';

const router = createRouter({
  routeTree,
  history: createMpaHistory({
    host,
    resolvePage: createManifestPageResolver(manifest),
  }),
  isServer: false,
  origin: 'http://sparkling.local',
});
```

This proves that route matching, typed navigation, loaders, search validation,
and redirects can remain upstream TanStack concerns without maintaining a fork
of its core. Sparkling owns only:

- the multi-container `RouterHistory`;
- the serializable route manifest;
- the native navigation host and stack protocol.

ReactLynx rendering still uses `@tanstack/react-router` as a binding on top of
the same core. Native stack events, reset/prefetch/result, and Android/iOS
conformance remain outside this prototype.
