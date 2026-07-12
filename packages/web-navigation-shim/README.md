# web-navigation-shim

A framework-agnostic implementation of the Web's navigation/history API
surface (`history`, `location`, `popstate`, `window.open`, …) on top of a
tiny pluggable **`NavigationHost`** contract.

It exists to let web routing frameworks (vue-router/Nuxt, and in principle
react-router or anything speaking the History API) run inside JS contexts
that are **not** browser documents — most importantly Lynx pages managed by
Sparkling's native navigation — while cross-page navigation is delegated to
the host platform's real page stack.

## The layering

```
┌─────────────────────────────────────────────────────────┐
│  Router frameworks: vue-router / Nuxt / react-router / … │  (unchanged)
├─────────────────────────────────────────────────────────┤
│  web-navigation-shim                                     │
│  history · location · popstate · window.open · document  │  (this package)
├───────────────────────────┬─────────────────────────────┤
│  NavigationHost contract  │ initialUrl · open() · close()│
├───────────────────────────┴─────────────────────────────┤
│  Hosts: sparkling-navigation (router.open/close+scheme)  │
│         memory stack (tests/SSR) · any native shell      │
└─────────────────────────────────────────────────────────┘
```

The shim never references Sparkling or Lynx. Any platform that can say
"this document was opened at URL X", "open URL Y as a new page", and
"close this page" can host any router framework that speaks the History
API. The Sparkling host implementation lives with the navigation method
(`sparkling-navigation`), not here — keeping this layer reusable outside
Sparkling.

## The MPA model (why this is not a memory router)

On Lynx + Sparkling, each page is its own LynxView with an **isolated JS
heap**. A vue-router "memory history" SPA can never navigate across pages,
because there is no shared memory to route in. The shim instead models the
real browser split:

- **Same-document navigations** (`history.pushState/replaceState`, hash
  changes) mutate a synthetic per-context entry stack — exactly like a
  browser document's session history. Synchronous, no events, per spec.
- **Cross-document navigations** (`location.assign/replace/href=`,
  `window.open`) are handed to `NavigationHost.open()` — on Sparkling that
  becomes `router.open` with a sparkling scheme URL and a **new native
  page** (new JS heap).
- **`history.back()`/`go(-n)` past the bottom of the local stack** becomes
  `NavigationHost.close()`/`go()` — a **native pop** revealing the previous
  page with all of its local state intact.

Which URLs count as "same document" is a host policy
(`NavigationHost.isSameDocument`): the default mirrors the web (hash-only),
and a Sparkling host can widen it using its build-time route manifest
("same Lynx bundle ⇒ same document").

## What exactly is implemented

Semantics were derived from an audit of everything Nuxt 4 + vue-router 5
require from the browser for client-side routing (see
`docs/en/guide/nuxt-web-api-dependencies.md`):

- `history.pushState/replaceState` — synchronous, event-free, forward-stack
  truncation, absolute/path-only URL resolution, state round-trip
  (vue-router's two-write push protocol relies on all of these).
- `history.go/back/forward` — async, **exactly one `popstate` per call**,
  `location`/`state` updated before listeners run, out-of-range top = no-op
  (guard rollback via `go(-delta)` depends on this), bottom-crossing =
  native traversal.
- `history.length`, `history.state`, `history.scrollRestoration`.
- `location` — all WHATWG component getters/setters, `assign`, `replace`,
  `reload`, stringifier.
- `popstate`/`pagehide`(window) and `visibilitychange`(document) listeners;
  `notifyPageHide()` lets hosts trigger the scroll-persistence path.
- `document` boot stub (`typeof document` gate, `querySelector('base')`,
  `visibilityState`), `navigator` stub, `requestAnimationFrame` fallback,
  `scrollX/scrollY/scrollTo` stubs.
- `install(globalThis)` defines only missing globals (never clobbers a real
  browser environment unless `force`).

Requires a global WHATWG `URL` constructor in the JS context.

## Usage

```ts
import { createNavigationShim, type NavigationHost } from 'web-navigation-shim';

const host: NavigationHost = {
  initialUrl: 'https://app.local/users/42',
  open: (url, opts) => nativeOpen(url, opts),   // e.g. sparkling router.open
  close: () => nativeClose(),                   // e.g. sparkling router.close
};

const shim = createNavigationShim(host);
shim.install(globalThis); // before importing vue-router / booting Nuxt

// vue-router's createWebHistory() now works in this context:
const router = createRouter({ history: createWebHistory(), routes });
```

For tests (or SSR-ish hosts) there is an in-memory reference host that
models a native page stack of isolated documents:

```ts
import { MemoryDocumentStack } from 'web-navigation-shim/memory';

const stack = new MemoryDocumentStack('https://app.local/');
stack.top.shim.location.assign('/detail'); // "native push": new document
stack.top.shim.history.back();             // "native pop": reveals '/'
```

## Verification

`__tests__/` runs in plain Node (no jsdom) to prove self-sufficiency:

- WHATWG semantics unit tests (history/location/events).
- MPA stack semantics against `MemoryDocumentStack`.
- **Integration: real vue-router 5 `createWebHistory` running on the shim**
  — boot, push, state bookkeeping, back/forward, guard rollback, and the
  manifest-guard MPA handoff pattern used by the Sparkling router glue.
