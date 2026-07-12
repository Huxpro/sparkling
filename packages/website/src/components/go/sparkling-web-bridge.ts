// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Wires Sparkling's experimental Web method support (tiktok/sparkling#22) into
 * go-web's `<lynx-view>` preview so the demos can run Sparkling methods
 * (navigation, storage, media) live in the browser.
 *
 * How it works (mirrors `sparkling-web-shell`, adapted to go-web which owns the
 * `<lynx-view>`):
 *
 *  1. The `/web` method modules self-register handlers into sparkling-method's
 *     web registry on the **main thread**, where `window`/`localStorage`/`document`
 *     are available.
 *  2. The Lynx bundle runs in a **worker**. When it calls
 *     `NativeModules.spkPipe.call(method, data, cb)`, web-core needs a `spkPipe`
 *     module. We register one (a tiny ESM stub) via each lynx-view's
 *     `nativeModulesMap`; the stub RPC-bridges the call to the main thread.
 *  3. On the main thread, `onNativeModulesCall` dispatches to the registered web
 *     handler and returns the response over the same RPC channel.
 *  4. The `router.open` web handler dispatches a `sparkling:navigate` event; we
 *     listen for it and swap the active preview's bundle, so navigation actually
 *     loads the target page.
 *
 * go-web exposes no native-modules hook, so we install the bridge by patching
 * the `lynx-view` custom element's `connectedCallback` (web-core reads
 * `nativeModulesMap` during connect, so it must be set before the original runs).
 */

// Self-registering web handlers -> sparkling-method web registry (main thread).
import { setRouterWebHost } from 'sparkling-navigation/web';
import 'sparkling-storage/web';
import 'sparkling-media/web';
import { getWebMethodHandler } from 'sparkling-method/web-registry';

type LynxViewLike = HTMLElement & {
  url?: string;
  globalProps?: unknown;
  reload?: () => void;
  nativeModulesMap?: Record<string, string>;
  onNativeModulesCall?: (name: string, data: unknown, moduleName: string) => unknown;
};

// A navigable "page" in a preview's stack: which bundle + the globalProps
// (carrying scheme queryItems like `depth`) the page was opened with.
type NavState = { url: string; globalProps: unknown };

// The envelope sparkling-method sends: { containerID, protocolVersion, data }.
type MethodEnvelope = { containerID: string; protocolVersion: string; data: unknown };

let installed = false;

