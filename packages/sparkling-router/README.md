# sparkling-router

URL-first dual-layer navigation for Sparkling apps.

- **Soft navigation** — in-container TanStack Router + memory history (same LynxView / JS runtime)
- **Hard navigation** — cross-container stack protocol (`push` / `pop` / `reset` / …) mirrored via `GlobalStackMirror`

TanStack touchpoints are intentionally narrow: `RouterHistory` (`CompositeHistory`) and the file-route generator in `sparkling-router-plugin`.

## Install

```bash
pnpm add sparkling-router @tanstack/react-router url-search-params-polyfill
pnpm add -D sparkling-router-plugin @tanstack/router-plugin
```

## Usage

```ts
import 'url-search-params-polyfill'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import {
  createSparklingHistory,
  resolveContainerIdentity,
  type RouteManifest,
} from 'sparkling-router'
import { routeTree } from './routeTree.gen'
import manifest from './route-manifest.gen.json'

const runtime = createSparklingHistory({
  manifest: manifest as RouteManifest,
  container: resolveContainerIdentity(manifest as RouteManifest, 'feed'),
  queryItems: lynx.__globalProps?.queryItems,
  // memoryStack: true // for demos / tests without native stack methods
})

const router = createRouter({
  routeTree,
  history: runtime.history,
  isServer: false,
})
```

## Package layout

| Export | Role |
| --- | --- |
| `createCompositeHistory` | Soft/hard `RouterHistory` |
| `createSparklingHistory` | Convenience wiring |
| `GlobalStackMirror` | Read-only stack subscription |
| `createInMemoryStackProtocol` | Test / demo stack |
| `pathToScheme` | Manifest → `hybrid://…` translation |

See the Sparkling Router RFC for the full stack protocol and container-boundary authoring model.
