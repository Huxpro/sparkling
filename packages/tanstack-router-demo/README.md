# tanstack-router-demo

TanStack Router driving **sparkling-navigation** for native multi-page (MPA)
navigation, verified on the web harness.

Unlike ReactLynx's existing SPA-in-a-single-LynxView story (TanStack/React
Router over a memory history inside one JS context), here **each page is a
separate LynxView with its own JS context**, and cross-page navigation is a
native container `open`. Pages are connected by pre-generated file-based
metadata (a route→page manifest), because they cannot share a JS heap.

## Layout

- `src/spike/` — the minimal feasibility spike: TanStack Router on a memory
  history in a single Lynx view (proves the router runs on ReactLynx at all).
- `src/mpa/routes.tsx` — the shared route tree + the page manifest that maps
  routes to native pages (`home` owns `/` and `/profile`; `detail` owns
  `/detail`; `settings` owns `/settings`).
- `src/mpa/create-router.tsx` — wires `createRouter` to `sparkling-navigation`
  through `sparkling-history` (`createMpaHistory` + `createSparklingHost`).
- `src/mpa/mount.tsx` + `src/pages/{home,detail,settings}/index.tsx` — one
  bundle entry per page. Every entry boots the same router; each derives its
  start location from its launch `queryItems` (`__mpa_href`).
- `src/shims/` — the bundler-level shims that let TanStack Router run on
  ReactLynx (see below).

## What each navigation does

| Action | Path change | Under the hood |
| --- | --- | --- |
| Home → Profile | `/` → `/profile` | in-page (same bundle) — memory-history transition, no native open |
| Home → Detail #42 | `/` → `/detail/42?ref=home` | cross-page — `host.open` → `router.open` → new LynxView |
| Detail #42 → #43 | `/detail/42` → `/detail/43` | in-page (same `detail` bundle) |
| Detail → Back | pop | `history.back()` at page root → `host.close` → native pop |

Path params (`id`) and search params (`ref`) cross the JS-context boundary via
the sparkling scheme's query string and are read back from `queryItems`.

## Running the web harness

```bash
pnpm --filter tanstack-router-demo build:web
# serve the built bundles through the web shell:
LYNX_BUNDLE_DIR="$(pwd)/dist/web" pnpm --filter sparkling-web-shell dev
# open http://localhost:4200/?page=home
```

## Required shims (ReactLynx has no react-dom / DOM)

All are bundler-level (`lynx.config.ts` `resolve.alias`) — no fork of TanStack
Router:

- `react$` → `src/shims/react.ts`: adds `startTransition`/`useTransition`
  (from `@lynx-js/react/compat`) and a `use` binding TanStack's dist links
  against.
- `react-dom$` → `src/shims/react-dom.ts`: provides `flushSync` (the only
  react-dom symbol in TanStack Router's client entry).
- `use-sync-external-store/shim*` → `@lynx-js/use-sync-external-store`.
- `src/shims/env.ts`: global polyfills (`scrollTo`, `AbortController`,
  `queueMicrotask`) that router-core touches unconditionally.

See `docs/en/guide/tanstack-router.md` for the full architecture and the
feature support matrix.
