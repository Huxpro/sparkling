# TanStack Router × Lynx-for-Web Compat Results

Generated: 2026-07-26 (local verification)

## Scoreboard

| Layer | Result |
| --- | --- |
| Unit (headless upstream ports, happy-dom) | **26 / 26 passed** |
| E2E (Playwright × `<lynx-view>`) | **6 / 6 passed** |
| Full upstream RTL suite (~250+ DOM tests) | **Not runnable as-is** |

## Environment

- **Lynx for Web on main**: yes for gallery (`@lynx-js/web-core` / `@lynx-js/go-web` on website). **No** `sparkling-web-shell` on main — that lives on [PR #3](https://github.com/Huxpro/sparkling/pull/3) / `stack/3-sparkling-web-shell`. This suite uses a minimal single-view harness instead.
- **Router**: `@tanstack/react-router@1.170.18` + `sparkling-router` `CompositeHistory`
- **Required aliases**: `react$` shim, `react-dom$`→`flushSync`, **`use-sync-external-store/shim*` → `@lynx-js/use-sync-external-store`** (critical)

## What works

- `@tanstack/history` memory (`back` / `forward` / `push` / `replace` / `canGoBack`)
- `router.navigate` path / params / search / replace / relative `..`
- Unicode path params, loaders, `redirect()`, `notFound()`
- `CompositeHistory` soft nav + hard boundary push + soft-back→hard-pop
- Lynx Web boot of TanStack `RouterProvider`
- UI re-renders after navigate **when uSES is aliased**
- Playwright click → `bindtap` (after uSES alias)
- `globalProps.queryItems` into lynx-view
- `url-search-params-polyfill` + `isServer: false`

## What does not work / gaps

| Gap | Notes |
| --- | --- |
| Upstream RTL suite as-is | Needs DOM React (`button`, `getByRole`, `createBrowserHistory`) |
| Missing uSES Lynx alias | **Critical**: navigate updates `router.state` but UI never re-renders |
| `createBrowserHistory` | Lynx has no History API |
| `<Link>` / `<a>` / IO preload | Prefer `useNavigate` + `bindtap` |
| SSR / Scripts / hydration tests | Out of Lynx scope |
| Full MPA web-shell stack e2e | Needs PR #3 shell — not on main |
| Pure Node (no `window`) | `createRouter` touches `window.origin` even with memory history |
| Occasional web-core `padding` PAGEERROR | Noise; scenarios still pass |

## Commands

```bash
pnpm --filter @sparkling-example/tanstack-lynx-web-compat test:unit
pnpm --filter @sparkling-example/tanstack-lynx-web-compat test:e2e
```
