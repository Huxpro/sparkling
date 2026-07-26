// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useNavigate } from '@tanstack/react-router';
import { Screen, NavButton } from '../../ui.js';

// No `container` export: this route lives in the root page's bundle (in-page).
export default function ProfilePage() {
  const navigate = useNavigate();
  return (
    <Screen title="Profile" accent="#4ade80">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        In-page route inside the Home bundle — no native page was opened.
      </text>
      <NavButton label="← Back to Home (in-page)" color="#166534" onTap={() => navigate({ to: '/' })} />
    </Screen>
  );
}
