// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRootRoute } from '@tanstack/react-router';
import { PageTransition } from '../ui.js';

export const Route = createRootRoute({
  // PageTransition renders the <Outlet> inside a page-enter animation so MPA
  // navigation animates in the go-web preview (and on device).
  component: PageTransition,
});
