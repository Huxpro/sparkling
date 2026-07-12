# Sparkling Examples

Self-contained Lynx apps that demonstrate Sparkling features. Each example is a
standalone workspace package under `examples/*`.

These examples double as the live gallery on the [Sparkling website](https://tiktok.github.io/sparkling/):
the site embeds them with the [`<Go>`](https://github.com/lynx-community/go-web)
component, which offers **code browsing**, an in-browser **web preview**, and a
**QR code** for on-device testing.

## Layout

```
examples/
  hello-world/            # a Sparkling example package
    src/                  # source browsed on the website
    lynx.config.ts        # builds *.lynx.bundle + *.web.bundle
    dist/                 # build output (gitignored)
```

Every example must build a **web** bundle (for the browser preview) and a
**lynx** bundle (for device / QR). Configure both environments in
`lynx.config.ts`:

```ts
export default defineConfig({
  environments: { lynx: {}, web: {} },
  // ...
})
```

## Adding a new example

1. Create `examples/<name>/` as a workspace package (copy `hello-world` as a
   starting point).
2. Build it — `pnpm --filter @sparkling-example/<name> build`.
3. Reference it from a docs page with `<Go example="<name>" ... />`.

The website regenerates go-web metadata from these folders automatically via
`packages/website/scripts/prepare-examples.mjs` (run on `pnpm dev` / `pnpm build`).
See that script for the exact metadata format.
