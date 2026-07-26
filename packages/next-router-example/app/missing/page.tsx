// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { notFound } from 'sparkling-next-router/navigation'

/** Calls notFound(); the boundary renders the nearest not-found.tsx. */
export default function Missing() {
  notFound()
  return null
}
