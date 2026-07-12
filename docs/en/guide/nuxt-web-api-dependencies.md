# Nuxt's Web navigation/history API dependencies

This is the reference inventory behind [`web-navigation-shim`](https://github.com/tiktok/sparkling/tree/main/packages/web-navigation-shim):
every Web DOM navigation/history API that Nuxt 4 (`nuxt@4.4.8`) and Vue
Router 5 (`vue-router@5.1.0`) rely on for **client-side routing**, and the
exact semantics each caller needs. It exists so a non-browser JS context
(Lynx) can provide these APIs faithfully.

> Scope: navigation / history / URL only. Rendering (Vue → DOM) is out of
> scope — that is VueLynx's concern.

## The boot gate

Vue Router's entire client behavior is gated on one check:

```js
const isBrowser = typeof document !== 'undefined'
```

If `document` is undefined, `router.install()` never performs the
install-time initial navigation, so `router.isReady()` never resolves and
the app never mounts. **The shim must define a `document` global** (any
object satisfies the gate).

## API families

### 1. `history.pushState` / `replaceState` / `state` / `length` / `go`

Critical — this *is* client-side navigation under `createWebHistory`.

| API | Required semantics |
|---|---|
| `history.state` (read) | Synchronously returns the exact (JSON-safe) object last stored for the current entry; updated by push/replace and by traversal *before* `popstate`. Initial `null` is fine. |
| `pushState(state, '', url)` | Synchronous; after it, `history.state === state` and `location` reflects `url`; truncates forward entries; **fires no event**. Accepts absolute same-origin **and** path-only URLs. |
| `replaceState(state, '', url)` | Same, in place; no length change; no event. |
| Two-write push protocol | Every `router.push` does `replaceState(current + {forward, scroll})` then `pushState(new)`. Both must apply synchronously in order. |
| `go(delta)` | May be async, but must fire **exactly one** `popstate` per call, with `location`/`state` already at the destination; out-of-range past the top is a no-op. |
| `history.length` | Number ≥ 1, grows on push (seeds an internal position counter). |
| `scrollRestoration` | Feature-tested with `in`; optional. |

### 2. `popstate` / `pagehide` / `visibilitychange`

- `window.addEventListener('popstate', …)` — **critical** for back/forward
  under web history. Handler reads `event.state`; `location` must already
  reflect the destination when it fires.
- `pagehide` (window) + `visibilitychange` (document) — **edge**: only used
  to persist scroll on unload. Registration must not throw; firing is
  optional.
- Not used at all: `beforeunload`, `pageshow`, `hashchange`.

### 3. `window.location`

- Under web history (critical): `protocol`, `host`, `pathname`, `search`,
  `hash` (read at creation and every popstate); `assign`/`replace`
  (pushState-failure fallback).
- In Nuxt boot (critical even under memory history):
  `window.location.pathname/search/hash` read once for `initialURL`
  (`pages/runtime/plugins/router.js`); `location.href` for
  `useRequestURL()`.
- External navigation (the natural native-host hook): `navigateTo(to, {
  external })` uses `location.replace(to)` / `location.href = to`;
  route-rule redirects set `window.location.href`.

### 4. `URL` (not `URLSearchParams`)

Vue Router uses its own string parser — no native `URL`. **Nuxt requires
the native `URL` constructor** (relative-base resolution + component
getters) in `navigateTo`, `useRequestURL`, `<NuxtLink>`, payload plugin.
`URLSearchParams` is never used.

### 5. `document`

- `typeof document` — the boot gate.
- `document.querySelector('base')` — only when no base is passed; **Nuxt
  always passes `app.baseURL`**, so this is off the Nuxt path.
  `document.baseURI` is never used.
- `document.visibilityState` — inside the scroll-save handler only (edge).

### 6. Anchor interception (`<NuxtLink>` / `RouterLink`)

`guardEvent(e)` reads `e.metaKey/altKey/ctrlKey/shiftKey`,
`e.defaultPrevented`, `e.button`, `e.currentTarget.getAttribute('target')`,
then `e.preventDefault()`. All reads are undefined-safe; `navigate()` works
with no argument. External links / `target` set render a plain `<a>` with
no interception. Visibility prefetch (default on) uses
`IntersectionObserver`, `requestIdleCallback` (has a `setTimeout`
fallback), and a `navigator` object — disable prefetch or stub these.

### 7. `window.open`

Only `navigateTo(to, { open })` (opt-in). Edge.

### 8. `sessionStorage` / scroll

Vue Router keeps in-session scroll in an in-memory `Map`, not
`sessionStorage`. `window.scrollX/scrollY` are read on push and on pop
(numbers required); `window.scrollTo` only if `scrollBehavior` returns a
position. **Recommendation: `scrollBehavior: () => false`** so the DOM
scroll path is never taken. `sessionStorage` is only used by chunk-reload
machinery (all try/catch-wrapped) — disable `emitRouteChunkError`.

## Minimum viable NavigationHost contract

Under `createWebHistory` semantics, the host must back a shim that provides:

1. `document` defined (boot gate) + no-op `addEventListener`.
2. `location` with all WHATWG components, `assign`/`replace`/`reload`,
   updated synchronously before `popstate`.
3. `history` with `state` round-trip, synchronous event-free
   `pushState`/`replaceState` (absolute & path-only URLs), `go()` firing
   exactly one `popstate` (out-of-range top = no-op), `length`, optional
   `scrollRestoration`.
4. `window`/`document` `popstate`/`pagehide`/`visibilitychange` listeners.
5. `window.scrollX/scrollY` numbers + no-op `scrollTo`.
6. Native `URL` constructor.
7. For stock Nuxt defaults: `requestAnimationFrame` (or disable
   `navigationRepaint`), a `navigator` object, `IntersectionObserver` (or
   disable prefetch), `sessionStorage` (or disable `emitRouteChunkError`).

Under **`createMemoryHistory` per page** (the MPA model this integration
uses), most of §§1–3 disappears. The host then only needs: `document`
defined; a `history` object with a readable `state`; a `location`
reflecting the page's logical URL (read once for `initialURL`); a
`location.href` setter / `location.replace()` wired to the native
page-open primitive; `URL`; and numeric `scrollX/scrollY`. No
popstate/event machinery — hardware back is a native pop.
