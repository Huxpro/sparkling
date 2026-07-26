// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRouter } from 'sparkling-next-router/navigation'
import { Link } from 'sparkling-next-router/runtime'

const rowStyle = {
  padding: '14px',
  marginTop: '10px',
  backgroundColor: '#1c1c26',
  borderRadius: '10px',
} as const

/** Home page. Demonstrates <Link> (declarative) and useRouter().push (imperative). */
export default function Home() {
  const router = useRouter()
  return (
    <view>
      <text style={{ color: '#fff', fontSize: '16px' }}>Home (/)</text>

      <Link href="/products/42" style={rowStyle}>
        <text style={{ color: '#4de1c1' }}>Link → /products/42 (dynamic param)</text>
      </Link>

      <Link href="/search?q=lynx&sort=new" style={rowStyle}>
        <text style={{ color: '#4de1c1' }}>Link → /search?q=lynx (search params)</text>
      </Link>

      <Link href="/dashboard" style={rowStyle}>
        <text style={{ color: '#4de1c1' }}>Link → /dashboard (nested layout)</text>
      </Link>

      <Link href="/redirect-demo" style={rowStyle}>
        <text style={{ color: '#4de1c1' }}>Link → /redirect-demo (redirect())</text>
      </Link>

      <Link href="/missing" style={rowStyle}>
        <text style={{ color: '#4de1c1' }}>Link → /missing (notFound())</text>
      </Link>

      <view style={rowStyle} bindtap={() => router.push('/products/7')}>
        <text style={{ color: '#ffd479' }}>router.push('/products/7')</text>
      </view>
    </view>
  )
}
