# sparkling-next-router

Run the **Next.js App Router** programming model on **ReactLynx**, driving
**native multi-page navigation** through `sparkling-navigation`. Each route
is its own Lynx page (own bundle, own JS heap); navigation between routes is
native push/pop.

This is the L2 adapter on top of
[`sparkling-history-shim`](../sparkling-history-shim) (L1) and the
`NavigationHost` contract (L0). See
[`docs/design.md`](./docs/design.md) and
[`docs/nextjs-dom-dependency-catalog.md`](./docs/nextjs-dom-dependency-catalog.md).

## Build integration (rspeedy / rsbuild)

```ts
// lynx.config.ts
import { defineConfig } from '@lynx-js/rspeedy'
import { createNextAppRouter } from 'sparkling-next-router/build'

const nextRouter = createNextAppRouter({ appDir: './app' })

export default defineConfig({
  source: { entry: nextRouter.entry },  // one Lynx bundle per route
  // Optional: let `import ... from 'next/navigation'` compile unmodified.
  tools: { rspack: { resolve: { alias: nextRouter.alias } } },
})
```

`createNextAppRouter` scans the `app/` directory (Next.js file convention),
generates one bundle entry per route plus a route manifest, and returns the
`source.entry` map. No bundler fork required — output is ordinary
`[name].lynx.bundle` files.

## App code

Author routes with the Next.js conventions (`app/page.tsx`,
`app/layout.tsx`, `app/products/[id]/page.tsx`, …) and the familiar hooks:

```tsx
// app/products/[id]/page.tsx
import { useRouter, useParams, useSearchParams } from 'sparkling-next-router/navigation'
import { Link } from 'sparkling-next-router/runtime'

export default function Product({ params }) {
  const router = useRouter()
  return (
    <view>
      <text>Product {params.id}</text>
      <Link href="/">Home</Link>
      <view bindtap={() => router.push('/products/2')}><text>Next</text></view>
    </view>
  )
}
```

`useRouter`, `usePathname`, `useSearchParams`, `useParams`,
`useSelectedLayoutSegment(s)`, `redirect`, `permanentRedirect`, `notFound`,
and `ReadonlyURLSearchParams` are API-compatible with `next/navigation`.

## Supported / not supported

See [`docs/compatibility-matrix.md`](./docs/compatibility-matrix.md) for the
full feature-by-feature verdict against the Next.js App Router.
