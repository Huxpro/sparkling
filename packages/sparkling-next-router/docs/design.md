# Design: Next.js App Router on Sparkling Navigation (MPA)

Companion to [nextjs-dom-dependency-catalog.md](./nextjs-dom-dependency-catalog.md).

## Problem shape

ReactLynx already supports SPA routers (TanStack Router, React Router in
memory mode) *inside one LynxView*. This project is the opposite shape:
**the router drives sparkling-navigation**, so each route is its own
native page (own LynxView, own JS heap), navigation between routes is
native push/pop, and back is the native back gesture/button.

Because two routes never share a heap, the only way to "link" them is
**ahead-of-time metadata**: a route manifest generated from the Next.js
`app/` file convention, compiled into *every* page bundle, plus a
serialization format (the sparkling scheme URL) that carries navigation
state across the boundary.

## Layering (the load-bearing decision)

```
┌──────────────────────────────────────────────────────────┐
│  L2  sparkling-next-router                                │
│      app/ convention scan → route manifest + entry codegen│
│      next/navigation-compatible hooks, <Link>, boundaries │
├──────────────────────────────────────────────────────────┤
│  L1  sparkling-history-shim          (reusable, no Next)  │
│      history / location / popstate / pageshow / URL       │
│      virtual per-view history stack + cross-page policy   │
│      via an injected UrlResolver                          │
├──────────────────────────────────────────────────────────┤
│  L0  Host Navigation Contract        (interface only)     │
│      open(scheme) · close() · initialUrl · show/hide      │
│      implemented by: sparkling-navigation (Android/iOS/   │
│      web shell today) · anything else tomorrow            │
└──────────────────────────────────────────────────────────┘
```

- **L1 is the reusable deliverable.** Any router framework that talks to
  DOM `history`/`location`/`popstate`/`URL` (per the catalog, that is the
  entire navigation surface of Next's app router, and it is also true of
  React Router / TanStack Router browser histories) runs on L1 without
  knowing about Sparkling.
- **L0 keeps L1 portable beyond Sparkling.** The contract is four
  capabilities; Sparkling's `router.open`/`router.close` +
  `globalProps.queryItems`/`containerID` satisfy it on all three platforms.
- **L2 owns everything Next-specific** — the file convention, the manifest,
  the hook surface — and is the only layer that knows what a "route" is.

## L0 — Host Navigation Contract

```ts
export interface NavigationHost {
  /** Open a new container for `scheme`. Resolves when accepted by the host. */
  open(scheme: string): Promise<void>
  /** Pop the current container off the native stack. */
  close(): Promise<void>
  /** The scheme URL this container was opened with (incl. query params). */
  initialUrl(): string
  /** Container identity (diagnostics, state keys). */
  containerId(): string
  /** Visibility lifecycle; used for pageshow/pagehide emulation. Optional. */
  onShow?(cb: () => void): () => void
  onHide?(cb: () => void): () => void
  /** Hard-reload the current container. Optional. */
  reload?(): void
}
```

`createSparklingHost()` implements this over `sparkling-navigation`'s
`open`/`close` and `lynx.__globalProps` (`queryItems`, `containerID`).

## L1 — sparkling-history-shim

Exports `createNavigationShim(host, resolver, options)` returning:

```ts
{
  history: ShimHistory        // pushState/replaceState/back/forward/go/state/length
  location: ShimLocation      // href/origin/pathname/search/hash/assign/replace/reload
  events: ShimEventTarget     // addEventListener('popstate' | 'pageshow' | 'pagehide')
  installGlobals(target?)     // optional: attach as window.history/window.location…
}
```

### URL model

The app lives on a **synthetic origin** (default `sparkling://app`).
`location.href` is e.g. `sparkling://app/products/42?tab=specs`.
`isExternalURL`-style checks (`url.origin !== location.origin`) therefore
classify real web URLs as external — exactly the Next behavior we want,
and external URLs pass through to `host.open(url)` untouched so sparkling
scheme handling (webview fallback, deep links) applies.

### The one policy injection: `UrlResolver`

```ts
type Resolution =
  | { kind: 'same-page' }                     // stays in this LynxView
  | { kind: 'cross-page'; scheme: string }    // new native page
  | { kind: 'external'; url: string }         // not ours; host passthrough

interface UrlResolver {
  resolve(url: URL, current: URL): Resolution
}
```