export function installSparklingWebBridge(): void {
  if (installed) return;
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  installed = true;

  // spkPipe NativeModule stub, imported by web-core inside the worker.
  // web-core calls `default(nativeModules, callBridge)`; `callBridge(name, data)`
  // sends an RPC to the main thread (handled by `onNativeModulesCall`).
  const spkPipeModuleCode = `export default function (nativeModules, callBridge) {
  return {
    call(name, data, callback) {
      callBridge(name, data).then(callback);
    },
  };
};`;
  const spkPipeModuleUrl = URL.createObjectURL(
    new Blob([spkPipeModuleCode], { type: 'application/javascript' }),
  );

  // The lynx-view that most recently issued a Sparkling call. Web method
  // handlers run on the shared main thread, so we use this to scope navigation
  // to the preview that triggered the call.
  let activeLynxView: LynxViewLike | null = null;

  // Per-preview back stack of NavStates, so `router.close` pops within a single
  // <lynx-view> instead of touching the top-level browser history.
  const backStacks = new WeakMap<LynxViewLike, NavState[]>();

  // .../dist/<current>.web.bundle -> .../dist/<page>.web.bundle (same URL if the
  // page navigates to itself, e.g. the navigation-stack demo).
  const bundleUrlFor = (el: LynxViewLike, pageName: string): string | null => {
    if (typeof el.url !== 'string') return null;
    return el.url.replace(/[^/]+\.web\.bundle$/, `${pageName}.web.bundle`);
  };

  // Turn a router scheme's query string into the `queryItems` a Sparkling page
  // reads from `lynx.__globalProps.queryItems` (native passes them the same way).
  const parseQueryItems = (scheme: string): Record<string, string> => {
    const items: Record<string, string> = {};
    try {
      new URL(scheme).searchParams.forEach((value, key) => {
        if (key !== 'bundle' && key !== 'url') items[key] = value;
      });
    } catch {
      /* not a parseable URL — no query items */
    }
    return items;
  };

  // Load a NavState into a preview. Set globalProps first so the (re)render
  // picks it up; changing `url` triggers a reload, but navigating to the same
  // bundle (self-push) needs an explicit reload().
  const applyState = (el: LynxViewLike, state: NavState): void => {
    el.globalProps = state.globalProps;
    if (el.url !== state.url) {
      el.url = state.url;
    } else {
      el.reload?.();
    }
  };

  // Scope navigation to the calling preview (the go-web card) instead of the
  // default host's global window.history — otherwise router.open pollutes the
  // site URL and router.close navigates the whole docs page away.
  setRouterWebHost({
    open(pageName, scheme) {
      const el = activeLynxView;
      if (!el || typeof el.url !== 'string') return;
      const targetUrl = bundleUrlFor(el, pageName) ?? el.url;
      // Remember the current page so `close` can return to it.
      const stack = backStacks.get(el) ?? [];
      stack.push({ url: el.url, globalProps: el.globalProps });
      backStacks.set(el, stack);
      // Merge queryItems into globalProps, mirroring how native delivers scheme
      // params to the opened page.
      const base = (el.globalProps ?? {}) as Record<string, unknown>;
      applyState(el, {
        url: targetUrl,
        globalProps: { ...base, queryItems: parseQueryItems(scheme) },
      });
    },
    close() {
      const el = activeLynxView;
      if (!el) return;
      const prev = backStacks.get(el)?.pop();
      if (prev) applyState(el, prev);
    },
  });

  const makeNativeModulesCall =
    (el: LynxViewLike) => (name: string, data: unknown, moduleName: string) => {
      if (moduleName !== 'spkPipe') return undefined;
      activeLynxView = el;
      const handler = getWebMethodHandler(name);
      if (!handler) {
        return { code: -3, msg: `Web handler not found for "${name}"` };
      }
      return new Promise((resolve) => {
        handler(data as MethodEnvelope, (response) => resolve(response));
      });
    };

  type BridgeableLynxView = LynxViewLike & {
    __sparklingBridged?: boolean;
    isConnected: boolean;
    reload?: () => void;
  };

  // Install the spkPipe bridge onto one <lynx-view>.
  // `viaConnect` = true means we're inside connectedCallback (before web-core
  // reads `nativeModulesMap`), so no reload is needed. When we reach an element
  // that already started rendering without spkPipe, reload it so its worker
  // picks up the module.
  function installOnElement(el: BridgeableLynxView, viaConnect: boolean): void {
    if (el.__sparklingBridged) return;
    el.__sparklingBridged = true;
    try {
      const map = el.nativeModulesMap ?? {};
      const hadSpk = !!map.spkPipe;
      if (!hadSpk) el.nativeModulesMap = { ...map, spkPipe: spkPipeModuleUrl };
      el.onNativeModulesCall = makeNativeModulesCall(el);
      if (!viaConnect && !hadSpk && el.isConnected && typeof el.reload === 'function') {
        el.reload();
      }
    } catch (err) {
      console.error('[sparkling-web-bridge] failed to install spkPipe', err);
    }
  }

  customElements
    .whenDefined('lynx-view')
    .then(() => {
      const Ctor = customElements.get('lynx-view') as
        | (CustomElementConstructor & { prototype: { __sparklingPatched?: boolean } })
        | undefined;
      if (!Ctor) return;
      const proto = Ctor.prototype as {
        __sparklingPatched?: boolean;
        connectedCallback?: (this: BridgeableLynxView) => void;
      };
      if (!proto.__sparklingPatched) {
        proto.__sparklingPatched = true;
        const originalConnected = proto.connectedCallback;
        proto.connectedCallback = function patchedConnectedCallback(this: BridgeableLynxView) {
          installOnElement(this, true);
          return originalConnected?.apply(this);
        };
      }

      // Bridge any <lynx-view> that connected before the patch was installed
      // (go-web may create the element in the same tick web-core loads).
      document
        .querySelectorAll('lynx-view')
        .forEach((el) => installOnElement(el as BridgeableLynxView, false));

      // Defensively catch any future elements the patch might miss.
      new MutationObserver((records) => {
        for (const rec of records) {
          rec.addedNodes.forEach((node) => {
            if ((node as Element).tagName?.toLowerCase() === 'lynx-view') {
              installOnElement(node as BridgeableLynxView, false);
            }
          });
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    })
    .catch(() => {
      /* web-core never loaded (no web preview on this page) — nothing to do. */
    });
}

// Auto-install on import (no-op during SSR and on pages without a web preview).
installSparklingWebBridge();
