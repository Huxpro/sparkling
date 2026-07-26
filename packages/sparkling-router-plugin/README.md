# sparkling-router-plugin

Codegen for Sparkling Router container boundaries.

## What it does

Scans a TanStack-style `src/routes/**` tree for `_container.tsx` / `_container.modal.tsx` markers and emits:

1. **`route-manifest.gen.json`** — serializable `RouteManifest` injected into every bundle
2. **Per-container entry stubs** — `src/generated/containers/<id>/index.tsx`
3. **`rspeedy-entries.gen.json`** — map suitable for `source.entry` in `lynx.config.ts`

## S3′ generator decision

`@tanstack/router-plugin` remains the right tool for **per-container** typed `routeTree.gen.ts`. Its customization surface is not enough to express hard container boundaries + multi-entry partitioning, so this package owns that layer while keeping TanStack file-route **syntax** unchanged (RFC P5).

## Marker convention

```
src/routes/
  __root.tsx
  index.tsx                 # single-page container "/"
  feed/
    _container.tsx          # hard boundary → bundle "feed"
    index.tsx               # soft "/feed"
    $postId.tsx             # soft "/feed/$postId"
  settings/
    _container.modal.tsx    # modal presentation
    index.tsx
```

Pair with TanStack's `routeFileIgnorePattern: '_container'` so the upstream
generator skips markers (S3′ naming decision: keep `_container*.tsx` spelling;
do not require the `-` ignore prefix).

## Usage

```ts
import { sparklingRouter } from 'sparkling-router-plugin/rspack'

// lynx.config.ts tools.rspack.plugins:
sparklingRouter({
  routesDirectory: 'src/routes',
  schemeBase: 'hybrid://lynxview_page',
})
```

Or imperatively:

```ts
import { generateSparklingRoutes } from 'sparkling-router-plugin'

generateSparklingRoutes(process.cwd())
```
