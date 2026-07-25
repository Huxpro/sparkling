// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Screen, NavButton } from '../ui.js';

// MPA extension: the root page. Any route without its own `page` export
// (e.g. /profile) belongs to this bundle.
export const page = { id: 'home', root: true };

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  return (
    <Screen title="Home" accent="#4ade80">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        Home and Profile share one bundle (in-page nav). Detail and Settings are
        separate native pages.
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
