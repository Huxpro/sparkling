// Minimal global-environment polyfills for running TanStack Router in a
// Lynx JS context (no window/document).
//
// - scrollTo: router-core's reset-scroll-on-navigation subscription calls the
//   bare `scrollTo(...)` global even when scrollRestoration is disabled.
//   Scrolling is a per-element concern on Lynx, so a no-op is correct.
// - queueMicrotask / AbortController: guaranteed in web workers (the web
//   harness) but not in every native Lynx JS runtime; provide fallbacks.
const g = globalThis as Record<string, unknown>;

if (typeof g.scrollTo !== 'function') {
  g.scrollTo = () => {};
}

if (typeof g.queueMicrotask !== 'function') {
  g.queueMicrotask = (cb: () => void) => {
    Promise.resolve().then(cb);
  };
}

if (typeof g.AbortController !== 'function') {
  class AbortSignalShim {
    aborted = false;
    reason: unknown = undefined;
    private listeners = new Set<() => void>();
    addEventListener(type: string, cb: () => void) {
      if (type === 'abort') this.listeners.add(cb);
    }
    removeEventListener(type: string, cb: () => void) {
      if (type === 'abort') this.listeners.delete(cb);
    }
    throwIfAborted() {
      if (this.aborted) throw this.reason;
    }
    _abort(reason: unknown) {
      if (this.aborted) return;
      this.aborted = true;
      this.reason = reason;
      this.listeners.forEach((cb) => cb());
    }
    onabort: (() => void) | null = null;
  }
  class AbortControllerShim {
    signal = new AbortSignalShim();
    abort(reason?: unknown) {
      this.signal._abort(reason ?? new Error('Aborted'));
      this.signal.onabort?.();
    }
  }
  g.AbortController = AbortControllerShim;
  g.AbortSignal = AbortSignalShim;
}

export {};
