# router-demo

Sparkling Router end-to-end sample.

## What's covered

| Milestone | Status in this example |
| --- | --- |
| **S0** soft nav (TanStack + memory history in one LynxView) | ✅ `src/entries/main.tsx` |
| **S3′** `_container` partition → manifest + entries | ✅ `sparkling-router-plugin` via `pnpm codegen` |
| **S4** native stack protocol | JS + iOS stubs in packages; host wiring next |

## Authoring tree

```
src/routes/
  __root.tsx
  index.tsx                      # "/"
  feed/_container.tsx            # hard boundary
  feed/index.tsx                 # soft "/feed"
  feed/$postId.tsx               # soft "/feed/$postId"
  settings/_container.modal.tsx  # modal hard boundary
  settings/index.tsx
```

## Scripts

```bash
pnpm codegen   # emit route-manifest.gen.json + container stubs
pnpm dev       # rspeedy soft-nav demo
pnpm test      # codegen smoke test
```
