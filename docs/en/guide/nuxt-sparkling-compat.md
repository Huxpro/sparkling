# Nuxt on Sparkling: routing feature compatibility

This is the acceptance traversal for driving Sparkling native navigation
from Nuxt's file-based routing. Every Nuxt routing feature is walked once
and classified:

- ✅ **Supported** — works, with a ported test proving it.
- ⚠️ **Degraded** — works with a caveat inherent to the MPA model; the
  build emits a diagnostic.
- ❌ **Unsupported** — cannot work under MPA; the reason is structural.

The classification is enforced in code: `pagesToSparklingManifest()`
returns a `diagnostics[]` list, and the Nuxt module prints a per-app
support report at build time (`analyzePages()`).

## The one constraint everything follows from

In VueLynx's SPA model, one LynxView holds one JS heap and Vue Router
navigates in memory. Here we drive **Sparkling native navigation**: each
page is a separate LynxView with a **separate JS heap**. There is no shared
memory across pages, so:

> A URL cannot be resolved by an in-memory route table that another page
> holds. It must be resolved from **build-time metadata** (the route
> manifest) embedded in every bundle.

Every "degraded" or "unsupported" verdict below traces back to this: state,
component instances, and outlets **cannot cross a JS heap**. Navigation
(opening another page) always can.

## Verification method

1. **Ported Nuxt fixtures.** Nuxt's official `packages/nuxt/test/pages.test.ts`
   (v4.4.8) `pageTests` are the ground truth for file → route generation.
   The exact `NuxtPage[]` trees Nuxt produces are fed through our
   `pagesToSparklingManifest()` and asserted
   (`packages/nuxt-sparkling/__tests__/nuxt-pages.spec.ts`, 12 cases
   spanning every routing pattern).
2. **Runtime matching.** The generated manifest is matched against real
   URLs via `matchSparklingRoute()` to prove params extract correctly.
3. **End-to-end.** Real Vue Router runs over `web-navigation-shim` + the
   Sparkling host over the real `NativeModules.spkPipe` bridge
   (`integration.spec.ts`): deep-link boot, cross-bundle `router.open`
   handoff, native `router.close`, external `webview` handoff.

## Feature-by-feature

### Route generation (file → route)

| Feature | Verdict | Evidence / notes |
|---|---|---|
| `index.vue` → `/`, nested `parent/index.vue` → `/parent` | ✅ | flattened to absolute paths |
| Static routes (`about.vue`, `snake_case`, `kebab-case`) | ✅ | one bundle per route |
| Dynamic `[id]` → `:id()` | ✅ | whole-segment param, matches at runtime |
| Regex param `[id(\d+)]` | ✅ | custom regex preserved in manifest & matcher |
| Catch-all `[...slug]` → `:slug(.*)*` | ✅ | matches `/a/b/c` → `slug: ['a','b','c']` |
| Catch-all in middle (`[...id]/suffix`) | ✅ | matches `/a/b/suffix` → `id: ['a','b']`; the matcher splits segments paren-aware so the slash inside the param regex is respected |
| Optional `[[id]]` → `:id?` | ✅ | matches present & absent |
| Nested dynamic (`[bar]/index`, `nonopt/[slug]`) | ✅ | absolute-path flattening |
| Route groups `(foo)/…` | ✅ | folder dropped from URL; `groups` carried in `meta` |
| Unicode / encoded paths (`测试.vue`) | ✅ | Nuxt-encoded paths passed through and matched |
| Colliding names, hyphen edge cases | ✅ | Nuxt's `name` reused as the unique manifest entry |
| Mixed literal+param in one segment (`prefix-[[opt]]`, `route-[slug]`, `[[opt]]-postfix`, `[b2]_[2b]`) | ⚠️ | Native open works; the runtime matcher only matches whole-segment params, so in-page matching of this route is best-effort. Diagnostic: `mixed-segment`. |
| Malformed (`[slug.vue`, `[].vue`) | ✅ (as error) | Nuxt throws during scan before we see it; parity preserved |

