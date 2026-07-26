// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from '@lynx-js/react'

/** Nested layout for /dashboard/*. Composes inside the root layout. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <view style={{ borderWidth: '1px', borderColor: '#333', borderRadius: '10px', padding: '12px' }}>
      <text testId="dash-layout" style={{ color: '#8ab4ff', marginBottom: '8px' }}>
        [dashboard layout]
      </text>
      {children}
    </view>
  )
}
