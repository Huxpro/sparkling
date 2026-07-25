// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Screen, NavButton } from '../ui.js';

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  return (
    <Screen title="Profile" accent="#4ade80">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        This is an in-page route inside the Home bundle — no native page was
        opened to get here.
      </text>
      <NavButton label="← Back to Home (in-page)" color="#166534" onTap={() => navigate({ to: '/' })} />
    </Screen>
  );
}
