// Import Lynx web runtime and elements
import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

// Import web method handlers (self-registering).
// These register handlers in the main-thread registry where browser APIs
// (localStorage, window.history, document.createElement) are available.
import 'sparkling-storage/web';
import 'sparkling-media/web';
import { setRouterWebHost } from 'sparkling-navigation/web';

import { getWebMethodHandler } from 'sparkling-method/web-registry';

/**
 * Sparkling web shell: a browser stand-in for the native container stack.
 *
 * Mirrors the native SDK's model so the web can be used as a faithful
 * development harness for multi-page (MPA-style) navigation:
 *
 * - every `router.open` STACKS a new `<lynx-view>` (its own Worker heap);
 *   the previous view stays alive underneath, hidden — like a backgrounded
 *   native container
 * - `router.close` / browser back pops the top view, revealing the previous
 *   one with its state intact
 * - each view gets `globalProps` (containerID + queryItems parsed from its
 *   scheme) and `viewAppeared`/`viewDisappeared` GlobalEvents, matching the
 *   native SDK's GlobalPropsUtils/ViewEventUtils behavior
 * - browser history entries carry the whole scheme stack in `state`, so
 *   back/forward/reload reconcile the view stack (forward re-creates a
 *   fresh heap — same as a native process restore)
 */

interface StackEntry {
  scheme: string;
  containerID: string;
  view: LynxViewElement;
}

interface ShellHistoryState {
  sparklingStack: string[];
}

const viewStack: StackEntry[] = [];
let nextContainerId = 1;

/**
 * Handle NativeModules RPC calls from a Worker thread.
 * When a Lynx bundle calls NativeModules.spkPipe.call(method, data, callback),
 * web-core bridges the call to this main-thread handler via onNativeModulesCall.
 */
function handleNativeModulesCall(
  name: string,
  data: unknown,
  moduleName: string,
): Promise<unknown> | unknown {
  if (moduleName !== 'spkPipe') {
    return undefined;
  }

  const handler = getWebMethodHandler(name);
  if (!handler) {
    return { code: -3, msg: `Web handler not found for "${name}"` };
  }

  return new Promise((resolve) => {
    handler(
      data as { containerID: string; protocolVersion: string; data: unknown },
      (response) => resolve(response),
    );
  });
}

/**
 * Create a blob URL for a minimal ESM module that acts as the spkPipe
 * NativeModule stub in the Worker. web-core dynamically imports this URL.
 */
const spkPipeModuleCode = `
// Factory called by web-core's createNativeModules.
// Args: (nativeModules, callBridge) where callBridge sends RPC to main thread.
export default function(nativeModules, callBridge) {
  return {
    call(name, data, callback) {
      callBridge(name, data).then(callback);
    }
  };
};
`;
const spkPipeBlob = new Blob([spkPipeModuleCode], { type: 'application/javascript' });
const spkPipeModuleUrl = URL.createObjectURL(spkPipeBlob);

// ── Scheme helpers ─────────────────────────────────────────────────────

function parseSchemeQuery(scheme: string): Record<string, string> {
  const result: Record<string, string> = {};
  const qIndex = scheme.indexOf('?');
  if (qIndex < 0) return result;
  for (const [key, value] of new URLSearchParams(scheme.slice(qIndex + 1))) {
    result[key] = value;
  }
  return result;
}

/**
 * Resolve the bundle URL a scheme points at (dev `url=` wins over `bundle=`).
 *
 * Sparkling schemes name the NATIVE bundle (`<name>.lynx.bundle`), but this
 * shell renders through @lynx-js/web-core, which needs the WEB-target build
 * (`<name>.web.bundle`). So we rewrite the extension when resolving the URL to
 * load — keeping the scheme itself native-shaped.
 */
function toWebBundle(bundlePath: string): string {
  return bundlePath.replace(/\.lynx\.bundle$/, '.web.bundle');
}

