// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { redirect } from 'sparkling-next-router/navigation'

/**
 * Calls redirect() during render — the NavigationErrorBoundary catches the
 * thrown digest and routes to /products/1, exactly like Next.js.
 */
export default function RedirectDemo() {
  redirect('/products/1')
  return null
}
