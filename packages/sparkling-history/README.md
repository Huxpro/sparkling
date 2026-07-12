# sparkling-history

A framework-agnostic **history shim** that lets SPA routers (Vue Router
first) drive **Sparkling's multi-page native navigation** — the MPA model —
where each page is a separate Lynx container in its own JS heap.

> This is deliberately different from [VueLynx](https://vue.lynxjs.org)'s
> in-`LynxView` SPA routing, which uses `createMemoryHistory` to keep all
> routes inside a single heap. Here the router drives navigation *between*
> native containers that do **not** share memory. The only thing they can
> share is a build-time **route manifest**, so that is what connects them.

## The layering (why it's reusable)

```
┌──────────────────────────────────────────────────────────────┐
│  Router framework           vue-router  (or any router that   │
│                             accepts a RouterHistory-like obj)  │
├──────────────────────────────────────────────────────────────┤
│  Adapter                    sparkling-history/vue             │  ← per-framework, thin
│                             createSparklingRouter()           │
├──────────────────────────────────────────────────────────────┤
│  Shim core (this package)   HybridRouterHistory               │  ← framework-agnostic
│                             SchemeCodec + RouteManifest       │
├──────────────────────────────────────────────────────────────┤
│  Host contract              NavigationHost                    │  ← platform-agnostic
│                     open() / close() / initialUrl / visibility │
├──────────────────────────────────────────────────────────────┤
│  Platform            Sparkling native │ Web shell │ Memory     │
│                      (sparkling-nav)  │ (harness) │ (tests)    │
└──────────────────────────────────────────────────────────────┘
```

Each seam is a small, explicit contract:

- **`NavigationHost`** — the platform floor. Anything that can *open* and
  *close* stacked pages addressed by a URL implements it. Ships with a
  Sparkling binding (`sparkling-history/sparkling`, over
  `sparkling-navigation`) and an in-memory simulator (for tests / SSR). A
  bespoke native shell only needs to satisfy this interface to reuse the
  whole stack above.
- **`SchemeCodec` + `RouteManifest`** — the cross-heap contract. The manifest
  is generated from the file-based page convention at build time and embedded
  in every bundle, so isolated heaps agree on which page owns which route
  without sharing memory. The codec maps router locations ⇆ sparkling scheme
  URLs and carries `route`/`state`/`depth` across the boundary in the URL.
- **`HybridRouterHistory`** — structurally compatible with vue-router's
  `RouterHistory`, so it drops into `createRouter({ history })`. In-container
  it behaves like memory history; at the container boundary it delegates to
  the host.

Because the router only ever sees a `RouterHistory`, the same core works for
any router that accepts a custom history, and the same host works for any
framework — the point of keeping the layers apart.

## How a navigation flows

`router.push('/detail/42')` inside the `home` page bundle:

1. the vue adapter resolves `/detail/42` and asks the codec **who owns it**
2. owned by *another* bundle (`detail`) → the adapter calls
   `history.pushExternal('/detail/42')` instead of a local transition
3. the codec encodes it to
   `hybrid://lynxview_page?bundle=detail.lynx.bundle&__hs_route=%2Fdetail%2F42&__hs_depth=1`
4. `NavigationHost.open(scheme)` → `sparkling-navigation`'s `router.open`
   stacks a new native container (a fresh JS heap)
5. the `detail` bundle boots, builds its own `HybridRouterHistory`, decodes
   its container URL, and starts its router at `/detail/42` — running *its*
   guards, exactly like a browser MPA loading a new document

If `/detail/42` had been owned by the *same* bundle, step 2 stays local and
it is an ordinary in-heap vue-router transition (nested views, guards, params
— all untouched).

## Usage

```ts
// one router per page bundle (one heap)
import { createSparklingRouter } from 'sparkling-history/vue'
import manifest from './generated/route-manifest' // built by the codegen plugin

const router = createSparklingRouter({
  manifest,
  routes: [ /* only the routes THIS bundle implements locally */ ],
})
router.push(router.hybridHistory.location) // initial navigation
```

Build-time manifest generation (rsbuild/rspeedy):

```ts
import { pluginRouteManifest } from 'sparkling-history/codegen'

plugins: [
  pluginRouteManifest({
    pagesDir: 'src/pages',
    outFile: 'src/generated/route-manifest.ts',
  }),
]
```

See [`examples/vue-router-mpa`](../../examples/vue-router-mpa) for a full working demo,
and [`COMPATIBILITY.md`](./COMPATIBILITY.md) for the Vue Router feature matrix.

## What crosses the heap boundary

Only what fits in a URL: the target **route**, the navigation **state**
(JSON-serialized), and the stack **depth**. This is the fundamental MPA
constraint — there is no shared memory, no shared reactive store, no live
object references between pages. Anything richer must go through a native
channel (`sparkling-storage`, a native module, etc.).

## Testing

`createMemoryNavigationEnvironment()` simulates the native container stack in
one process, so cross-heap flows are exercised with **real vue-router
instances** — one per simulated container — without a device. The suite ports
vue-router's official memory-history tests (in-container behavior) and adds
cross-container + adapter coverage. Run `pnpm --filter sparkling-history test`.
