# Sparkling Website

The official Sparkling website / documentation, built with [Rspress](https://rspress.dev).
Content lives in [`docs/`](../../docs) (shared markdown, symlinked under `docs/`).

## Local development

```bash
pnpm install            # from the repo root
pnpm --filter sparkling-website dev
```

- `dev` – start the local dev server
- `build` – build the static site into `doc_build/`
- `preview` – preview the production build locally
- `gen:api` – regenerate the TypeDoc API reference pages

## Deployment

The same build powers two targets. The only difference is the base path,
controlled by the `DOCS_BASE` environment variable (default: `/sparkling/`).

### GitHub Pages

Served under the project sub-path `https://tiktok.github.io/sparkling/`.
Deployed by [`.github/workflows/deploy-website.yml`](../../.github/workflows/deploy-website.yml)
using the default base (`/sparkling/`).

### Vercel

Served from the domain root (`/`). Configured by the repo-root
[`vercel.json`](../../vercel.json), which builds with `DOCS_BASE=/` and
publishes `packages/website/doc_build`. No dashboard configuration is
required beyond linking the repository — Vercel reads `vercel.json`
automatically.
