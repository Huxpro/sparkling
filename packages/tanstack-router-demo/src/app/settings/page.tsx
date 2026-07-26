// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRouter } from '@tanstack/react-router';
import { Screen, NavButton } from '../../ui.js';

// Native-page boundary: its own native page, presented modally.
export const container = {
  id: 'settings',
  presentation: 'modal',
  containerParams: { title: 'Settings' },
};

export default function SettingsPage() {
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
