# next-router-example

A Next.js **App Router** application running on **Sparkling native
navigation** via [`sparkling-next-router`](../sparkling-next-router). Every
route under `app/` becomes its own Lynx bundle; navigation between routes is
native push/pop.

## Routes (each exercises an App Router feature)

| Route | Feature demonstrated |
| --- | --- |
| `app/layout.tsx` | root layout (wraps every page) |
| `app/page.tsx` | home; `<Link>` + `useRouter().push` |
| `app/products/[id]/page.tsx` | dynamic route, `useParams`, same-bundle push, `router.back()` |
| `app/search/page.tsx` | `useSearchParams`, same-page `router.replace` |
| `app/dashboard/layout.tsx` + `page.tsx` | nested layout, `usePathname` |
| `app/redirect-demo/page.tsx` | `redirect()` during render |
| `app/missing/page.tsx` + `app/not-found.tsx` | `notFound()` boundary |

## Build & run in the web harness

```bash
pnpm --filter next-router-example build:web      # scan app/, codegen, build Lynx web bundles
# serve the bundles through the Lynx web shell:
LYNX_BUNDLE_DIR=$(pwd)/dist/web pnpm --filter sparkling-web-shell dev
# open http://localhost:4200/?page=index
```

`lynx.config.ts` calls `createNextAppRouter({ appDir: './app' })` and feeds
the generated per-route entries to rspeedy `source.entry`. Generated files
land in `.sparkling/next-router/` (gitignored).

## Validation

All routes were driven end-to-end in the web harness with Playwright
(16/16 checks: cross-page nav, dynamic params, `useParams`/`usePathname`/
`useSearchParams`, same-bundle push, virtual + native `router.back()`,
same-page `replace`, nested layout, `redirect()`, `notFound()`). See
[`sparkling-next-router/docs/compatibility-matrix.md`](../sparkling-next-router/docs/compatibility-matrix.md).
