# @sparkling-example/hello-world

A minimal [Sparkling](https://github.com/tiktok/sparkling) Lynx example: a single
page with a tap counter.

It is authored with [ReactLynx](https://lynxjs.org) and builds two bundles:

- `dist/main.lynx.bundle` — runs on device (Android / iOS, or Lynx Explorer via QR).
- `dist/main.web.bundle` — runs in the browser, powering the live web preview
  embedded on the Sparkling website through the [`<Go>`](https://github.com/lynx-community/go-web)
  component.

## Develop

```bash
pnpm dev      # start the rspeedy dev server
pnpm build    # produce dist/ (both lynx + web bundles)
```

## How it reaches the website

The website's `prepare-examples` script scans every folder under `examples/`,
generates a go-web `example-metadata.json`, and copies the source + `dist/` into
`packages/website/public/examples/`. A docs page then embeds it with:

```mdx
<Go example="hello-world" defaultFile="src/App.tsx" defaultEntryName="main" />
```
