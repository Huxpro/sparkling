# tanstack-router-demo

TanStack Router driving **sparkling-navigation** for native multi-page (MPA)
navigation, with in-page routing verified live in the go-web web preview.

Unlike ReactLynx's existing SPA-in-a-single-LynxView story (TanStack/React
Router over a memory history inside one JS context), here **each page is a
separate LynxView with its own JS context**, and cross-page navigation is a
native container `open`. Pages are connected by pre-generated file-based
metadata (a route→page manifest), because they cannot share a JS heap.

## Layout

- `src/spike/` — the minimal feasibility spike: TanStack Router on a memory
  history in a single Lynx view (proves the router runs on ReactLynx at all).
- `src/routes/*` — file-based routes (official TanStack convention) with
  `export const page` markers declaring native-page boundaries (`home` owns `/`
  and `/profile`; `detail` owns `/detail`; `settings` owns `/settings`).
- `src/app/**` — the SAME app authored with the Next-style app-directory
  convention (`page.tsx`, `layout.tsx`, `[param]/`, `export const container`
  markers). `scripts/gen-next.mjs` translates it to the same artifact pair
  (route tree + manifest); `tests/next-parity.test.ts` pins the equivalence.
- `scripts/` — `codegen.mjs` (runs everything), `gen-mpa.mjs` +
  `gen-next.mjs` (the two frontend translators), `lib/page-manifest.mjs`
  (shared manifest compiler).
- `src/mpa/create-router.tsx` — wires `createRouter` to `sparkling-navigation`
  through `sparkling-history` (`createMpaHistory` + `createSparklingHost`).
- `src/mpa/mount.tsx` + generated `src/pages.gen/*` / `src/pages-next.gen/*` —
  one bundle entry per page. Every entry boots the same runtime with
  `mount({ pageId, routeTree, manifest })`; each derives its start location
  from its launch `queryItems` (`__mpa_href`).
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

## Running the web preview

The demo is surfaced on the website as a live [`<Go>`](https://github.com/lynx-community/go-web)
example (see `docs/en/guide/examples/tanstack-router.mdx`). `build:web` emits
`*.web.bundle` + `*.lynx.bundle` into `dist-web/`, which
`packages/website/scripts/prepare-examples.mjs` copies into the site:

```bash
pnpm --filter tanstack-router-demo build:web   # dist-web/*.{web,lynx}.bundle
# then run the website and open /guide/examples/tanstack-router:
pnpm --filter website dev
```

**In-page** routing (the spike's Home↔About, the MPA `home` bundle's
Home↔Profile) runs live in the browser preview — it uses TanStack Router's
in-memory history, no native bridge. **Cross-page** navigation (opening a
separate native page) needs a Sparkling container; use the QR-code tab to run
on device.

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
