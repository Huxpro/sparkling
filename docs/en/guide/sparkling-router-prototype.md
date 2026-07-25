# Sparkling Router Prototype Findings

Status: prototype
Date: 2026-07-25

This prototype evaluates a URL-first declarative router over
`sparkling-navigation`, with native containers as hard navigation boundaries
and memory history inside each container.

## Conclusions

### 1. Reuse TanStack core, but do not import it as a complete router API

`@tanstack/router-core` contains the matching, loading, navigation, search, and
route-tree machinery. It intentionally does not export framework-neutral
`createRouter`, `createRoute`, or `createRootRoute` factories. TanStack's own
framework packages subclass `RouterCore`, `BaseRoute`, and `BaseRootRoute` to
provide those factories and framework extensions.

For ReactLynx, the lowest-risk architecture is therefore:

- use the official `@tanstack/react-router` binding;
- keep `@tanstack/router-core` and `@tanstack/history` pinned as the underlying
  core contracts;
- implement only Sparkling's `RouterHistory`, serializable manifest, and native
  host adapter.

Creating a separate Sparkling subclass layer would copy internal framework
binding work and make upstreaming harder without improving the ReactLynx
authoring experience.

### 2. TanStack file routing is the primary authoring path

The official `@tanstack/router-generator` and
`@tanstack/router-plugin/rspack` work with Rspeedy. They should continue to own
`routeTree.gen.ts`, typed routes, params, search, loaders, and links.

Sparkling adds one orthogonal compiler pass:

- find `_container.tsx` or `_container.modal.tsx` boundaries;
- partition routes into native bundles;
- emit a serializable global manifest and an entry map.

The prototype's compiler uses the TypeScript AST for static route/config
extraction. It does not evaluate application source.

### 3. A Next app-directory frontend can target the same core

The second scanner maps `app/**/page.tsx`, dynamic `[id]` segments, route groups,
and optional `container.ts` boundaries into the same manifest schema. Tests
prove equivalent TanStack and Next directory trees produce equivalent
container manifests.

This validates "one core, two authoring frontends" at the routing-data layer.
It does not yet implement a Next runtime or compatibility components such as
`next/link`, `useRouter`, `loading.tsx`, and `error.tsx`.

## Evidence

- `sparkling-history`: 29 tests cover in-container history parity, native page
  forwarding, scheme transport, and back-at-root behavior.
- `sparkling-router`: 3 tests run a real TanStack router over Sparkling history,
  including cross-container navigation.
- `sparkling-router-plugin`: 3 tests cover TanStack boundaries, equivalent Next
  output, and non-evaluating AST extraction.
- `tanstack-router-demo`: 16 tests cover generated route trees, params, search,
  loaders, redirects, errors, blockers, and MPA forwarding.
- Rspeedy builds four native bundles successfully: `spike`, `home`, `detail`,
  and `settings`.

## Remaining Gate

This prototype does not freeze the native stack protocol. The next gate is the
iOS minimum implementation and conformance test for:

- stack state and monotonic versions;
- push, pop, replace, reset, and getState;
- native gesture-driven `stackchanged`;
- `syncOwnLocation`;
- prefetch and result delivery.

Only after that gate should `sparkling-history` be promoted to the full
`CompositeHistory` described by the RFC.
