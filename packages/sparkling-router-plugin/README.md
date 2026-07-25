# Sparkling Router Plugin

This package prototypes two authoring frontends over one serializable route
manifest:

- `tanstack`: `src/routes/**` with `createFileRoute` and `_container.tsx`
  boundaries;
- `next`: `app/**/page.tsx` with optional `container.ts` boundaries.

Both conventions compile to the same `RouteManifest` consumed by
`sparkling-router`. Components and loaders are intentionally absent from the
manifest so every native bundle can receive the same versioned routing data.

For TanStack projects, the intended pipeline is:

1. keep `@tanstack/router-generator` for `routeTree.gen.ts` and typed routes;
2. run this compiler for container partitioning, the global manifest, and
   Rspeedy entry metadata.

```sh
sparkling-router \
  --convention tanstack \
  --routes src/routes \
  --out src/routes.manifest.json
```

The Next frontend is a compatibility spike, not a Next.js runtime. It proves
that app-directory paths and layouts can target the same core/schema without
changing `sparkling-router`. React-facing `next/link` and `useRouter` shims are
future binding work.
