// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <view className="page">
      <text className="title">Sparkling Router</text>
      <text className="subtitle">S0 soft navigation inside one container</text>
      <Link to="/feed">
        <view className="btn">
          <text className="btn-text">Open feed (soft)</text>
        </view>
      </Link>
    </view>
  )
}
