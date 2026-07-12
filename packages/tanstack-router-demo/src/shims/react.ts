// `react` shim for running TanStack Router on ReactLynx.
//
// ReactLynx's `react` alias (@lynx-js/react) lacks a few React 18/19 APIs
// that @tanstack/react-router's dist accesses as named ESM bindings:
//   - startTransition / useTransition — provided by @lynx-js/react/compat
//   - use — React 19 only; TanStack falls back to a Suspense-throwing shim
//     when it is undefined, so exporting undefined is sufficient (it only
//     needs the binding to exist for strict ESM linking).
//
// The bundler aliases `react$` to this file; @lynx-js/react imports below
// still resolve through ReactLynx's per-thread layer aliases.
export * from '@lynx-js/react';
export { default } from '@lynx-js/react';
export { startTransition, useTransition } from '@lynx-js/react/compat';

export const use = undefined;
