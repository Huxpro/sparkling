// Import Lynx web runtime and elements
import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

// Import web method handlers (self-registering).
// These register handlers in the main-thread registry where browser APIs
// (localStorage, window.history, document.createElement) are available.
import 'sparkling-navigation/web';
import 'sparkling-storage/web';
import 'sparkling-media/web';

import { getWebMethodHandler } from 'sparkling-method/web-registry';

/**
 * Determine which bundle to load from the ?page= query parameter.
 * Default: "main" -> /main.lynx.bundle
 */
function getBundleUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page') || 'main';
  return `/${page}.lynx.bundle`;
}

let containerSeq = 0;

/**
 * Build the globalProps for a freshly opened page, mirroring what the native
 * Sparkling containers provide: scheme query params via `queryItems` and a
 * unique `containerID` per container instance.
 */
function buildGlobalProps(): Record<string, unknown> {
  const params = new URLSearchParams(window.location.search);
  const queryItems: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== 'page') {
      queryItems[key] = value;
    }
  });
  containerSeq += 1;
  return {
    platform: 'web',
    containerID: `web-${Date.now().toString(36)}-${containerSeq}`,
    containerInitTime: String(Date.now()),
    queryItems,
  };
}

/**
 * Handle NativeModules RPC calls from the Worker thread.
 * When the Lynx bundle calls NativeModules.spkPipe.call(method, data, callback),
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
 * The module exports a default object with a `call` method that the Worker's
 * NativeModules will use. The actual call is bridged to the main thread
 * via web-core's RPC mechanism and handled by onNativeModulesCall.
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

/**
 * Render the Lynx view into the page.
 */
function render(): void {
  const bundleUrl = getBundleUrl();
  const container = document.getElementById('root');
  if (!container) {
    console.error('[sparkling-web-shell] #root element not found');
    return;
  }

  container.innerHTML = '';

  const lynxView = document.createElement('lynx-view') as HTMLElement & {
    globalProps?: unknown;
    onNativeModulesCall?: typeof handleNativeModulesCall;
    nativeModulesMap?: Record<string, unknown>;
  };
  lynxView.setAttribute('url', bundleUrl);
  lynxView.style.width = '100vw';
  lynxView.style.height = '100vh';

  // Provide scheme query params and container identity like native shells do.
  lynxView.globalProps = buildGlobalProps();

  // Register main-thread handler for spkPipe NativeModules calls.
  // Must be set BEFORE adding to DOM (connectedCallback initializes the Worker).
  lynxView.onNativeModulesCall = handleNativeModulesCall;

  // Register spkPipe in the native modules map so the Worker knows it exists.
  const modulesMap = lynxView.nativeModulesMap as Record<string, unknown>;
  if (modulesMap) {
    modulesMap['spkPipe'] = spkPipeModuleUrl;
  }

  container.appendChild(lynxView);
}

// Initial render
render();

// Listen for sparkling:navigate events dispatched by router.open web handler
window.addEventListener('sparkling:navigate', ((event: CustomEvent) => {
  render();
}) as EventListener);

// Re-render when browser navigation changes the URL
window.addEventListener('popstate', render);
