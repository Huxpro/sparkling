# Next.js App Router — Web/DOM Navigation API Dependency Catalog

Surveyed against **next@16.2.10** (`next/dist/client/**`), January 2026 line.
File references are to the published `next/dist` output.

Goal: enumerate every dependency the App Router client runtime has on
Web DOM navigation / history APIs, decide for each whether it can be
provided by a **reusable shim** on top of Sparkling + Lynx primitives, and
mark what is structurally impossible under Sparkling's MPA model
(independent LynxViews, no shared JS heap).

Legend for the **Shim** column:

- ✅ shim provides it (implemented over the Host Navigation Contract)
- 🟡 shim provides a degraded/partial form (noted)
- 🔁 reimplemented in the router adapter layer instead of shimmed
- ❌ not provided — structurally impossible or out of MPA scope

## A. `window.history` — core navigation state machine

| API | Where (next@16.2.10) | Purpose | Shim |
| --- | --- | --- | --- |
| `history.pushState(state, '', url)` | `client/components/app-router.js:64` (`HistoryUpdater`, `useInsertionEffect`) | Commit canonical URL after a router navigation | ✅ virtual history stack; page-crossing pushes map to `router.open(scheme)` |
| `history.replaceState(state, '', url)` | `app-router.js:66`; redirects, restore flows | Same-entry URL/state rewrite | ✅ virtual entry replace (intra-view); 🟡 cross-page replace = open + close self |
| `history.state` | `app-router.js:52,86-93,160,170,239` | Persist `__NA` marker + `__PRIVATE_NEXTJS_INTERNALS_TREE` (FlightRouterState) per entry | ✅ per-entry state map held by the shim; serialized into the sparkling scheme for cross-page handoff |
| `history.back()` / `forward()` | `app-router-instance.js:289-290` (`router.back/forward`) | Traverse | ✅ back → sparkling `close()` when crossing a page boundary, virtual traverse otherwise; 🟡 `forward()` cross-page is a no-op (native stacks pop on back; there is no forward stack) |
| monkey-patch `history.pushState/replaceState` | `app-router.js:252-279` | Intercept third-party history writes and sync `usePathname`/`useSearchParams` | ✅ shim's history object is a plain mutable object — patchable by design |
| `history.scrollRestoration` | not used by app router in 16.x (pages router only: `client/index.js`) | — | n/a |

## B. `window.location`

| API | Where | Purpose | Shim |
| --- | --- | --- | --- |
| `location.href` (read) | `app-router.js:61,117,169,238`, `app-router-instance.js:219,270,275`, `app-dir/form.js` | Base URL for `new URL(href, location.href)`; restore actions | ✅ derived from the page's sparkling scheme → synthetic origin (see below) |
| `location.origin` | `app-router-utils.js:26` (`isExternalURL`), `router-reducer/*` | External-URL detection (external ⇒ hard navigation) | ✅ synthetic app origin, e.g. `sparkling://app`; anything else ⇒ "external" ⇒ host `open()` passthrough |
| `location.search` | `app-router-instance.js:232` | Seed `locationSearch` for navigate actions | ✅ from current scheme query |
| `location.pathname` | `create-initial-router-state.js`, dev-only reporters | Initial canonical URL | ✅ from route manifest + container queryItems |
| `location.assign(url)` / `location.replace(url)` | `app-router.js:219-221` (`pushRef.mpaNavigation`), `server-action-reducer.js` | **Hard/MPA navigation** (external URL, deployment-id mismatch, explicit MPA) | ✅ this is *the* native fit: `assign` → sparkling `open()`, `replace` → `open()` + close self |
| `location.reload()` | `app-router.js:291` (popstate over non-`__NA` entry), `use-action-queue.js` | Recovery hard reload | 🟡 host contract `reload()` — web: real reload; native: re-create current LynxView (falls back to no-op + warning if host lacks it) |
| `location.hash` | not read by app-router runtime (hash handled via `URL` objects + `layout-router` scroll) | — | n/a |

## C. Window events

| Event | Where | Purpose | Shim |
| --- | --- | --- | --- |
| `popstate` | `app-router.js:284-306` | Back/forward → `ACTION_RESTORE` traverse | ✅ emitted by the shim when: (a) virtual intra-view traverse; (b) container re-shown after a child page above it closed (host `onShow`/`viewAppear` hook) |
| `pageshow` (`event.persisted`) | `app-router.js:159-177` | bfcache restore → reset router state | 🟡 mapped to host "container re-appeared" signal; `persisted` semantics approximated. Native page stacks genuinely bfcache: the LynxView under a pushed page keeps its heap — this maps *better* to native than to the web shell |
| `pagehide` | `router-reducer/fetch-server-response.js:67` | Abort in-flight RSC fetches | 🟡 host "container hidden" signal; only matters if RSC fetching is enabled (not in static MPA mode) |
| `error` / `unhandledrejection` | `app-router.js:196-201` | Catch redirect errors thrown outside boundaries (`redirect()` from event handlers) | 🔁 Lynx has `lynx.reportError`/global error hooks but not DOM ErrorEvent; the adapter installs its own top-level catch. `redirect()` thrown during render is caught by boundary components (pure React, portable) |

