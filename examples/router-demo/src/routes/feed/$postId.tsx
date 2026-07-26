// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/feed/$postId')({
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()
  return (
    <view className="page">
      <text className="title">Post {postId}</text>
      <text className="subtitle">Deep soft route — same LynxView / runtime</text>
      <Link to="/feed">
        <view className="btn">
          <text className="btn-text">Back to feed</text>
        </view>
      </Link>
    </view>
  )
}