/**
 * Base URL the page bundles are served from. Defaults to the shell's own
 * origin root (`/`, used by `rsbuild dev` with LYNX_BUNDLE_DIR). When the shell
 * is embedded elsewhere — e.g. an `<iframe>` on the docs site — the host passes
 * `?base=<url>` so bundles load from the example's deployed `dist/` instead.
 */
const BUNDLE_BASE = (() => {
  const base = new URLSearchParams(window.location.search).get('base') || '';
  return base.replace(/\/+$/, '');
})();

function bundleUrlOf(scheme: string): string | null {
  const query = parseSchemeQuery(scheme);
  if (query.url) return toWebBundle(query.url);
  if (query.bundle) {
    const name = query.bundle.split('/').filter(Boolean).pop() ?? query.bundle;
    return `${BUNDLE_BASE}/${toWebBundle(name)}`;
  }
  return null;
}

/**
 * GlobalProps mirroring the native SDK (GlobalPropsUtils). `queryItems`
 * carries every scheme query param — this is how a page's isolated heap
 * learns its own URL (sparkling-history relies on it).
 */
function globalPropsFor(scheme: string, containerID: string): Record<string, unknown> {
  const queryItems = parseSchemeQuery(scheme);
  queryItems.containerInitTime = String(Date.now());
  return {
    containerID,
    containerInitTime: queryItems.containerInitTime,
    queryItems,
    os: 'web',
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    language: navigator.language,
    theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
}

// ── View stack management ──────────────────────────────────────────────

function rootElement(): HTMLElement | null {
  return document.getElementById('root');
}

function sendViewEvent(entry: StackEntry | undefined, event: 'viewAppeared' | 'viewDisappeared'): void {
  entry?.view.sendGlobalEvent?.(event, []);
}

function createView(scheme: string): StackEntry | null {
  const container = rootElement();
  if (!container) {
    console.error('[sparkling-web-shell] #root element not found');
    return null;
  }

  const bundleUrl = bundleUrlOf(scheme);
  if (!bundleUrl) {
    console.error(`[sparkling-web-shell] scheme has no bundle/url param: ${scheme}`);
    return null;
  }

  const containerID = `web-container-${nextContainerId++}`;
  const lynxView = document.createElement('lynx-view');
  lynxView.setAttribute('url', bundleUrl);
  lynxView.style.cssText =
    'position:absolute;inset:0;width:100vw;height:100vh;';

  // Register main-thread handler for spkPipe NativeModules calls.
  // Must be set BEFORE adding to DOM (connectedCallback initializes the Worker).
  lynxView.onNativeModulesCall = handleNativeModulesCall;
  lynxView.globalProps = globalPropsFor(scheme, containerID);

  // Register spkPipe in the native modules map so the Worker knows it exists.
  const modulesMap = lynxView.nativeModulesMap as Record<string, unknown>;
  if (modulesMap) {
    modulesMap['spkPipe'] = spkPipeModuleUrl;
  }

  const entry: StackEntry = { scheme, containerID, view: lynxView };
  container.appendChild(lynxView);
  return entry;
}

function topEntry(): StackEntry | undefined {
  return viewStack[viewStack.length - 1];
}

function pushView(scheme: string): void {
  const previousTop = topEntry();
  const entry = createView(scheme);
  if (!entry) return;
  if (previousTop) {
    previousTop.view.style.display = 'none';
    sendViewEvent(previousTop, 'viewDisappeared');
  }
  viewStack.push(entry);
}

function popViews(count: number): void {
  for (let i = 0; i < count && viewStack.length > 0; i++) {
    const entry = viewStack.pop()!;
    sendViewEvent(entry, 'viewDisappeared');
    entry.view.remove();
  }
  const revealed = topEntry();
  if (revealed) {
    revealed.view.style.display = '';
    sendViewEvent(revealed, 'viewAppeared');
  }
}

function replaceTopView(scheme: string): void {
  const previousTop = viewStack.pop();
  if (previousTop) {
    sendViewEvent(previousTop, 'viewDisappeared');
    previousTop.view.remove();
  }
  const entry = createView(scheme);
  if (entry) viewStack.push(entry);
}

/** Rebuild the whole stack from schemes (initial load, reload, forward). */
function rebuildStack(schemes: string[]): void {
  while (viewStack.length) {
    viewStack.pop()!.view.remove();
  }
  schemes.forEach((scheme, index) => {
    const entry = createView(scheme);
    if (!entry) return;
    if (index !== schemes.length - 1) entry.view.style.display = 'none';
    viewStack.push(entry);
  });
}

// ── Browser history sync ───────────────────────────────────────────────

function currentSchemes(): string[] {
  return viewStack.map((entry) => entry.scheme);
}

function historyUrlFor(scheme: string): string {
  const query = parseSchemeQuery(scheme);
  const bundle = bundleUrlOf(scheme) ?? '';
  const page = bundle.split('/').filter(Boolean).pop()?.replace(/\.(lynx|web)\.bundle$/, '') ?? 'main';
  const route = query.__hs_route;
  return `?page=${encodeURIComponent(page)}${route ? `&__hs_route=${encodeURIComponent(route)}` : ''}`;
}

function commitHistory(replace: boolean): void {
  const state: ShellHistoryState = { sparklingStack: currentSchemes() };
  const url = historyUrlFor(topEntry()?.scheme ?? '');
  window.history[replace ? 'replaceState' : 'pushState'](state, '', url);
}

/** Derive the initial scheme from the shell URL (`?page=...&<extras>`). */
function initialSchemeFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page') || 'main';
  // `page` selects the entry; `base` configures the shell — neither is a route
  // param, so keep them out of the scheme's query.
  params.delete('page');
  params.delete('base');
  const extras = params.toString();
  return `hybrid://lynxview_page?bundle=${encodeURIComponent(`${page}.lynx.bundle`)}${extras ? `&${extras}` : ''}`;
}

