# tanstack-lynx-web-compat

PR2 verification harness: run a **sufficiently large** TanStack Router upstream-derived suite against Sparkling's soft-nav stack on **experimental Lynx for Web**.

## Why not dump upstream vitest as-is?

TanStack's `packages/react-router/tests/*.test.tsx` (~250+ cases) use `@testing-library/react` + real DOM (`button`, `heading`, `IntersectionObserver`, `createBrowserHistory`). ReactLynx / Lynx Web do not provide that DOM surface. This package therefore:

1. **Ports** high-signal upstream cases to headless `router.navigate` / history assertions (vitest)
2. **Replays** soft-nav UX in a real `<lynx-view>` via Playwright
3. **Records** known gaps (`<Link>`/`<a>`, browser history, SSR)

Lynx Web host patterns come from mainline `@lynx-js/web-core` (already on `main` via the website) plus shell ideas from [PR #3](https://github.com/Huxpro/sparkling/pull/3) / `stack/3-sparkling-web-shell` (not merged; we only need a minimal host here).

## Commands

```bash
pnpm install
pnpm test:unit          # headless upstream ports
pnpm build              # suite.web.bundle + harness
pnpm exec playwright install chromium
pnpm test:e2e           # lynx-view soft-nav
pnpm report             # refresh RESULTS.md from artifacts
```
