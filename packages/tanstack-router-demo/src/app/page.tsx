// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useNavigate } from '@tanstack/react-router';
import { Screen, NavButton } from '../ui.js';

// Native-page boundary marker for the Next-style frontend (the analogue of the
// TanStack convention's `export const page`): the root page of the app.
export const container = { id: 'home', root: true };

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <Screen title="Home (next-style)" accent="#4ade80">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        Authored via the Next-style app directory; running on the same TanStack
        core and sparkling-history runtime as the TanStack-convention app.
      </text>
      <NavButton
        label="Profile (in-page →)"
        color="#166534"
        onTap={() => navigate({ to: '/profile' })}
      />
      <NavButton
        label="Detail #42 (native page ⇒)"
        color="#7c3aed"
        onTap={() => navigate({ to: '/detail/$id', params: { id: '42' }, search: { ref: 'home' } })}
      />
      <NavButton
        label="Settings (native page ⇒)"
        color="#b45309"
        onTap={() => navigate({ to: '/settings' })}
      />
    </Screen>
  );
}
