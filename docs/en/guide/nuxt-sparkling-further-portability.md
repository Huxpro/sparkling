# Beyond routing: other Nuxt subsystems on Lynx + Sparkling

The navigation work (shim + manifest + module) makes Nuxt's **routing**
run on Sparkling native navigation. This document surveys the *rest* of
Nuxt and classifies each subsystem for portability into Lynx + Sparkling,
so follow-up work can be prioritized.

Classification:

- **A — Portable as-is**: pure build-time or pure-JS; nothing DOM/server.
- **B — Portable behind a shim**: needs a Web/host API the shim or a
  Sparkling method can provide.
- **C — Remap to native**: the concept exists but must be backed by a
  native capability (container config, storage) instead of the DOM.
- **D — Not applicable**: SSR/server-render/HTML-head concepts with no
  device analogue (often better kept as a real backend the app calls).

The recurring constraint is the same as for routing: **each Sparkling page
is an isolated JS heap**, so anything Nuxt shares "across the app" on the
client (state, a live layout instance, the payload) does not automatically
span pages.

## A — Portable as-is

| Subsystem | Notes |
|---|---|
| **Auto-imports** (`unimport`) | Build-time transform; produces plain imports. Works unchanged in the rspeedy/Lynx build. |
| **`useRuntimeConfig`** | Values injected at build; a plain object at runtime. Portable. |
| **`definePageMeta` / route meta** | Extracted at build; already carried into the Sparkling manifest `meta`. Portable. |
| **`useRoute` / `useRouter` / `navigateTo`** | Vue Router composables over the shim. Covered by the navigation work. |
| **Pure composables / utils** (`useId`, `useState` *within a page*, app config) | Plain reactive JS; no DOM. Portable. |
| **`<ClientOnly>`** | On Lynx everything is the "client" — becomes a transparent passthrough (the server branch never runs). |

## B — Portable behind a shim

| Subsystem | What it needs | Path |
|---|---|---|
| **`$fetch` / `useFetch` / `useAsyncData`** | a global `fetch` | Lynx 3.x exposes a `fetch`; where absent, shim `fetch` over a Sparkling network method. The composable *caching/dedupe* layer is pure JS and portable. SSR **payload extraction** does not apply (no server render) — data is always fetched on device. |
| **Route middleware** (`defineNuxtRouteMiddleware`, `definePageMeta({ middleware })`) | vue-router guards | Runs inside the target page's heap after boot. Portable per-page. **Global** middleware must be duplicated into each bundle by the build (no shared app instance to register it once). |
| **Nuxt plugins** (`defineNuxtPlugin`) | app-init hook | Portable if the plugin is DOM/server-free. Each page runs its own plugin set (no shared app), so "install once" plugins become "install per page". |
| **`useError` / `error.vue`** | an error route | Portable as a normal page; `showError`/`clearError` work in-heap. Cross-page error propagation is native (open an error page). |
| **`useNuxtApp`** | the app context object | Portable; scoped to the page's heap. |

## C — Remap to native

| Subsystem | DOM behavior | Native remap |
|---|---|---|
| **`useHead` / `useSeoMeta`** | mutates `document.head` (title, meta, links) | No HTML head on device. Map the meaningful subset to the **container scheme**: `title` → nav-bar title, theme color → `nav_bar_color`, etc. (`sparkling-navigation` already passes these as scheme params). The rest (SEO meta, `<link>`) is inert on device. |
| **`useState` across pages** | one heap in SSR/CSR | Within a page: a plain `ref`, portable. Across pages: no shared heap — bridge through **`sparkling-storage`** (persist on navigate, rehydrate on boot) or pass via route params in the manifest `__path`. Highest-value follow-up: a `useSparklingState` that transparently persists. |
| **`useCookie`** | `document.cookie` | Map to `sparkling-storage` (or a cookie-jar method) keyed like cookies. |
| **App layouts / `<NuxtLayout>`** | one live instance wrapping pages | Rendered per page (presentation portable via VueLynx), but **not a shared live instance**. Shared layout state must go through storage or a native container; a persistent chrome (tab bar, nav bar) is better expressed as a **native Sparkling container** hosting the LynxViews. |
| **Page transitions** | Vue `<Transition>` on the outlet | Cross-page transitions are **native** Sparkling animations (scheme/animated option). In-page transitions still use Vue. |

## D — Not applicable (keep as backend, or no device analogue)

| Subsystem | Why | Recommendation |
|---|---|---|
| **Nitro server routes** (`server/api`, `server/routes`) | a Node/edge server runtime | Don't port to device. Run Nitro as the app's **real backend**; the device calls it via `$fetch`. This is the natural split. |
| **SSR / payload / hydration** (`useHydration`, `<NuxtPayload>`, island/server components) | server-render then hydrate HTML | No HTML render on device. Not applicable; data is fetched on device (category B). |
| **`useRequestHeaders` / `useRequestEvent` / `useRequestURL` (server branch)** | the server request | Server-only. `useRequestURL` *client* branch works over the shim (category A/B). |
| **`preloadComponents` / chunk prefetch / `emitRouteChunkError`** | HTTP code-splitting & chunk reload | Bundles are native assets, not HTTP chunks. Disabled by the module; native bundle preloading is a Sparkling concern, not Nuxt's. |
| **`<NuxtImg>` / image CDN**, DevTools, Nuxt UI DOM widgets | browser DOM / build integrations | Rendering is VueLynx's domain, not this navigation layer. Out of scope here. |

## Suggested follow-up order

1. **`useSparklingState`** — the biggest ergonomic win: `useState`-shaped
   API that persists to `sparkling-storage` on navigate and rehydrates on
   boot, giving the *feel* of shared state across the MPA.
2. **`$fetch` shim** — confirm/adopt Lynx's `fetch`; wire `useFetch`/
   `useAsyncData` (pure caching layer is already portable). Unlocks most
   real apps.
3. **`useHead` → container scheme** — map title/theme to nav-bar/container
   params so `useHead({ title })` "just works" as native chrome.
4. **Global middleware & plugin duplication** — a build step that injects
   app-level middleware/plugins into each page bundle so "register once"
   semantics hold across the MPA.

None of these are blocked by the navigation architecture; each is an
additive shim or build step on top of the same layering
(framework → shim → `NavigationHost` → Sparkling).
