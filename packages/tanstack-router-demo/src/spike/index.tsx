// Feasibility spike: run TanStack Router on ReactLynx with a memory history.
// This intentionally avoids <Link> (which renders an <a> tag) and drives
// navigation through useNavigate + bindtap instead.
import '../shims/env.js';
import { root } from '@lynx-js/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';

function RootLayout() {
  const state = useRouterState();
  return (
    <view style={{ padding: '40px 20px', backgroundColor: '#111', height: '100%' }}>
      <text style={{ color: '#0ff', fontSize: '16px', marginBottom: '12px' }}>
        {`TSR spike — location: ${state.location.pathname}`}
      </text>
      <Outlet />
    </view>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

function IndexPage() {
  const navigate = useNavigate();
  return (
    <view>
      <text style={{ color: '#fff', fontSize: '20px' }}>Index route</text>
      <text
        style={{ color: '#f5a', fontSize: '18px', marginTop: '16px' }}
        bindtap={() => {
          navigate({ to: '/about', search: { from: 'index' } });
        }}
      >
        → go to /about
      </text>
    </view>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

function AboutPage() {
  const navigate = useNavigate();
  const search = aboutRoute.useSearch();
  return (
    <view>
      <text style={{ color: '#fff', fontSize: '20px' }}>
        {`About route (from=${(search as { from?: string }).from ?? '?'})`}
      </text>
      <text
        style={{ color: '#f5a', fontSize: '18px', marginTop: '16px' }}
        bindtap={() => {
          navigate({ to: '/' });
        }}
      >
        ← back to /
      </text>
    </view>
  );
}

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: AboutPage,
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);

function LynxErrorComponent({ error }: { error: Error }) {
  console.error('[spike] route error:', error.message, error.stack);
  return (
    <view style={{ padding: '20px' }}>
      <text style={{ color: '#f44', fontSize: '14px' }}>{`Error: ${error.message}`}</text>
      <text style={{ color: '#fa4', fontSize: '10px', marginTop: '8px' }}>{String(error.stack ?? '')}</text>
    </view>
  );
}

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/'] }),
  isServer: false,
  defaultErrorComponent: LynxErrorComponent as never,
  defaultNotFoundComponent: (() => (
    <view>
      <text style={{ color: '#f44' }}>Not found</text>
    </view>
  )) as never,
});

function App() {
  return <RouterProvider router={router as never} />;
}

root.render(<App />);