The shim contains **zero** routing knowledge. L2 supplies a resolver backed
by the generated manifest ("different page bundle ⇒ cross-page, and here is
its scheme"). A non-Next consumer can supply "everything same-page" and get
a pure in-view history, or its own mapping.

### Semantics

| DOM intent | same-page | cross-page |
| --- | --- | --- |
| `pushState(state,'',url)` | append virtual entry, update `location`; no event (matches browser) | `host.open(scheme)`; current entry stays — native back returns to it |
| `replaceState` | replace virtual entry | `host.open(scheme, { replace: true })` — a replace-capable open (native `OpenOptions.replace`; web shell `history.replaceState`). Not open+close: `close()` pops the just-opened container, which would cancel the nav and loop redirects. |
| `back()` | cursor>0 ⇒ virtual traverse + `popstate` | cursor==0 ⇒ `host.close()` |
| `forward()` / `go(+n)` | virtual traverse + `popstate` if a forward entry exists | ❌ no cross-page forward (native stacks have no forward); no-op + dev warning |
| `location.assign/replace` | n/a — always treated as hard navigation | `host.open` (+ `close` for replace) |
| `location.reload()` | `host.reload()` or re-boot the view root | — |
| return-to-page (child popped) | `pageshow {persisted:true}` emitted via `host.onShow` | — |

### State across the boundary

`history.state` for a **cross-page** push is serialized into the target
scheme as a reserved query param (`__shim_state`, JSON, size-capped with a
dev warning) and rehydrated as the initial entry state of the new view.
Intra-view state lives in heap (no serialization limits) — same split as
browsers (struct-clone in memory vs URL).

Reserved scheme params: `__shim_route` (canonical in-app URL of the target,
so the new page knows its `location` even when several routes share one
bundle), `__shim_state`. Everything else in the app URL's search string is
forwarded verbatim so it shows up both in `location.search` and — via the
scheme — in native `queryItems`.

### `URL` / `URLSearchParams`

Feature-detected; a spec-subset polyfill (WHATWG parsing for
scheme/host/path/search/hash, `searchParams` mutation, relative
resolution) is installed only when the runtime lacks them.

## L2 — sparkling-next-router

### Build time (`withNextAppRouter` rspeedy helper)

1. Scan `app/`: `page.{tsx,jsx,ts,js}`, nested `layout.*`, `[param]`,
   `[...catchAll]`, `[[...optional]]`, `(group)` (ignored in URL),
   `not-found.*`, `loading.*` (used as instant placeholder while a pushed
   page's bundle loads, when the host supports it).
2. Emit `.sparkling/next-router/`:
   - `route-manifest.ts` — `[{ pattern, regexSource, paramNames, bundle, hasCatchAll }]`
   - one generated entry file per route: statically imports the layout
     chain + page, wraps in `<SparklingNextRoot manifest route=…>`,
     calls ReactLynx `root.render`.
3. Contribute `source.entry` mappings to the rspeedy config. Output stays
   ordinary `[name].lynx.bundle` files — no bundler fork needed. (We do not
   use `next-rspack`: that plugin builds *Next.js apps* — RSC graph, HTML —
   whereas Lynx bundles are rspeedy environments; what we need from the
   convention is the file scan + manifest, which we implement directly.
   Escalation path if we ever need Next's own transforms: fork at the
   loader level, not the runtime.)

Route → bundle naming: `/` → `index`, `/products/[id]` → `products/_id_`
flattened to `products__id_` (bundle names are flat), recorded in the
manifest so nothing outside codegen depends on the naming scheme.

### Runtime

`<SparklingNextRoot>` (per-entry):

1. `createSparklingHost()` → `createNavigationShim(host, manifestResolver)`.
2. Initial URL: `__shim_route` param if present, else the route's static
   pattern + forwarded queryItems.
3. Match params from the manifest regex → `PathParamsContext`.
4. Provide `AppRouterContext` with a router instance implementing
   `push/replace/back/forward/refresh/prefetch` in terms of the shim
   (never the host directly).
5. Provide `PathnameContext` / `SearchParamsContext` recomputed on shim
   `popstate`/`pushState`.
6. Error boundaries translate thrown `redirect()`/`notFound()` into
   router actions / not-found UI (same error-digest protocol as Next:
   `NEXT_REDIRECT;push|replace;url;307;` / `NEXT_HTTP_ERROR_FALLBACK;404`).

Applications import from **`sparkling-next-router/navigation`**, which is
API-compatible with `next/navigation` (`useRouter`, `usePathname`,
`useSearchParams`, `useParams`, `redirect`, `permanentRedirect`,
`notFound`, `ReadonlyURLSearchParams`). For code written against
`next/navigation` literally, the rspeedy helper adds a bundler alias
`next/navigation → sparkling-next-router/navigation` — so ported Next
examples compile unmodified. (We alias rather than load `next/dist`
modules on Lynx to keep PrimJS bundles free of Next's module graph; the
error-digest wire formats match, so libraries relying on those still work.)

`<Link>` renders a `<view>` with `bindtap → router.push/replace`; the
`legacyBehavior`, `passHref`, `target`, modifier-click, and drag semantics
of anchor tags are inapplicable on Lynx and documented as such in the
compatibility matrix.

### What stays out (and why) — summary for the matrix

- **RSC / Server Components / Server Actions / streaming**: every route
  bundle is fully client-rendered in its own LynxView; there is no Next
  server in the loop. (`"use client"` semantics are effectively global.)
- **Soft navigation with shared layout instances**: layouts re-mount per
  page because pages don't share heaps — this is *the* MPA trade. Layout
  *code* is shared; layout *state* is not. (Mitigation: sparkling storage
  / globalProps for cross-page state, out of scope here.)
- **`forward()` across pages, prefetch-rendered `<Link>` hover states,
  hash-scroll, `router.refresh()` re-fetching server data**: see matrix.
