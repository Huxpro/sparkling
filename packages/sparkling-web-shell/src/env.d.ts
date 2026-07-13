declare global {
  interface LynxViewElement extends HTMLElement {
    /** Main-thread callback for NativeModules RPC calls from the Worker */
    onNativeModulesCall?: (
      name: string,
      data: unknown,
      moduleName: string,
    ) => Promise<unknown> | unknown;
    /** Global props exposed to the card as `lynx.__globalProps` */
    globalProps?: unknown;
    /** Map of NativeModule name -> ESM module URL, consumed by the Worker */
    nativeModulesMap?: Record<string, unknown>;
    /** Send a GlobalEventEmitter event into the card */
    sendGlobalEvent?: (eventName: string, params: unknown[]) => void;
  }

  interface HTMLElementTagNameMap {
    'lynx-view': LynxViewElement;
  }
}

export {};
