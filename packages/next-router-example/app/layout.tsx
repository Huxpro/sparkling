// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from '@lynx-js/react'

/** Root layout — wraps every route. On MPA each page re-mounts this. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <view style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0b0b0f' }}>
      <view style={{ padding: '16px', backgroundColor: '#16161d' }}>
        <text style={{ color: '#4de1c1', fontSize: '18px', fontWeight: 'bold' }}>Next Router · Sparkling</text>
      </view>
      <view style={{ flex: '1', padding: '16px' }}>{children}</view>
    </view>
  )
}
