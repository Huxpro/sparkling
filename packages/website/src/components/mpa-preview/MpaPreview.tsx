// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useMemo } from 'react';
import { withBase } from '@rspress/core/runtime';

/**
 * `<MpaPreview>` — a launcher for a LIVE, cross-page (MPA) demo of a Sparkling
 * example.
 *
 * The go-web `<Go>` component previews one Lynx card with no native bridge, so
 * cross-page navigation (`router.open`) can't run in it. This opens the
 * Sparkling web shell (`/mpa-preview/`, built by `build-mpa-preview.mjs`) in a
 * NEW TAB: the shell stacks a `<lynx-view>` per container, provides the
 * `spkPipe` method bridge, and installs a `RouterWebHost` — a faithful
 * in-browser multi-container environment.
 *
 * A new tab (rather than an inline iframe) is deliberate: the shell owns the
 * whole page, so the browser's own back/forward buttons drive its history —
 * the real MPA navigation stack — instead of being trapped inside a frame.
 */
export interface MpaPreviewProps {
  /** Example name, matching `examples/<name>` and its `dist/` folder. */
  example: string;
  /** Entry/bundle to boot (defaults to `main`). */
  page?: string;
  /** Optional deep-link route within the booted bundle (e.g. `/users/3`). */
  route?: string;
  /** Button label. */
  label?: string;
}

export function MpaPreview({
  example,
  page = 'main',
  route,
  label = 'Open the live MPA demo',
}: MpaPreviewProps) {
  const href = useMemo(() => {
    const shell = withBase('/mpa-preview/index.html');
    const base = withBase(`/examples/${example}/dist`);
    const params = new URLSearchParams({ base, page });
    if (route) params.set('__hs_route', route);
    return `${shell}?${params.toString()}`;
  }, [example, page, route]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        margin: '16px 0',
        padding: '14px 16px',
        border: '1px solid var(--rp-c-divider, #e2e2e3)',
        borderRadius: 12,
        background: 'var(--rp-c-bg-soft, #f6f6f7)',
      }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          background: 'var(--rp-c-brand, #3451b2)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {label} <span aria-hidden>↗</span>
      </a>
      <span style={{ fontSize: 13, color: 'var(--rp-c-text-2, #67676c)' }}>
        Opens the Sparkling web shell in a new tab — real cross-page navigation
        in your browser (try <code>push('/users')</code>, then the back button).
      </span>
    </div>
  );
}

export default MpaPreview;
