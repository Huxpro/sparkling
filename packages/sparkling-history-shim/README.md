# sparkling-history-shim

DOM `history` / `location` / `popstate` / `URL` emulation on top of a
pluggable native navigation host. This is the layer that lets web routers
(Next.js App Router, React Router, TanStack Router, …) drive **native
multi-page navigation**: same-page navigations stay in a virtual per-view
history, page-crossing navigations become `host.open(scheme)`, and backing
out of the bottom of the virtual stack becomes `host.close()`.

The shim has **zero routing knowledge** — a `UrlResolver` injected by the
routing layer decides what is same-page / cross-page / external — and
**zero Sparkling coupling** in its core. `sparkling-history-shim/sparkling-host`
provides the `NavigationHost` implementation over `sparkling-navigation`
(Android, iOS, and the web shell).

```ts
import { createNavigationShim } from 'sparkling-history-shim'
import { createSparklingHost } from 'sparkling-history-shim/sparkling-host'

const shim = createNavigationShim(createSparklingHost(), myResolver)

shim.history.pushState(null, '', '/products/42')  // → router.open(...) if cross-page
shim.history.back()                                // → native back at stack bottom
shim.events.addEventListener('popstate', onPop)    // virtual traversal events
shim.location.href                                 // 'sparkling://app/products/42'
```

See `packages/sparkling-next-router/docs/design.md` for the full layering
rationale and `docs/nextjs-dom-dependency-catalog.md` for the API surface
audit this package is derived from.