### Navigation at runtime

| Feature | Verdict | Notes |
|---|---|---|
| `navigateTo('/other')` across bundles | ✅ | becomes `router.open(hybrid://…?bundle=other.lynx.bundle&__path=/other)` |
| `<NuxtLink to="/other">` | ✅ | RouterLink → `router.push` → shim `location.assign` → native open |
| `router.push` / `replace` across bundles | ✅ | replace maps to `router.open` with `replace: true` |
| Deep-link / initial route | ✅ | page boots at its URL, reconstructed from the `__path` container query item |
| External URL (`navigateTo(url, { external })`, `<NuxtLink>` off-origin) | ✅ | routed through the manifest's `externalScheme` (webview container) |
| `window.open(url)` | ✅ | host `open(url, { newWindow })` → webview |
| Hardware / UI back at page root | ✅ | `history.back()` at the bottom of the local stack → `router.close` (native pop); previous page's heap resumes with state intact |
| In-page back/forward, hash nav (within one bundle) | ✅ | full History API when `mode: 'web'`; `popstate` semantics verified against real Vue Router |
| `definePageMeta({ middleware })` (route middleware) | ✅ | runs in the target page's heap after boot; global middleware must be duplicated per page (build concern) |
| Static/string `redirect` in `definePageMeta` | ⚠️ | encoded into manifest `meta.redirect`; a host can resolve it before open. Diagnostic: `redirect`. |
| Function `redirect` | ⚠️ | only evaluable once the target page's JS runs; redirect happens after boot, not before the native open |

### Layout / outlet features

| Feature | Verdict | Notes |
|---|---|---|
| Single leaf page per URL | ✅ | the common case |
| Nested route with parent `<NuxtPage>` outlet (`parent.vue` + `parent/child.vue`) | ⚠️ | Child navigates as its own native page. The parent wrapper **is not kept mounted** across children (separate heaps), so a persistent parent layout/state is lost. Fix: duplicate shared layout into each child bundle (build), or express the wrapper as a native container. Diagnostic: `nested-outlet`. |
| `<NuxtPage>` used purely as an index outlet (`page1.vue` + `page1/index.vue`) | ✅ | the index child owns `/page1`; the wrapper collapses cleanly |
| Named views (`<NuxtPage name="sidebar">`) | ❌ | MPA has one native page = one outlet per URL. Multiple simultaneous named views cannot be rendered across heaps. Restructure as separate routes/containers. |
| `<NuxtLayout>` (app-level layouts) | ⚠️ | works within a single page's render, but a layout is not a *shared live instance* across pages — each page re-instantiates it. Fine for presentation, not for cross-page live state. |
| Client-only in-place transitions between routes (`<NuxtPage>` transitions) | ❌ across pages | cross-page transitions are native (Sparkling animation), not Vue `<Transition>`; in-page transitions still work |

### State / data (navigation-adjacent)

| Feature | Verdict | Notes |
|---|---|---|
| `useState` shared across pages | ❌ | separate heaps; use `sparkling-storage` or pass via URL/scheme params. See the further-portability doc. |
| Passing data between pages | ✅ | via route params / query (carried in `__path`) or `sparkling-storage` |
| `useRoute()` / `useRouter()` within a page | ✅ | standard Vue Router composables over the shim |
| `useRequestURL()` | ✅ | reads `location.href` from the shim |

## Summary

Nuxt's **routing surface** — file-based routes (all naming conventions),
dynamic/catch-all/optional params, route groups, `navigateTo`/`<NuxtLink>`/
programmatic navigation, deep links, external links, and hardware back — is
**fully supported** on Sparkling native navigation through the shim + route
manifest.

The features that **degrade or are unsupported** all reduce to one cause:
constructs that require a **single shared JS heap** — persistent nested
outlets, named views, cross-page `useState`, in-place cross-page
transitions. These are exactly the SPA assumptions the MPA model trades
away for real multi-page native navigation, and the build reports each one
so authors can restructure or accept the caveat deliberately.
