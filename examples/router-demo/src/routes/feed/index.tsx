// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/feed/')({
  component: FeedPage,
})

function FeedPage() {
  return (
    <view className="page">
      <text className="title">Feed</text>
      <text className="subtitle">Soft route inside the feed container boundary</text>
      <Link to="/feed/$postId" params={{ postId: '42' }}>
        <view className="btn">
          <text className="btn-text">Post 42</text>
        </view>
      </Link>
      <Link to="/">
        <view className="btn btn-secondary">
          <text className="btn-text">Home</text>
        </view>
      </Link>
    </view>
  )
}
