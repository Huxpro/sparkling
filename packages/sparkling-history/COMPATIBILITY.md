# Vue Router × Sparkling MPA — Compatibility Matrix

This is the acceptance deliverable: a full traversal of Vue Router's official
feature set (the [guide](https://router.vuejs.org/guide/) essentials +
advanced pages, and the repo's `e2e/` examples), answering for **each
feature** whether it can be supported when Vue Router drives **Sparkling
multi-page native navigation** — and, where it can't, exactly why.

## How to read this

The central fact of this integration is that navigation splits into two
regimes:

- **In-heap (SPA)** — the target route is owned by the **current** page
  bundle. This is a normal Vue Router transition inside one JS heap. The shim
  does not touch it, so Vue Router behaves exactly as documented.
- **Cross-heap (MPA)** — the target route is owned by **another** bundle. The
  shim diverts it to a native `router.open`, stacking a new container with its
  own heap. Nothing but a URL crosses the boundary.

A feature is "supported" when it works in the regime it belongs to. Several
features are **reframed** by MPA: they still work, but their mechanism moves
from Vue's runtime to the native platform (this is a feature, not a gap — it
is what "native navigation" means).

Legend: ✅ supported & validated · 🟦 supported in-heap (Vue-native pass-through)
· 🔀 reframed by MPA (works, semantics move to native) · ⚠️ partial/conditional
· ❌ not supported (reason given)

Validation column points at where the claim is exercised:
`history.spec` / `cross-container.spec` / `vue-adapter.spec` /
`vue-features.spec` are unit suites in `src/__tests__`; **e2e** is the
Playwright run against the web shell driving `packages/playground-vue`.

---

## Essentials

| # | Feature | Regime | Status | Validation & notes |
|---|---------|--------|--------|--------------------|
| 1 | **Dynamic Route Matching** (`/users/:id`) | in-heap | ✅ | `vue-features.spec` (params), **e2e** (`params.id decoded`, sibling param nav). Cross-bundle dynamic targets resolve via the manifest and re-parse in the new heap. |
| 2 | **Routes' Matching Syntax** (custom regex, repeatable `+`/`*`, optional `?`) | in-heap | 🟦 | Runs in Vue Router's own matcher, unchanged. The *manifest* matcher (ownership only) supports static, `:param`, and trailing catch-all — enough to route to the owning bundle; the owning bundle's router then applies the full syntax. |
| 3 | **Named Routes** | both | ✅ | `vue-adapter.spec` (cross-bundle named), **e2e** (`named route opened other bundle`). Cross-bundle names resolve through the manifest (`findByName` + `fillPattern`) since the local matcher can't see them. |
| 4 | **Named / multiple `<router-view>`** | in-heap | 🟦 | `vue-features.spec` (`components: { default, sidebar }`). A record's named views live in one heap; there is no cross-heap named view (each container is a separate document). |
| 5 | **Nested Routes** | in-heap | 🟦 | `vue-features.spec` (matched chain length 2). Nesting is intra-bundle; to nest *across* bundles you open a child container instead. |
| 6 | **Programmatic Navigation** (`push`/`replace`/`go`/`back`/`forward`) | both | ✅ | `history.spec`, `vue-adapter.spec`, **e2e**. `go(-n)` consumes the local queue first, then pops native containers (see §Limitations for forward). |
| 7 | **Redirect** (string / named / function) | in-heap | 🟦 | `vue-features.spec` (string + function redirect). A redirect whose target is another bundle is diverted to a native open like any push. |
| 8 | **Alias** | in-heap | 🟦 | `vue-features.spec` (`aliasOf` link). |
| 9 | **Passing Props to Route Components** (`props: true`/object/function) | in-heap | 🟦 | Pure Vue Router feature, untouched by the shim. Cross-heap "props" become URL query / history state instead. |
| 10 | **Active links** (`router-link-active`, exact-active) | in-heap | ⚠️ | Active-class logic works via `useLink`, but see #12 for `<RouterLink>` rendering on Lynx. Active state is per-heap; a link can't be "active" for a route living in another container. |
| 11 | **History Modes** (`createWebHistory` / `WebHashHistory` / `MemoryHistory`) | — | 🔀 | **Replaced** by `createHybridHistory`. The three stock histories assume one heap + browser APIs; this integration supplies its own history. (Memory history remains the right choice for pure in-`LynxView` SPA — the VueLynx model.) |
| 12 | **`<RouterLink>`** default rendering | in-heap | ⚠️ | `<RouterLink>` renders `h('a', { href, onClick })`; **Lynx has no `<a>` element**. Use `<RouterLink custom v-slot>` (bind `@tap="navigate"`) or `useLink`, exactly as VueLynx examples do. This is a Lynx platform constraint, independent of MPA. The demo uses programmatic navigation + a `NavButton`. |

## Advanced

| # | Feature | Regime | Status | Validation & notes |
|---|---------|--------|--------|--------------------|
| 13 | **Navigation Guards** — global `beforeEach`/`beforeResolve`/`afterEach` | in-heap | ✅ | `vue-features.spec` (abort via `false`, redirect, `afterEach`), **e2e** (`[main] beforeEach` logs). |
| 14 | Guards — per-route `beforeEnter` | in-heap | ✅ | `users` bundle declares `beforeEnter` on `/users/:id`; runs on in-heap entry. |
| 15 | Guards — in-component (`onBeforeRouteLeave`/`Update`) | in-heap | 🟦 | Standard Vue Router; runs for in-heap transitions. **Cross-heap caveat:** leaving a page by opening another container does *not* run the opener's leave guards — the opener stays mounted underneath (it wasn't left). This matches browser MPA: navigating to a new document doesn't fire the old document's in-app leave guards. |
| 16 | **Route Meta Fields** (`meta`) | in-heap | 🟦 | Untouched Vue Router feature. Meta does not cross heaps (not serialized into the scheme); put cross-page data in query/state. |
| 17 | **Data Fetching** (guard-driven / after-nav) | in-heap | 🟦 | Works per-heap. Each opened container fetches on its own boot — the natural MPA data-loading point. |
| 18 | **Composition API** (`useRoute`/`useRouter`/`useLink`) | in-heap | ✅ | Used throughout `packages/playground-vue`; `useRouter()` returns the `SparklingRouter` (adds `hybridHistory`). |
| 19 | **RouterView slot** (`<router-view v-slot>`) | in-heap | 🟦 | Pure Vue feature; unaffected. |
| 20 | **Transitions** (`<router-view>` + `<Transition>`) | in-heap | ⚠️ | In-heap route transitions work (Vue `<Transition>`). **Cross-container** transitions are the *native* push/pop animation (owned by Sparkling / the platform), not Vue transitions — you get platform animation, configurable via scheme params (e.g. `animated`). |
| 21 | **Scroll Behavior** (`scrollBehavior`, saved position) | — | ❌ | Not supported. Vue Router's `scrollBehavior` drives `window.scrollTo` / `document` scroll and reads `window.history.state.scroll`; **Lynx has no window scroll** (scrolling lives inside `<scroll-view>`/`<list>`, per-container). Saved-position restore across containers is likewise a native concern. Platform limitation, not fixable in the shim. |
| 22 | **Extending RouterLink** (`useLink`, custom link components) | in-heap | 🟦 | `useLink` works; `href` is a Sparkling scheme (from `createHref`). Build custom link components with `custom` slot. |
| 23 | **Navigation Failures** (`NavigationFailure`, `isNavigationFailure`) | both | ✅ | In-heap: `vue-features.spec` (aborted push returns a failure). Cross-heap: `push`/`replace` return a promise that resolves when the native open succeeds (or rejects if no bundle owns the target / the host `open` fails). |
| 24 | **Dynamic Routing** (`addRoute`/`removeRoute`/`hasRoute`) | in-heap | ⚠️ | `vue-features.spec` (add + remove). Works within a heap at runtime. **Cross-bundle** routes cannot be added at runtime: the manifest that connects heaps is build-time (a new heap wouldn't know about a route another heap added in memory). Regenerate the manifest + rebuild to add cross-bundle routes. |
| 25 | **Typed Routes** (typed `RouteMap`) | — | 🟦 | Type-level only; compatible. The manifest could feed a typed-routes generator (future work). |
| 26 | **Lazy Loading** (`() => import()`) | both | 🔀 | In-heap async components work as usual. **Cross-bundle is itself lazy loading**: each page bundle is a separate artifact the host loads on demand at `router.open` — route-level code-splitting is the native container boundary. |

## `e2e/` examples

| Example | Status | Notes |
|---------|--------|-------|
| `encoding` | ✅ | Param/URL encoding round-trips through the codec — `cross-container.spec` (`round-trips locations losslessly`, encoded param), **e2e** deeplink with encoded query. |
| `guards-instances` | 🟦 | In-heap guard/instance behavior is Vue Router's own; unaffected. |
| `hash` | 🔀 | Hash history is replaced by the scheme codec; the "hash" role (opaque location token) is played by `__hs_route`. |
| `keep-alive` | 🔀/🟦 | In-heap `<KeepAlive>` works. Across containers, the *native stack itself* keeps backgrounded pages alive — a stacked page's heap is preserved and revealed intact on close (validated by **e2e** `restored ×N` + `main container revealed with state intact`). Stronger than `<KeepAlive>`: full heap preservation, not a component cache. |
| `modal` | ⚠️ | The "modal route over a background route" pattern works in-heap. A modal that is a *separate container* is a native presentation (e.g. a non-fullscreen scheme), not a Vue overlay. |
| `multi-app` | 🟦 | Each container already hosts its own Vue app instance/router — the multi-app model is the default here (one app per heap). |
| `scroll-behavior` | ❌ | See #21. |
| `suspense` | 🟦 | `<Suspense>` is a Vue feature, independent of history; works per-heap. |
| `transitions` | ⚠️ | See #20. |

---

## MPA limitations, stated plainly

These are inherent to "multiple heaps connected only by URLs", not
shortcomings of the shim:

1. **No forward across a closed container.** `history.go(+n)` past the local
   queue cannot re-enter a container that was popped — its heap is gone. Back
   works (it pops live containers); forward beyond the queue is clamped with a
   warning. In a browser MPA, forward after a real navigation reloads a fresh
   document; the native stack has no such entry to return to.
2. **Only URL-serializable data crosses the boundary.** Route, JSON state, and
   depth travel in the scheme. No shared reactive stores, no live object refs,
   no `meta` — by design. Richer hand-off goes through a native channel
   (`sparkling-storage`, a custom method).
3. **Cross-bundle route table is build-time.** Heaps agree via the generated
   manifest; you can't teach one heap about another's runtime `addRoute`.
4. **Guards are per-heap.** The opener's leave/afterEach guards don't run when
   you open another container (it stays mounted underneath); the opened page
   runs its own guards on boot. This mirrors browser MPA document semantics.
5. **Scroll restoration is native, not Vue.** (#21.)

## Verdict

Everything Vue Router does **inside a page** is supported unchanged — the shim
returns a real `Router` and only intercepts cross-bundle `push`/`replace`.
Everything Vue Router does **between pages** is mapped onto Sparkling native
navigation, with route/state/depth carried in the scheme and a build-time
manifest connecting the heaps. The only hard *no* is **scroll behavior**
(no window scroll on Lynx); `<RouterLink>` needs the `custom` slot (no `<a>`
on Lynx); and a handful of features are **reframed** (history modes, lazy
loading, keep-alive, transitions) because their mechanism legitimately moves
from Vue's runtime to the native platform in an MPA.
