// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useParams, useRouter } from 'sparkling-next-router/navigation'
import { Link } from 'sparkling-next-router/runtime'

/** Dynamic route: /products/[id]. Reads the route param via useParams(). */
export default function Product({ params }: { params: { id: string } }) {
  const router = useRouter()
  const hookParams = useParams<{ id: string }>()
  const id = params.id
  const nextId = String(Number(id) + 1)
  return (
    <view>
      <text style={{ color: '#fff', fontSize: '16px' }}>Product page</text>
      <text testId="param-id" style={{ color: '#4de1c1', marginTop: '8px' }}>
        params.id = {id}
      </text>
      <text testId="hook-id" style={{ color: '#4de1c1' }}>
        useParams().id = {hookParams.id}
      </text>

      <view
        style={{ padding: '14px', marginTop: '12px', backgroundColor: '#1c1c26', borderRadius: '10px' }}
        bindtap={() => router.push(`/products/${nextId}`)}
      >
        <text style={{ color: '#ffd479' }}>push /products/{nextId} (same bundle, new native page)</text>
      </view>

      <Link href="/" style={{ padding: '14px', marginTop: '10px', backgroundColor: '#1c1c26', borderRadius: '10px' }}>
        <text style={{ color: '#4de1c1' }}>Link → Home</text>
      </Link>

      <view
        style={{ padding: '14px', marginTop: '10px', backgroundColor: '#1c1c26', borderRadius: '10px' }}
        bindtap={() => router.back()}
      >
        <text style={{ color: '#ff8080' }}>router.back() (native back)</text>
      </view>
    </view>
  )
}
