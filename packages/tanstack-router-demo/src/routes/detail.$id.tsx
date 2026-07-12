// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { Screen, NavButton } from '../ui.js';

// MPA extension: this route starts its own native page (bundle / JS context).
// The manifest codegen reads this to build the route->page mapping that
// TanStack's own generator does not produce.
export const page = { id: 'detail', containerParams: { title: 'Detail' } };

export const Route = createFileRoute('/detail/$id')({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === 'string' ? search.ref : undefined,
  }),
  component: DetailPage,
});

function DetailPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  return (
    <Screen title={`Detail #${id}`} accent="#a78bfa">
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>
        {`Path param id=${id}, search ref=${(search as { ref?: string }).ref ?? '?'}.`}
      </text>
      <text style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
        This page booted in its own JS context; params arrived via the scheme.
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
