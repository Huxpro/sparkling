# TanStack Router on Sparkling (native MPA navigation)

This guide describes how [TanStack Router](https://tanstack.com/router) is
ported onto Sparkling so that it drives **native multi-page navigation** — each
page is a separate LynxView with its own JS context, and navigating between
pages is a native container open, not an in-memory route transition.

It covers the design, the reusable shim layer, the exact feature support
matrix (what works, what cannot, and why), the shims ReactLynx needs, and a
comparison with TanStack Router's own React Native effort.

> Status: experimental. In-page routing is verified live in the
> [go-web web preview](./examples/tanstack-router); the reusable history layer
> (`sparkling-history`) and the demo (`tanstack-router-demo`) are the
> deliverables.

## The problem: MPA, not SPA

ReactLynx already supports TanStack Router / React Router **inside a single
LynxView** using a memory history — a classic SPA: one router, one JS heap,
routes swap components in place.

Sparkling navigation is different. Each `sparkling-navigation.open` opens a new
native container (a new Activity/Fragment on Android, a `SPKViewController` on
iOS), and **each container runs its own LynxView with its own JS context**.
There is no shared `window`, `history`, `location`, or JS memory across pages.
This is an MPA (multi-page app) model, like a mini-app platform.

So a router that drives Sparkling navigation cannot keep one in-memory history
stack. Two consequences shape the whole design:

1. **Pages are connected out-of-band.** The only inbound channel to a
   freshly-opened page is the scheme's query string, surfaced as
   `lynx.__globalProps.queryItems` (strings only). Routes are therefore
   connected via **pre-generated file-based metadata** (a route→page manifest),
   not shared objects.
2. **Each page boots its own router** at an initial location derived from its
   launch params. The native back stack is owned by the container, not JS.

## Layered architecture

The design deliberately separates three concerns so the bottom layer can back
other routers and other host platforms in the future.

```
        TanStack Router  (or React Router, or your own)
                    │  consumes a RouterHistory
        ┌───────────▼────────────┐
        │     createMpaHistory     │   web-history shim  ← the reusable core
        └───────────┬────────────┘
                    │  calls a NavigationHost (an API contract)
   ┌────────────────▼──────────────────┐
   │  createSparklingHost / your host    │   platform binding
   └────────────────┬──────────────────┘
                    │
        sparkling-navigation → native container open/close
```

All three live in the **`sparkling-history`** package.

### 1. `NavigationHost` — the API contract

The contract any container platform implements:

```ts
interface NavigationHost {
  getInitialHref(): string;            // app-relative href this page launched with
  getStackDepth?(): number;            // native stack depth (0 = root)
  getInitialState?(): unknown;         // state handed over by the opener
  open(target: HostOpenTarget): void | Promise<HostNavigationResult>;
  close(opts?: HostCloseOptions): void | Promise<HostNavigationResult>;
}
```

This is the layering boundary that matters: **anything** that can report the
URL/stack it launched with, open a page for an href, and close itself can host
a URL-driven router. Sparkling is one implementation; a plain browser window,
a test double (`createMemoryHost`), or a future platform are others.

### 2. `createMpaHistory` — the web-history shim

Implements the `RouterHistory` shape from `@tanstack/history` (so its result is
a drop-in for `createRouter({ history })`), over a `NavigationHost`:

- **In-page navigation** (destination resolves to the *current* page) behaves
  exactly like `@tanstack/history`'s memory history — push/replace/back/forward
  on a local entry stack, with subscriber notifications. Ported memory-history
  tests pass verbatim.
- **Cross-page navigation** (destination resolves to *another* page, decided by
  a `PageResolver`) is forwarded to `host.open(...)`; the local stack is left
  untouched (the current page keeps rendering until the container covers or
  replaces it — document-navigation semantics).
- **`back()` at the local root** becomes `host.close()` — a native pop.
- **`__TSR_index`** is seeded with `host.getStackDepth()`, so `canGoBack()` and
  `useCanGoBack()` stay correct on a pushed page even at its local root.
- **Navigation blockers run with no `document`.** `@tanstack/history` gates
  blocker execution on `typeof document !== 'undefined'`; the shim does not, so
  `useBlocker` works in a native Lynx JS context.

### 3. `createSparklingHost` — the sparkling binding

Turns a cross-page open into a Sparkling scheme:

```
hybrid://lynxview_page?bundle=detail.lynx.bundle
  &title=Detail            ← static container config (from the manifest)
  &__mpa_href=/detail/42?ref=home   ← the router's destination href
  &__mpa_depth=1                    ← native stack depth
  &__mpa_state=%7B...%7D            ← serialized navigation state
```

and reconstructs the destination page's **initial location** from its launch
`queryItems`. `options.replace` maps to Sparkling's `open` + `replace`
semantics; `close()` maps to `router.close`. The scheme is assembled with
plain string building (`encodeURIComponent`, spaces as `%20` — native URL
parsers reject `+`): the native Lynx runtime has **no `URL`/`URLSearchParams`
globals**, so the host must not depend on them.

**Deep links**: when a bundle is opened externally (a scheme without
`__mpa_href`), the host falls back to the page's own default route
(`defaultHref`, derived from the manifest via `defaultHrefForPage`) — never
to `/`, which would render the root page's UI inside the wrong container.

**Note on bundle size (demo simplification)**: every page bundle currently
carries the *full* route tree — the generator emits per-page entries but does
not yet prune each page's subtree, so bundle size grows linearly with page
count. Subtree splitting per page boundary is the next step for the MPA
codegen, not a property of the design.

### File-based route manifest

Because pages cannot share memory, the route→page mapping is a build-time
artifact — the same idea as TanStack's generated `routeTree.gen.ts`, extended
with a page dimension. `createManifestPageResolver(manifest)` builds the
`PageResolver` from it:

```ts
const manifest = {
  pages: [
    { id: 'home', paths: ['/', '/profile'] },       // one bundle, two routes
    { id: 'detail', paths: ['/detail'], containerParams: { title: 'Detail' } },
    { id: 'settings', paths: ['/settings'] },
  ],
};
```

The longest matching path prefix wins; if the destination page equals the
current page, navigation stays in-page.

## File-based routing: reusing TanStack's compile-time toolchain

TanStack Router's file-based routing has a **compile-time half** that is fully
reusable in a Rspeedy/Rspack/ReactLynx project — verified end-to-end in the
demo. It splits into three official pieces plus one MPA-specific piece we add.

**What we reuse as-is (official):**

- **`@tanstack/router-generator`** turns the `src/routes/*` file convention
  (`createFileRoute('/path')`) into `src/routeTree.gen.ts` — the fully-wired,
  fully-typed route tree. It is pure Node (no bundler, no DOM) and runs
  standalone (`new Generator({ config, root }).run()`).
- **`@tanstack/router-plugin/rspack`** composes into the Rspeedy build via
  `tools.rspack` **alongside `pluginReactLynx`**. `TanStackRouterGeneratorRspack`
  (generator-only) regenerates the tree on build and watch — verified by
  deleting `routeTree.gen.ts` and rebuilding.
- **Code-splitting** (`TanStackRouterRspack` with `autoCodeSplitting: true`)
  **also composes**: the build emits a separate async chunk per route
  component and the lazy chunks **load and render at runtime in the Lynx web
  worker** (verified in the go-web web preview). The demo keeps it *off* by default: on an
  MPA each page is already its own bundle, so per-page bundling gives most of
  the benefit, and native async-chunk loading (vs the web worker) is not yet
  verified.

**What TanStack does not provide — the MPA dimension (`scripts/gen-mpa.mjs`):**

The official generator assumes *one router = one bundle*. An MPA needs two more
artifacts derived from the **same** route files:

1. `src/routes.manifest.ts` — the route→page (bundle) mapping.
2. one bundle entry per native page (`src/pages.gen/<id>/index.tsx`), wired into
   `source.entry`.

Page boundaries are declared inline in a route file — our extension to the
convention:

```ts
// src/routes/detail.$id.tsx
export const page = { id: 'detail', containerParams: { title: 'Detail' } };
export const Route = createFileRoute('/detail/$id')({ /* ... */ });
```

Routes without a `page` export belong to the root page (the one whose `page`
has `root: true`). `gen-mpa.mjs` reads these markers and emits the manifest and
entries; `createManifestPageResolver` consumes the manifest at runtime. The
whole pipeline (`pnpm codegen`) is wired into build/dev/pretest, so
`routeTree.gen.ts` + `routes.manifest.ts` + entries regenerate from the route
files alone.

## What a navigation actually does

From the demo (`packages/tanstack-router-demo`) — in-page rows run live in the
go-web web preview; cross-page rows are native `router.open`/`close`:

| Action | Location change | Under the hood |
| --- | --- | --- |
| Home → Profile | `/` → `/profile` | in-page (same `home` bundle): memory-history transition, no native open |
| Home → Detail #42 | `/` → `/detail/42?ref=home` | cross-page: `navigate()` → `host.open` → `router.open` → new LynxView; params ride the scheme |
| Detail #42 → #43 | `/detail/42` → `/detail/43` | in-page (same `detail` bundle) |
| Detail → Back | pop | `history.back()` at page root → `host.close` → native pop |

Path params (`id`) and validated search params (`ref`) cross the JS-context
boundary via the scheme query and are read back from `queryItems` in the
destination page.

## Feature support matrix

Legend: **✅ Supported** (works, with a test/example) · **⚠️ Supported in-page
only** (works within a page's JS context, not across the native page boundary)
· **❌ Not supported** (blocked by the MPA model or by DOM-only dependencies).

Every ✅/⚠️ below is backed by a passing test in
`packages/tanstack-router-demo/tests/router-features.test.ts` (headless, real
router, no DOM) or `packages/sparkling-history/tests/*` unless noted.

### Routing core — fully supported

| Feature | Status | Notes / evidence |
| --- | --- | --- |
| Nested routes & `<Outlet>` | ✅ | Pure route-tree matching; renderer-agnostic. `nested routes + outlet` test. |
| Layout / pathless routes | ✅ | `id`-only routes participate in the match chain. |
| Path params (`$id`, splat) | ✅ | `path params` test; `id=42` crosses the page boundary in the demo. |
| Validated search params | ✅ | `validated search params` test. Default parser coerces `n=7` → number. |
| Loaders + `loaderDeps` | ✅ | `loaders run` test. Timers/`AbortController`, no DOM. |
| `beforeLoad` + router context | ✅ | `beforeLoad + route context` test. |
| Redirects (`redirect()`) | ✅ | `redirect() in beforeLoad` test (internal redirects). |
| `notFound()` | ✅ | `notFound()` test — surfaces a `notFound` match. |
| Error boundaries | ✅ | `loader errors` test; demo uses `defaultErrorComponent`. |
| Imperative `navigate()` | ✅ | `imperative navigate()` test. |
| Route masking | ✅ | `route masking` test — real vs `maskedLocation`. State-smuggled in history state. |
| `useBlocker` / navigation blocking | ✅ | Works **with no DOM** — the shim removes `@tanstack/history`'s `document` gate. `blocking works with no DOM` test. |

### MPA-specific — supported through the shim

| Feature | Status | Notes / evidence |
| --- | --- | --- |
| In-page (SPA) navigation | ✅ | Memory-history parity; `in-page.test.ts` (11 ported tests). |
| Cross-page native open | ✅ | `navigate()` → `host.open`. `cross-page open` test + demo. |
| Cross-page `replace` | ✅ | Maps to Sparkling `open` + `replace`. `mpa.test.ts`. |
| Native pop (back) | ✅ | `history.back()` at root → `host.close`. Verified in demo. |
| Cross-page param/state transport | ✅ | Via scheme query → `queryItems`; JSON state via `__mpa_state`. `sparkling-host.test.ts`. |
| `canGoBack()` across pages | ✅ | `__TSR_index` seeded from native stack depth. `mpa.test.ts`. |

### Preloading & transitions — partial

| Feature | Status | Notes |
| --- | --- | --- |
| `preload: 'render'` | ✅ | Mount-time effect, no DOM. |
| `preload: 'intent'` (hover/focus) | ⚠️ | Needs host pointer/focus events + timers. Works within a page where Lynx exposes tap/focus; there is no cross-page hover. |
| `preload: 'viewport'` | ❌ | Needs `IntersectionObserver` (guarded no-op on Lynx). |
| Cross-page loader prefetch | ❌ | The destination loader lives in a different JS context that has not booted. Prefetching moves to the native/shell layer. |
| Pending/`defer`/`Await` (in-page) | ⚠️ | Promise + Suspense based; works within a page. SSR streaming variant (`react-dom/server`) is N/A. |
| Cross-page pending UI | ❌ | No `pendingMatches` transition across pages — the native container shows its own loading screen while the new VM boots. |
| Auto code-splitting (in-page lazy chunks) | ⚠️ | `router-plugin`'s `autoCodeSplitting` builds and the lazy chunks load/render in the go-web web preview. Off by default: on an MPA each page is already its own bundle, and native async-chunk loading is unverified. |

### DOM-bound / SSR — not supported (by platform)

| Feature | Status | Reason |
| --- | --- | --- |
| Scroll restoration | ❌ | `sessionStorage` + `document` + `scrollTo` — DOM-only. Keep `scrollRestoration` off; scrolling is per-element on Lynx. The env shim no-ops the bare `scrollTo` router-core calls. |
| View Transitions | ❌ | `document.startViewTransition` (guarded → plain fallback). Native transitions are the container's job. |
| `<Link>` as an `<a>` element | ❌ | `<Link>` renders an anchor and intercepts DOM clicks. Use `useNavigate()` + Lynx `bindtap` instead (the demo does). `<Link>`'s href-building logic is reusable; its rendering is not. |
| `reloadDocument` navigation | ❌ | Uses `window.location`. Use a cross-page open instead. |
| SSR / hydration | ❌ | `react-dom/server`, streaming, `window.$_TSR` — not applicable. |
| Devtools | ❌ | Solid-rendered floating DOM panel + `window.__TSR_ROUTER__`. |

### Cross-page limitations inherent to MPA

These are **not** shim gaps — they follow from pages being separate JS
contexts, and are the fundamental difference from the SPA model:

- **No shared in-memory router state across pages.** A loader's data on one
  page cannot flow into another page's component; the only channel is the
  URL/`queryItems` (or a native KV bridge). TanStack's typed search params are
  the recommended way to type that channel.
- **The back stack is native-owned.** JS cannot read it, cannot `go(-3)` across
  pages (only one native `close` per `back`), and cannot block a
  hardware/gesture back — only JS-initiated navigation is blockable.
- **Return values and stack observation need a native event face.** The
  `NavigationHost` contract now specifies one — `history.closePage({ result })`
  hands a result to the page below, `host.subscribeStack` broadcasts
  `StackChangedEvent`s (push/pop/replace/`container-back`, with depth and
  result), and `createStackMirror(host)` exposes a read-only, subscribable
  snapshot of the native stack. The **memory host implements the full
  protocol** (it is the executable spec, covered by `stack-events.test.ts`);
  the **sparkling binding is command-only today** because the native SDK
  neither broadcasts stack changes nor carries a close payload. Consumers
  must feature-detect via `mirror.live` / the absence of `subscribeStack` and
  degrade. Growing this event face in the native SDK (a container registry +
  a global stack-changed event) is the key next step for the platform.

## Running TanStack Router on ReactLynx: the shims

ReactLynx is a Preact-based custom renderer with **no `react-dom` and no DOM
globals**. TanStack Router runs unmodified once four bundler-level shims are in
place (see `packages/tanstack-router-demo/lynx.config.ts` and `src/shims/`) —
**no fork of TanStack Router is required**:

1. **`react$` alias** — adds `startTransition`/`useTransition` (from
   `@lynx-js/react/compat`) and a `use` binding that TanStack's dist links
   against by name (ESM strict linking needs the binding to exist; `use` is
   React-19-only and TanStack falls back when it is `undefined`).
2. **`react-dom$` alias** — provides `flushSync` (`fn => fn()`). This is the
   *only* react-dom symbol in TanStack Router's client entry (used by `<Link>`
   to flip transition state synchronously).
3. **`use-sync-external-store/shim*`** → `@lynx-js/use-sync-external-store`
   (Lynx's build of the store subscription primitive).
4. **`env.ts` globals** — `url-search-params-polyfill` (**required**:
   TanStack Router parses/serializes search params with `URLSearchParams`,
   which the native Lynx runtime does not provide — Node tests and browser
   previews have it natively, so its absence only surfaces on device),
   `scrollTo` (router-core resets scroll on every navigation even with
   `scrollRestoration` off), plus `AbortController` / `queueMicrotask`
   fallbacks for runtimes that lack them.

Two router options are also required:

- `isServer: false` — otherwise a document-less runtime is treated as a server
  and nothing re-renders.
- `origin: '<any-url>'` — router-core reads a bare `window.origin` when
  `isServer` is false, which throws `ReferenceError` in a native Lynx runtime.

## Web preview (go-web) and what it can show

The demo is embedded on the website as a live [go-web](./examples/tanstack-router)
example. The go-web web preview renders a Lynx `*.web.bundle` in the browser but
**does not run the Sparkling native bridge** (the same limitation as every other
Sparkling example — see the [Examples overview](./examples)). That maps cleanly
onto this integration:

- **In-page routing runs live** in the preview — the spike's Home↔About and the
  MPA `home` bundle's Home↔Profile are `createMpaHistory` in-memory transitions
  with no `pipe.call`, so they work in the browser.
- **Cross-page navigation is a native `router.open`** — in the preview it is a
  graceful no-op (the bridge returns "not available"); on device (QR tab) it
  opens the destination page's bundle. This was verified end-to-end earlier on
  an experimental web method-bridge harness (a shell that turns `router.open`
  into a `<lynx-view>` swap); that bridge is orthogonal to go-web and is not
  part of this branch.

## Comparison with TanStack Router's React Native adapter

TanStack has an official **experimental** React Native adapter
(`@tanstack/react-native-router`, alpha; draft PR #7622 by Tanner Linsley — not
merged or published beyond a `0.0.1` placeholder as of mid-2026). It is worth
comparing because it solves the same "web router, native screens" problem from
the **opposite** architectural starting point.

### How theirs works

- **Single JS context, one router.** The whole app is one React tree in one
  Metro bundle/VM. `Router` extends the same `RouterCore` as web. The native
  screen stack (`react-native-screens`, driven directly — not react-navigation)
  is a **projection** of the router's in-memory history.
- **In-memory history** (`createNativeHistory`) with native reconciliation:
  swipe/hardware back is reconciled *after* the native transition via
  `onDismissed → history.back()`.
- **Native-first extensions**: per-route `native` options (presentation,
  animation, header) resolved from route + loader data *before* navigating;
  `stackBehavior: reuse` (singleTop-like) computed in `router-core`; a
  lifecycle policy (`active`/`paused`/`detached`) that even removes deep
  screens from the native stack (`<Activity mode="hidden">`) to fight one-heap
  memory growth.

### What is reusable for us

Their design is mostly *runtime-coupled* to the single heap, but several ideas
are pure data/protocol design and transplant directly:

- **URL-as-screen-identity with no address bar** — they prove the full web
  routing contract (path + typed params + validated search) works when the URL
  is virtual. That is exactly our inter-page contract.
- **`resolveNativeNavigateOptions`** computes header/presentation/animation
  from route options **before** the destination renders — precisely what a
  native container needs to configure a page window before its VM boots. Our
  manifest's `containerParams` is the same idea; theirs is richer.
- **Stack-semantics vocabulary** (`push`/`replace`/`reuse` + `getId` +
  `stackMatch`) maps one-to-one onto native launch modes and could live in our
  manifest.
- **Detached-screen lifecycle** — their "detached" (drop the screen, keep the
  history entry, re-materialize on pop) is, in an MPA, literally killing and
  respawning a page VM; their design tells us the minimal resurrection state is
  *href + history-entry state*, which is what we transport via `__mpa_*`.

### Their advantages (single heap)

- Shared router state: a screen's `loaderData` can drive another screen's
  native header. Impossible across VMs without a serialization protocol.
- In-JS loader pipeline, pending transitions (`pendingMatches`), `preloadRoute`
  across screens, and a JS-owned back stack (`go(n)`, masks, blockers, full
  introspection).
- One compilation unit → end-to-end type safety and TanStack Start server
  functions.

### Our advantages (separate VMs / MPA)

- The native stack is the **source of truth**, not a projection — gestures,
  predictive back, and transitions are correct by construction (no
  reconcile-after-the-fact desync).
- **Per-page VM isolation**: crash and memory containment; reclaiming memory is
  just killing the VM (their "detached", but real). Pages can be prewarmed /
  parallel-loaded and can version/deploy independently (the mini-app property).
- The **shim is router-agnostic and host-agnostic** — the `NavigationHost`
  contract can back React Router or a custom router, and can target hosts other
  than Sparkling.

### Our limitations (the mirror image)

- No shared in-memory state, no cross-page loader prefetch inside JS, no
  cross-page `go(n)`/blocking, no cross-page pending/Suspense transition, and
  type safety across pages needs a shared generated manifest instead of one
  compilation unit. Every page pays router/framework boot cost in its own VM.

### Net

Both converge on the same substrate (a web-grade, URL-centric router core
driving native screens). Theirs optimizes for a shared heap and rich in-JS
navigation; ours optimizes for native-owned, isolated page containers. The
`sparkling-history` layer is what makes the router core reusable in the MPA
world their adapter does not target.

## Packages & files

- `packages/sparkling-history` — the reusable shim (contract + history +
  sparkling host + manifest resolver). 28 tests.
- `packages/tanstack-router-demo` — the spike, the file-based multi-page MPA
  demo, and the headless tests (16: feature matrix + generated-tree).
  - `src/routes/*` — file-based routes (official convention + `page` markers).
  - `scripts/codegen.mjs` — runs the official generator + `gen-mpa.mjs`.
  - `scripts/gen-mpa.mjs` — MPA manifest + per-page entries codegen.
  - `src/routeTree.gen.ts` (official generator), `src/routes.manifest.ts` +
    `src/page-entries.gen.ts` + `src/pages.gen/*` (MPA codegen).
- Website embed: `docs/en/guide/examples/tanstack-router.mdx` (the live `<Go>`
  example), registered in `packages/website/scripts/prepare-examples.mjs`.
