// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Native (default) variant: a no-op. On native, cross-page navigation opens a
// real separate LynxView through `sparkling-navigation`'s native bridge, so
// there is nothing to wire here — and importantly we must NOT register any web
// method handler (that would hijack the native `pipe.call`).
//
// The website (go-web) build resolves `web-nav/setup.web.ts` instead, via the
// `.web.ts` extension configured in `lynx.web.config.ts`.

export interface SetupWebNavOptions {
  /** The MPA history driving this router. */
  history: { push(href: string): void; back(): void };
  /** Enter the re-entrancy guard so nested navigation stays in-page. */
  onEnterInPage(): void;
  /** Leave the re-entrancy guard. */
  onExitInPage(): void;
}

export function setupWebNav(_opts: SetupWebNavOptions): void {
  // no-op on native
}