function reconcileWithHistoryState(state: ShellHistoryState | null): void {
  const target = state?.sparklingStack ?? [initialSchemeFromLocation()];
  const current = currentSchemes();

  const isPrefix = (prefix: string[], full: string[]) =>
    prefix.length <= full.length && prefix.every((s, i) => s === full[i]);

  if (target.length < current.length && isPrefix(target, current)) {
    // back: pop views, previous containers stay alive → state preserved
    popViews(current.length - target.length);
  } else if (target.length > current.length && isPrefix(current, target)) {
    // forward: re-create containers from schemes (fresh heaps)
    const previousTop = topEntry();
    if (previousTop) {
      previousTop.view.style.display = 'none';
      sendViewEvent(previousTop, 'viewDisappeared');
    }
    for (const scheme of target.slice(current.length)) {
      const entry = createView(scheme);
      if (entry) viewStack.push(entry);
    }
  } else if (target.join('\n') !== current.join('\n')) {
    rebuildStack(target);
  }
}

// ── Wire up ────────────────────────────────────────────────────────────

// Install a full-page RouterWebHost: instead of the default History-API host,
// the shell owns the whole page, so router.open/close drive the stacked
// <lynx-view> container model directly (see sparkling-navigation's pluggable
// RouterWebHost). The scheme carries everything a new container's heap needs
// (bundle + queryItems), so we push/replace from it and mirror the stack into
// browser history for back/forward/reload.
setRouterWebHost({
  open(_pageName, scheme, options) {
    const replace = options?.replace === true;
    if (replace) {
      replaceTopView(scheme);
    } else {
      pushView(scheme);
    }
    commitHistory(replace);
  },
  close() {
    // Going back through browser history keeps history and the view stack in
    // sync (popstate below pops the revealed container).
    window.history.back();
  },
});

window.addEventListener('popstate', (event) => {
  reconcileWithHistoryState(event.state as ShellHistoryState | null);
});

// Initial render
reconcileWithHistoryState(window.history.state as ShellHistoryState | null);
commitHistory(true);
