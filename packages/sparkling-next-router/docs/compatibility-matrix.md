# Next.js App Router → Sparkling Compatibility Matrix

Feature-by-feature verdict for running the **Next.js App Router** model on
**Sparkling native navigation** (`sparkling-next-router` + `sparkling-history-shim`).
Assessed against **next@16.2.10**.

Status legend:

- ✅ **Supported & validated** — works, exercised by the `next-router-example`
  app in the web harness (`packages/next-router-example`, 16/16 e2e checks).
- 🟢 **Supported by design** — implemented, mechanically equivalent to a
  validated case; not separately screenshotted.
- 🟡 **Partial / degraded** — works with a documented behavioral difference.
- 🔴 **Not supported — MPA constraint** — structurally impossible while each
  route is its own LynxView with no shared JS heap.
- ⚫ **Not supported — no RSC server** — depends on a Next.js server runtime
  that does not exist in a Sparkling app (every route is client-rendered).

The two "not supported" buckets are the honest boundaries the brief asked
for. Everything in them has a stated reason.

---

## 1. Routing & file conventions

| Feature | Status | Notes / validation |
| --- | --- | --- |
| `app/page.tsx` routes | ✅ | Home + 5 routes generated as separate Lynx bundles. |
| `app/layout.tsx` (root layout) | ✅ | Wraps every page; re-mounts per container (see §5). |
| Nested `layout.tsx` | ✅ | `/dashboard` composes root + dashboard layout — validated. |
| Dynamic segment `[param]` | ✅ | `/products/[id]` → `params.id`, `useParams()` — validated. |
| Catch-all `[...slug]` | 🟢 | Compiled + unit-tested (`manifest.test.ts`); array params. |
| Optional catch-all `[[...slug]]` | 🟢 | Compiled + unit-tested; matches base and nested. |
| Route groups `(group)` | ✅ | Stripped from the URL; unit-tested in `scan-codegen.test.ts`. |
| Private folders `_folder` | 🟢 | Skipped by the scanner. |
| `not-found.tsx` + `notFound()` | ✅ | Boundary renders nearest not-found — validated. |
| `loading.tsx` | 🟡 | Parsed and passed to the root; shown as an instant placeholder only if the host exposes a pre-open hook (web shell swaps synchronously, so it's a no-op there). |
| `error.tsx` (segment error UI) | 🟡 | Root error boundary catches redirect/notFound; per-segment `error.tsx` files are not yet wired as boundaries (planned; pure React, portable). |
| `template.tsx` | 🔴→🟡 | Templates re-mount per navigation by definition. On MPA every page already re-mounts, so a template ≈ a layout; not specially handled yet. |
| `route.ts` (Route Handlers) | ⚫ | Server endpoints; no server in a Sparkling app. Scanner reports them as skipped. |
| Parallel routes `@slot` / `default.tsx` | 🔴 | Multiple simultaneous slots in one view; the scanner reports and skips them. A single native container shows one page. |
| Intercepting routes `(.)`/`(..)` | 🔴 | Depend on soft-navigation interception within a shared router tree; cross-heap boundary can't intercept. Reported and skipped. |

## 2. Navigation APIs (`useRouter`)

| Feature | Status | Notes / validation |
| --- | --- | --- |
| `router.push(href)` — different bundle | ✅ | Opens a new native container (`router.open`) — validated. |
| `router.push(href)` — same bundle (e.g. `/products/42`→`/products/43`) | ✅ | Stays in-heap, virtual history, re-renders — validated. |
| `router.replace(href)` | ✅ | Same-page virtual replace, or replace-capable `open` cross-page — validated via search-param replace + redirect. |
| `router.back()` — within virtual stack | ✅ | Virtual traverse + `popstate` — validated. |
| `router.back()` — at container bottom | ✅ | Native `close()` → previous native page — validated. |
| `router.forward()` — same-page | 🟢 | Virtual forward when a forward entry exists. |
| `router.forward()` — cross-page | 🔴 | Native stacks have no forward stack; no-op + dev warning. |
| `router.refresh()` | 🟡 | Re-renders the current container (client refresh). Does **not** re-fetch server data — there is none (⚫). |
| `router.prefetch(href)` | 🟡 | Hook present; no-op by default. Bundle/manifest prefetch is a future host capability. |
| `<Link href>` | ✅ | Renders a `<view>`; tap → push — validated. |
| `<Link replace>` | 🟢 | Maps to `router.replace`. |
| `<Link onNavigate>` (+ `preventDefault`) | 🟢 | Implemented. |
| `<Link scroll={false}>`, `prefetch`, `passHref`, `legacyBehavior`, `target`, modifier-click | 🔴/🟡 | Anchor/DOM-scroll concepts with no Lynx equivalent; accepted as props, mostly no-ops. See §6. |

## 3. Hooks (`next/navigation`)

| Hook | Status | Notes / validation |
| --- | --- | --- |
| `useRouter()` | ✅ | Full instance — validated. |
| `usePathname()` | ✅ | `/dashboard` — validated. |
| `useSearchParams()` | ✅ | `q`, `sort` read; `ReadonlyURLSearchParams` — validated. |
| `useParams()` | ✅ | `/products/[id]` — validated. |
| `useSelectedLayoutSegment(s)()` | 🟡 | Returns segments below this container's route; cannot see sibling containers (cross-heap). |
| `redirect()` / `permanentRedirect()` | ✅ | Digest-compatible; boundary routes it — validated (`/redirect-demo`→`/products/1`). |
| `notFound()` | ✅ | Digest-compatible — validated. |
| `useServerInsertedHTML`, `useReportWebVitals` | ⚫/🔴 | Server/DOM-coupled; not applicable. |

## 4. URL / history semantics

| Behavior | Status | Notes |
| --- | --- | --- |
| Canonical URL tracking (`usePathname`/`useSearchParams` stay in sync) | ✅ | Driven by the shim's virtual `location`. |
| `history.pushState`/`replaceState` interception (3rd-party) | 🟢 | Shim `history` is a plain patchable object (matches Next's monkey-patch design). |
| `popstate` (back/forward) | ✅ | Emitted by the shim on virtual traverse and container re-show. |
| `pageshow`/bfcache restore | 🟡 | Mapped to host "container re-appeared". Native page stacks genuinely retain the under-page's heap — closer to bfcache than the web shell. |
| Hash navigation / hash scroll | 🔴 | No DOM scroll box; hashes are parsed into `location.hash` but scrolling to an anchor is a no-op. |
| Scroll restoration on nav | 🔴→🟢 | DOM scroll APIs unavailable; but cross-page nav lands on a fresh native page (top by definition) and native back restores native scroll for free. |

## 5. Layouts & state

| Behavior | Status | Notes |
| --- | --- | --- |
| Shared layout **code** across routes | ✅ | Layout chain compiled into each route bundle. |
| Preserved layout **instance/state** across navigation | 🔴 | **The core MPA trade.** Different route bundle = different LynxView = different heap, so a layout component re-mounts (loses `useState`) when navigating across bundles. Same-bundle navigations (e.g. dynamic-param changes) *do* preserve state. Cross-page shared state must go through sparkling storage / globalProps (out of scope for this layer). |
| Streaming/Suspense layout reveal | ⚫ | Requires RSC streaming. |

## 6. Rendering model

| Feature | Status | Notes |
| --- | --- | --- |
| Client Components (`"use client"`) | ✅ | Effectively the whole app; ReactLynx renders them. |
| Server Components (default) | ⚫ | No RSC runtime; components run client-side in the LynxView. Authoring works, but "server-only" guarantees don't hold. |
| Server Actions (`"use server"`) | ⚫ | No server. |
| RSC streaming / PPR / `loading.tsx` streaming | ⚫ | No RSC runtime. |
| Metadata API (`generateMetadata`, `<head>`) | 🔴 | No document head in Lynx; native title/nav-bar is set via the sparkling scheme (`title=`, etc.) instead. |
| `next/image`, `next/font`, `next/script` | 🔴 | DOM/browser-asset components; use Lynx `<image>` / native asset pipeline. |
| `<Form>` (`next/form`) | 🟡 | Not shipped; a Lynx `<Form>` mapping submit→`router.push` is straightforward (planned). |
| Data fetching (`fetch` in components) | 🟡 | Lynx 3 exposes `fetch`; client-side data fetching works. Server-side caching/revalidation semantics (⚫) do not. |

---

## Bottom line

Everything a **client-side router** needs — the full `next/navigation` hook
surface, `<Link>`, dynamic/catch-all routes, nested layouts, `redirect()`,
`notFound()`, and correct push/replace/back across native pages — **is
supported and validated end-to-end**.

The two hard boundaries are inherent, not incidental:

1. **MPA / no shared heap** (🔴): preserved layout instances across bundles,
   parallel/intercepting routes, in-view soft-navigation of a shared tree.
2. **No RSC server** (⚫): Server Components' server guarantees, Server
   Actions, streaming, server-side caching/revalidation, metadata/head.

Both are consequences of the deliberate design (`docs/design.md`): the router
drives *native* multi-page navigation, not an in-memory SPA. Within that
model the Next.js App Router programming model runs faithfully.