## D. URL machinery

| API | Where | Purpose | Shim |
| --- | --- | --- | --- |
| `new URL(...)` | pervasive (`app-router.js:61,117,169`, `app-router-instance.js:219`, reducers, `create-href-from-url.js`) | All URL math | ✅ shim feature-detects `URL` on the host runtime and installs a spec-subset polyfill when missing (PrimJS availability differs by Lynx version) |
| `URLSearchParams` | `app-router.js:120` → `useSearchParams` | Search param access | ✅ same feature-detected polyfill |
| a-tag URL resolution (`<a href>` relative resolution) | `app-dir/link.js` | `<Link>` builds absolute URLs | 🔁 adapter's `<Link>` resolves against the shim location |

## E. Document / rendering-coupled (NOT navigation, listed for completeness)

| API | Where | Purpose | Verdict |
| --- | --- | --- | --- |
| `react-dom/client.hydrateRoot`, `document.*`, `self.__next_f` | `client/app-index.js:14,129,280,293` | Boot: hydrate server-rendered HTML from RSC flight stream | ❌ **structural**: Lynx has no DOM and no react-dom. The adapter boots a ReactLynx root instead. This is the single reason we do *not* run `next/dist/client` wholesale |
| scroll: `scrollIntoView`, `document.documentElement.scrollTop`, `getBoundingClientRect`, `document.getElementById(hash)` | `client/components/layout-router.js:79-256` | Scroll-to-top / hash scroll after navigation | ❌ as DOM APIs; 🔁 semantics reproducible per-NodeType via Lynx `scroll-view` refs — but mostly moot: cross-page navigation lands on a *fresh full-screen page* (native scroll position starts at top by definition; native back restores native scroll for free — better than the web) |
| `IntersectionObserver` | `client/components/links.js:96`, `use-intersection.js` | Viewport-based `<Link>` prefetch | 🔁 Lynx exposes `lynx.createIntersectionObserver` — adapter `<Link>` can use it to trigger manifest/bundle prefetch; initial version: prefetch on mount/eager |
| `document.createElement` + ARIA live region | `app-router-announcer.js` | Route-change a11y announcements | ❌ no-op on Lynx (no equivalent primitive exposed today) |
| `<form>` interception | `app-dir/form.js` | `<Form>` component GET navigation | 🔁 adapter provides a Lynx-flavored `<Form>` mapping submit → router.push |
| `fetch` + `AbortController` | `router-reducer/fetch-server-response.js:316,371` | Fetch RSC payloads for soft navigation | 🟡 Lynx provides `fetch` (Lynx 3 Fetch API); irrelevant in static-MPA mode (no RSC server at runtime), needed later for a data-manifest mode |
| `sessionStorage` | `client/dev/debug-channel.js` (dev only) | dev tooling | out of scope |
| `window.next.*`, `window.nd` | `app-router.js:134-150`, `app-router-instance.js:387` | debug/introspection globals | ✅ shim exposes a `globalThis`-attached namespace, harmless |
| `CustomEvent`/`dispatchEvent` | web shell only | — | ✅ shim ships a minimal `EventTarget` implementation |

## F. What this catalog implies (architecture verdict)

1. **The navigation-relevant surface is small and closed**: `history`
   (push/replace/state/back/forward + patchability), `location`
   (href/origin/search/pathname/assign/replace/reload), events
   (`popstate`, `pageshow`, `pagehide`), and `URL`/`URLSearchParams`.
   This entire surface is mechanically emulatable over a four-method host
   contract (`open`, `close`, `onShow/onHide`, `currentSchemeUrl`) —
   which sparkling-navigation provides on Android, iOS, *and* the web shell.

2. **Everything that blocks running `next/dist/client` verbatim is
   rendering-coupled, not navigation-coupled**: react-dom hydration, RSC
   flight streaming, DOM scroll. Hence the layering:
   - `sparkling-history-shim` (reusable, framework-agnostic): the DOM-like
     navigation surface over the host contract. Any router that only
     talks to `history`/`location`/`popstate`/`URL` runs on it unmodified.
   - `sparkling-next-router` (adapter): file-convention manifest +
     ReactLynx providers that feed **the real `next/navigation` context
     objects** (`AppRouterContext`, `PathnameContext`, `SearchParamsContext`,
     `PathParamsContext` from `next/dist/shared/lib/*.shared-runtime`), so
     `useRouter`/`usePathname`/`useSearchParams`/`useParams` are Next's own
     module code, not a re-implementation.

3. **MPA constraint is expressed at exactly one point**: when a navigation
   crosses a *page boundary* (different route bundle), the shim turns
   `history.pushState`-style intent into `router.open(scheme)` and the
   target page boots fresh from its own bundle + serialized state in the
   scheme. Everything below that point (same-page search-param updates,
   hash-less shallow routing, `router.refresh` of the current view) stays
   in-heap and synchronous.
