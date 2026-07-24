# sparkling-history

A reusable **web-history shim** that lets URL-driven routers — TanStack Router,
React Router, or your own — drive **native multi-page navigation**, where each
route subtree runs in its own container / JS context.

This is the opposite of the SPA-in-one-view model: instead of one long-lived
router in one JS heap, each page is a separate view/VM, and navigating between
pages is a native container `open`. Because pages cannot share memory, they are
connected by pre-generated file-based metadata (a route→page manifest) rather
than an in-process history stack.

## Layers

```
        your router (TanStack Router / React Router / ...)
                    │  consumes a RouterHistory
        ┌───────────▼───────────┐
        │     createMpaHistory   │   web-history shim (this package)
        └───────────┬───────────┘
                    │  calls a NavigationHost
   ┌────────────────▼─────────────────┐
   │  createSparklingHost / your own   │   platform binding
   └────────────────┬─────────────────┘
                    │
             native container (sparkling-navigation)
```

- **`NavigationHost`** — the contract a platform implements:
  `getInitialHref()`, `getStackDepth()`, `getInitialState()`, `open()`,
  `close()`. Anything satisfying it can host a URL-driven router.
- **`createMpaHistory(opts)`** — implements the `RouterHistory` shape from
  `@tanstack/history`, so its result can be passed straight to
  `createRouter({ history })`. In-page navigations behave like a memory
  history; cross-page navigations (decided by a `PageResolver`) are forwarded
  to `host.open()`; `back()` at the page root becomes `host.close()`.
- **`createSparklingHost(opts)`** (`sparkling-history/sparkling`) — the
  `sparkling-navigation` binding.

## Usage

```ts
import { createRouter } from '@tanstack/react-router';
import { createMpaHistory, createManifestPageResolver } from 'sparkling-history';
import { createSparklingHost } from 'sparkling-history/sparkling';
import * as navigation from 'sparkling-navigation';
import { routeTree, manifest } from './routes';

const host = createSparklingHost({
  navigation,
  getQueryItems: () => lynx.__globalProps.queryItems,
});

const router = createRouter({
  routeTree,
  history: createMpaHistory({ host, resolvePage: createManifestPageResolver(manifest) }),
  isServer: false,
  origin: 'http://sparkling.local', // router-core reads window.origin otherwise
});
```

## Key behaviors

| You call | In-page (same page) | Cross-page (different page) |
| --- | --- | --- |
| `router.navigate({ to })` | memory-history push/replace | `host.open()` → native page open |
| `router.history.back()` | local pop | `host.close()` → native pop |
| initial location | seeded from `getInitialHref()` | same — each page boots from its launch params |

`__TSR_index` is seeded with the native stack depth so `canGoBack()` /
`useCanGoBack()` stay correct across page boundaries. Navigation blockers run
with **no** global `document` (unlike `@tanstack/history`, which gates blocker
execution on `typeof document !== 'undefined'`).

## Tests

`pnpm --filter sparkling-history test` — 28 tests: in-page parity with
`@tanstack/history`'s memory history (ported verbatim), MPA boundary behavior,
and sparkling scheme round-tripping, all in a plain node environment.

## Stack events & results (host event face)

`NavigationHost` has an optional event face for the full "JS drives native
containers" protocol:

- `host.subscribeStack(cb)` — observe native stack changes
  (`push` / `pop` / `replace` / `container-back`), each carrying the new
  depth and an optional pop `result`.
- `history.closePage({ result })` — close this page's container and hand a
  result to the page below (the MPA analogue of `setResult`).
- `createStackMirror(host)` — a read-only, `useSyncExternalStore`-compatible
  snapshot of the native stack; `mirror.live` tells you whether the host
  actually broadcasts events.

The **memory host implements the whole protocol** and serves as its
executable specification (`tests/stack-events.test.ts`). The **sparkling
binding is command-only for now** — the native SDK does not broadcast stack
changes or transport close payloads yet — so feature-detect and degrade.
