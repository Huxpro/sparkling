// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/')({
  component: () => (
    <view className="page">
      <text className="title">Settings</text>
      <text className="subtitle">Modal container (hard boundary)</text>
    </view>
  ),
})
