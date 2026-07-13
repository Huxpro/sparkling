// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Shared screen UI, used by the file-based routes (src/routes/*).
import { Outlet, useRouterState } from '@tanstack/react-router';
import './transitions.css';

// Navigation direction, derived in module scope. The MPA model runs exactly
// one router (hence one PageTransition) per JS context, so module state is a
// safe stand-in for a ref — and, unlike a hook, it keeps this module importable
// in the DOM/Lynx-free test environment (see tests/generated-tree.test.ts).
//
// The direction is cached against the destination key and only recomputed when
// the key actually changes. That makes it render-safe: React may render a
// component more than once before committing, and recomputing on every render
// would clobber `prevIndex` and misreport the direction on the second pass.
let prevIndex = -1;
let cachedKey: string | null = null;
let cachedDirection: 'forward' | 'back' = 'forward';

function directionFor(key: string, index: number): 'forward' | 'back' {
  if (key !== cachedKey) {
    // A lower index than the previous entry means we popped (slide from the
    // left); otherwise this is a forward push (slide in from the right).
    cachedDirection = prevIndex >= 0 && index < prevIndex ? 'back' : 'forward';
    prevIndex = index;
    cachedKey = key;
  }
  return cachedDirection;
}

/**
 * Wraps the router outlet in a page-enter animation. Rendered by the root
 * route so every navigation — in-page or cross-page (bridged into this card in
 * the go-web preview) — animates its content in.
 *
 * The keyed `<view>` remounts on each location change, replaying the CSS
 * animation; the direction is read from the history stack index so forward
 * opens slide in from the right and back pops from the left (native push/pop).
 */
export function PageTransition() {
  const { frameKey, index } = useRouterState({
    select: (s) => ({
      frameKey: `${s.location.pathname}${s.location.searchStr || ''}`,
      index: (s.location.state as { __TSR_index?: number }).__TSR_index ?? 0,
    }),
  });
  const direction = directionFor(frameKey, index);

  return (
    <view key={frameKey} className={`mpa-page-frame mpa-page-frame--${direction}`}>
      <Outlet />
    </view>
  );
}

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
