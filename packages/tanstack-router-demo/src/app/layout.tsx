// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Next-style root layout: wraps every route. The gen-next translator turns
// this into the generated tree's root route (children render via Outlet).
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return <view style={{ flex: 1 }}>{children}</view>;
}
