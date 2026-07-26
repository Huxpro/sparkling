// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { usePathname } from 'sparkling-next-router/navigation'
import { Link } from 'sparkling-next-router/runtime'

export default function Dashboard() {
  const pathname = usePathname()
  return (
    <view>
      <text style={{ color: '#fff', fontSize: '16px' }}>Dashboard</text>
      <text testId="pathname" style={{ color: '#4de1c1', marginTop: '8px' }}>
        usePathname() = {pathname}
      </text>
      <Link href="/" style={{ padding: '14px', marginTop: '10px', backgroundColor: '#1c1c26', borderRadius: '10px' }}>
        <text style={{ color: '#4de1c1' }}>Link → Home</text>
      </Link>
    </view>
  )
}
