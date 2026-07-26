// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Link } from 'sparkling-next-router/runtime'

export default function NotFound() {
  return (
    <view>
      <text testId="not-found" style={{ color: '#ff8080', fontSize: '16px' }}>
        404 — Not Found
      </text>
      <Link href="/" style={{ padding: '14px', marginTop: '10px', backgroundColor: '#1c1c26', borderRadius: '10px' }}>
        <text style={{ color: '#4de1c1' }}>Link → Home</text>
      </Link>
    </view>
  )
}
