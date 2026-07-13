// Minimal `react-dom` surface for ReactLynx.
//
// @tanstack/react-router's main entry imports exactly one symbol from
// react-dom at module scope: `flushSync` (used by <Link> to synchronously
// flip its `isTransitioning` state before navigating). ReactLynx is
// Preact-based and renders synchronously outside of batched contexts, so
// executing the callback directly preserves the intended semantics.
//
// The bundler aliases `react-dom` to this file (see lynx.config.ts).
export function flushSync<R>(fn: () => R): R {
  return fn();
}

export default { flushSync };
