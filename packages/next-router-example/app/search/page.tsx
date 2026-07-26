// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRouter, useSearchParams } from 'sparkling-next-router/navigation'
import { Link } from 'sparkling-next-router/runtime'

/** Reads query via useSearchParams(); demonstrates same-page search updates. */
export default function Search() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? '(none)'
  const sort = searchParams.get('sort') ?? '(none)'
  return (
    <view>
      <text style={{ color: '#fff', fontSize: '16px' }}>Search page</text>
      <text testId="q" style={{ color: '#4de1c1', marginTop: '8px' }}>q = {q}</text>
      <text testId="sort" style={{ color: '#4de1c1' }}>sort = {sort}</text>

      <view
        testId="replace-sort"
        style={{ padding: '14px', marginTop: '12px', backgroundColor: '#1c1c26', borderRadius: '10px' }}
        bindtap={() => router.replace('/search?q=lynx&sort=top')}
      >
        <text style={{ color: '#ffd479' }}>router.replace(sort=top) — same page, no new native page</text>
      </view>

      <Link href="/" style={{ padding: '14px', marginTop: '10px', backgroundColor: '#1c1c26', borderRadius: '10px' }}>
        <text style={{ color: '#4de1c1' }}>Link → Home</text>
      </Link>
    </view>
  )
}
