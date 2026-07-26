// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Hard container boundary marker.
 * In a multi-entry build this subtree becomes its own Lynx bundle.
 * For the S0 soft-nav demo the whole tree still runs in `main`.
 */
export default {
  presentation: 'push' as const,
}
