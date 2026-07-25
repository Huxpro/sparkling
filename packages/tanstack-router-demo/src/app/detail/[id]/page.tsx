// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useNavigate, useParams, useRouter, useSearch } from '@tanstack/react-router';
import { Screen, NavButton } from '../../../ui.js';

// Native-page boundary: /detail/* starts its own native page (bundle).
export const container = { id: 'detail', containerParams: { title: 'Detail' } };

// Extra TanStack route options the translator spreads into the generated
// route (functions can't be compiled into the manifest, so they pass through
// as code, not data).
export const routeOptions = {
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === 'string' ? search.ref : undefined,
  }),
};

export default function DetailPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { id } = useParams({ strict: false }) as { id?: string };
  const search = useSearch({ strict: false }) as { ref?: string };
  return (
    <Screen title={`Detail #${id}`} accent="#a78bfa">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>
        {`Path param id=${id}, search ref=${search.ref ?? '?'}.`}
      </text>
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        Authored as app/detail/[id]/page.tsx; booted in its own JS context.
      </text>
      <NavButton
        label="Detail #43 (in-page →)"
        color="#5b21b6"
        onTap={() => navigate({ to: '/detail/$id', params: { id: '43' }, search: { ref: 'detail' } })}
      />
      <NavButton label="← Back (native pop)" color="#374151" onTap={() => router.history.back()} />
    </Screen>
  );
}
