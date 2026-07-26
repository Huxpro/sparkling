// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '../shims/env.js';
import { root } from '@lynx-js/react';
import { RouterProvider } from '@tanstack/react-router';
import { createMpaRouter } from './create-router.js';

/**
 * Boot a page. Every page bundle calls this; the router derives its initial
 * location from the launch queryItems (`__mpa_href`), so the same code renders
 * Home in the home bundle and Detail in the detail bundle. `pageId` names the
 * page this bundle serves — external deep links (no `__mpa_href`) fall back to
 * that page's default route instead of the app root. A non-default authoring
 * frontend passes its own `routeTree`/`manifest` pair; the boot is identical.
 */
export function mount(opts: Parameters<typeof createMpaRouter>[0]) {
  const router = createMpaRouter(opts);
  root.render(<RouterProvider router={router as never} />);
}
