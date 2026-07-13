// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Web (go-web `<Go>`) variant. Selected over `setup.ts` by the `.web.ts`
// extension in `lynx.web.config.ts`.
//
// Importing `sparkling-navigation/web` registers the sparkling `router.open` /
// `router.close` web methods (via `sparkling-method`'s web registry), so a
// cross-page `pipe.call('router.open')` dispatches to them in the browser
// instead of hitting the (absent) native `spkPipe` module. We then point their
// pluggable host (`setRouterWebHost`, added in the upstream web-method PR) at
// THIS card: a go-web card renders one bundle and cannot swap to another, so we
// render the destination route in-page here. This bundle already contains the
// whole route tree, so Detail/Settings render in the same card — the preview
// shows the full app navigating live, while a real device keeps the MPA split
// (each page a separate native LynxView).
import { setRouterWebHost } from 'sparkling-navigation/web';

import type { SetupWebNavOptions } from './setup.js';

export type { SetupWebNavOptions };

export function setupWebNav({
  history,
  onEnterInPage,
  onExitInPage,
}: SetupWebNavOptions): void {
  setRouterWebHost({
    open(_pageName, scheme) {
      // The destination app-relative href is carried on the scheme by
      // createSparklingHost as `__mpa_href` (e.g. /detail/42?ref=home).
      let href = '/';
      try {
        href = new URL(scheme).searchParams.get('__mpa_href') ?? '/';
      } catch {
        /* keep default */
      }
      onEnterInPage();
      try {
        history.push(href);
      } finally {
        onExitInPage();
      }
    },
    close() {
      history.back();
    },
  });
}
