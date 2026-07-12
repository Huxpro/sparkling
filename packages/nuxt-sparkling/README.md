# nuxt-sparkling

A Nuxt module that drives **Sparkling native navigation** from Nuxt's
file-based `pages/` — the multi-page (MPA) model, where each page is its
own Lynx bundle in its own JS heap, connected by the native navigation
stack rather than an in-memory router.

## Why this is not VueLynx's memory router

VueLynx already runs a Vue Router SPA inside a *single* LynxView using a
memory history. That keeps every route in one JS heap.

This package targets the opposite model: **multiple** LynxViews, each a
separate native page with a separate JS heap, wired together by Sparkling
navigation. Because the heaps don't share memory, the router can't hold
the route table in RAM and navigate in place. Instead:

1. At **build time**, the `pages/` tree is compiled into a **route
   manifest** (`web-navigation-shim` → `sparkling-navigation/shim-host`
   format) and embedded so any page can resolve *URL → which bundle to
   open* without shared runtime state.
2. At **runtime**, each page installs `web-navigation-shim` over a
   Sparkling `NavigationHost`. In-page history works normally; a
   navigation to a *different* bundle hands off to `router.open` (native
   push) with a sparkling scheme URL; back at the bottom of the in-page
   stack becomes `router.close` (native pop).

```
Nuxt pages/  ──build──▶  Sparkling route manifest  ──┐
                                                     ▼
vue-router (createWebHistory / memory)               │
   │ router.push / <NuxtLink> / navigateTo           │
   ▼                                                 │
web-navigation-shim  (history/location/popstate)     │
   │ location.assign(cross-bundle)                   │
   ▼                                                 ▼
sparkling-navigation/shim-host  ──▶  router.open(hybrid://…?bundle=…&__path=…)
                                     router.close
```

## Install

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-sparkling/module'],
  sparkling: {
    origin: 'https://my.app',   // logical URL space for app routes
    mode: 'memory',             // 'memory' (pure MPA) | 'web' (SPA-in-MPA)
    strict: false,              // fail build on blocking diagnostics
  },
})
```

```ts
// app/router.options.ts
import { sparklingHistory, sparklingScrollBehavior } from 'nuxt-sparkling/runtime/history'
import manifest from '#sparkling/route-manifest'

export default {
  history: () => sparklingHistory(manifest, { mode: 'memory' }),
  scrollBehavior: sparklingScrollBehavior,   // returns false: native owns scroll
}
```

The module also turns off Nuxt subsystems that assume a browser document
and would throw/hang in a Lynx JS context: `emitRouteChunkError`,
`appManifest`, `navigationRepaint`, `restoreState` (see
`docs/en/guide/nuxt-web-api-dependencies.md`).

## What the manifest generator does

`pagesToSparklingManifest(pages, options)` transforms the `NuxtPage[]`
tree Nuxt hands to the `pages:extend` hook into a flat manifest. Because
each URL maps to exactly one bundle, nested `<NuxtPage>` outlets are
**flattened** to absolute paths (an index child wins its parent's URL),
and anything that can't cross a JS heap is reported as a **diagnostic**
(`degraded` = works with a caveat; blocking = can't work). See
`analyzePages()` for the per-feature support report the module prints at
build time.

## Feature support (MPA)

| Nuxt feature | Status | Notes |
|---|---|---|
| Static / index routes | ✅ supported | one bundle per route |
| Dynamic `[id]`, catch-all `[...slug]`, optional `[[id]]` | ✅ supported | whole-segment params match at runtime |
| Route groups `(group)` | ✅ supported | URL-transparent; `groups` carried in meta |
| `navigateTo` / `<NuxtLink>` / `router.push` across pages | ✅ supported | become native `router.open` |
| In-page history back/forward, hash | ✅ supported | within a bundle (`mode: 'web'`) |
| Nested layout via parent `<NuxtPage>` outlet | ⚠️ degraded | wrapper not kept mounted across child heaps; duplicate into children or use a native container |
| Mixed literal+param segment (`prefix-[id]`) | ⚠️ degraded | native open works; in-page param match best-effort |
| Function `redirect` in `definePageMeta` | ⚠️ degraded | runs after the target page boots |
| Named views (`<NuxtPage name>`) | ❌ unsupported | one outlet per page |

Full traversal and rationale: `docs/en/guide/nuxt-sparkling-compat.md`.

## Verification

`__tests__/` (plain Node, no jsdom):

- `nuxt-pages.spec.ts` — ports Nuxt's official `pages.test.ts` fixtures
  (v4.4.8) and asserts the flattened manifest + diagnostics for every
  routing pattern.
- `integration.spec.ts` — Nuxt page tree → manifest → Sparkling host →
  shim → **real vue-router**, driving the actual `NativeModules.spkPipe`
  bridge: deep-link boot, cross-bundle `router.open` handoff (scheme +
  `__path`), native `router.close`, and webview handoff for external URLs.
