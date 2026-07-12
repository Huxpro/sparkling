// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// The shared route tree + page manifest. Every page bundle imports this same
// tree so it can build and validate hrefs for the whole app; the manifest
// decides which routes live in which native page (bundle / JS context).
import {
  createRootRoute,
  createRoute,
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import type { PageManifest } from 'sparkling-history';

// ---------------------------------------------------------------------------
// Manifest: route path -> native page (bundle). This is exactly the kind of
// file-based metadata a codegen step would emit; here it is hand-written.
// ---------------------------------------------------------------------------
export const manifest: PageManifest = {
  pages: [
    // The home page owns both '/' and '/profile' — navigating between them is
    // an *in-page* SPA transition (no native page open).
    { id: 'home', paths: ['/', '/profile'] },
    { id: 'detail', paths: ['/detail'], containerParams: { title: 'Detail' } },
    { id: 'settings', paths: ['/settings'], containerParams: { title: 'Settings' } },
  ],
};

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------
function Screen(props: { title: string; accent: string; children?: unknown }) {
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

function NavButton(props: { label: string; color: string; onTap: () => void }) {
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export const rootRoute = createRootRoute({
  component: () => <Outlet />,
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

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
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

export const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
});

function DetailPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { id } = detailRoute.useParams();
  const search = detailRoute.useSearch();
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
      {/* history.back() at the page root becomes host.close() → native pop. */}
      <NavButton label="← Back (native pop)" color="#374151" onTap={() => router.history.back()} />
    </Screen>
  );
}

export const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/detail/$id',
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === 'string' ? search.ref : undefined,
  }),
  component: DetailPage,
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

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  profileRoute,
  detailRoute,
  settingsRoute,
]);
