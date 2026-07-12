// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Screen, NavButton } from '../ui.js';

// MPA extension: its own native page.
export const page = { id: 'settings', containerParams: { title: 'Settings' } };

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const router = useRouter();
  return (
    <Screen title="Settings" accent="#fbbf24">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        Another native page. Back returns to whoever opened it.
      </text>
      <NavButton label="← Back (native pop)" color="#374151" onTap={() => router.history.back()} />
    </Screen>
  );
}
