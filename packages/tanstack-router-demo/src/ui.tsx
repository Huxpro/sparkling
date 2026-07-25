// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Shared screen UI, used by the file-based routes (src/routes/*).
import { useRouterState } from '@tanstack/react-router';

export function Screen(props: { title: string; accent: string; children?: unknown }) {
  const state = useRouterState();
  return (
    <view style={{ padding: '48px 20px 20px', backgroundColor: '#0d0d0f', height: '100%' }}>
      <text style={{ color: props.accent, fontSize: '13px', marginBottom: '4px' }}>
        {`location: ${state.location.pathname}${state.location.searchStr || ''}`}
      </text>
      <text style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        {props.title}
      </text>
      {props.children as never}
    </view>
  );
}

export function NavButton(props: { label: string; color: string; onTap: () => void }) {
  return (
    <view
      style={{
        backgroundColor: props.color,
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '12px',
      }}
      bindtap={props.onTap}
    >
      <text style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>{props.label}</text>
    </view>
  );
}
