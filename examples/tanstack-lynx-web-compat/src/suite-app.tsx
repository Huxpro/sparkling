// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Lynx-for-Web visual suite app.
 * Scenarios are driven imperatively on the router instance (reliable under
 * Playwright). bindtap buttons remain for manual exploration.
 */
import 'url-search-params-polyfill'
import './shims/env.js'
import { root } from '@lynx-js/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import {
  createSparklingHistory,
  type RouteManifest,
} from 'sparkling-router'

const manifest: RouteManifest = {
  version: '1',
  scheme: { base: 'hybrid://lynxview_page' },
  containers: [
    {
      bundle: 'suite',
      presentation: 'push',
      routes: [
        { path: '/' },
        { path: '/about' },
        { path: '/posts' },
        { path: '/posts/$postId' },
      ],
    },
  ],
}

function queryItems(): Record<string, string> {
  try {
    return (
      (lynx as { __globalProps?: { queryItems?: Record<string, string> } })
        .__globalProps?.queryItems ?? {}
    )
  } catch {
    return {}
  }
}

let scenarioLabel = 'idle'

function RootLayout() {
  const state = useRouterState()
  // Re-read label each render; scenario runner triggers navigations that re-render.
  const label =
    (state.location.search as { __scenario?: string } | undefined)?.__scenario ||
    scenarioLabel
  return (
    <view>
      <text id="pathname">{`pathname=${state.location.pathname}`}</text>
      <text id="search">{`search=${JSON.stringify(state.location.search ?? {})}`}</text>
      <text id="scenario-prop">{`scenarioProp=${queryItems().scenario || 'none'}`}</text>
      <text id="scenario">{`scenario=${label}`}</text>
      <Outlet />
    </view>
  )
}

function IndexPage() {
  const navigate = useNavigate()
  return (
    <view>
      <text>Index</text>
      <text id="go-about" bindtap={() => navigate({ to: '/about', search: { from: 'index' } })}>
        go-about
      </text>
      <text id="go-posts" bindtap={() => navigate({ to: '/posts' })}>
        go-posts
      </text>
    </view>
  )
}

function AboutPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { from?: string }
  return (
    <view>
      <text>{`About from=${search.from ?? '?'}`}</text>
      <text id="go-home" bindtap={() => navigate({ to: '/' })}>
        go-home
      </text>
    </view>
  )
}

function PostsPage() {
  const navigate = useNavigate()
  return (
    <view>
      <text>Posts</text>
      <text
        id="go-post-42"
        bindtap={() => navigate({ to: '/posts/$postId', params: { postId: '42' } })}
      >
        go-post-42
      </text>
      <text id="go-back" bindtap={() => navigate({ to: '..' })}>
        go-back
      </text>
    </view>
  )
}

function PostPage() {
  const { postId } = useParams({ strict: false }) as { postId: string }
  const navigate = useNavigate()
  return (
    <view>
      <text id="post-id">{`Post ${postId}`}</text>
      <text id="go-posts" bindtap={() => navigate({ to: '/posts' })}>
        go-posts
      </text>
    </view>
  )
}

const rootRoute = createRootRoute({
  component: RootLayout,
})
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === 'string' ? s.from : undefined,
    __scenario: typeof s.__scenario === 'string' ? s.__scenario : undefined,
  }),
  component: AboutPage,
})
const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  validateSearch: (s: Record<string, unknown>) => ({
    __scenario: typeof s.__scenario === 'string' ? s.__scenario : undefined,
  }),
  component: PostsPage,
})
const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts/$postId',
  validateSearch: (s: Record<string, unknown>) => ({
    __scenario: typeof s.__scenario === 'string' ? s.__scenario : undefined,
  }),
  component: PostPage,
})

const runtime = createSparklingHistory({
  manifest,
  container: {
    bundle: 'suite',
    ownedRoutes: ['/', '/about', '/posts', '/posts/$postId'],
    presentation: 'push',
  },
  memoryStack: true,
  queryItems: queryItems(),
})

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, aboutRoute, postsRoute, postRoute]),
  history: runtime.history,
  isServer: false,
})

async function runScenario(scenario: string) {
  scenarioLabel = 'pending'
  console.log('[suite] runScenario start', scenario)
  await router.load()
  if (scenario === 'about-search') {
    await router.navigate({ to: '/about', search: { from: 'index' } })
  } else if (scenario === 'posts-params') {
    await router.navigate({ to: '/posts' })
    await router.navigate({ to: '/posts/$postId', params: { postId: '42' } })
  } else if (scenario === 'soft-back') {
    await router.navigate({ to: '/posts' })
    await router.history.back()
    // allow memory history subscriber to settle
    await new Promise((r) => setTimeout(r, 0))
  } else if (scenario === 'replace') {
    await router.navigate({ to: '/posts' })
    await router.navigate({
      to: '/about',
      search: { from: 'replace' },
      replace: true,
    })
  }
  scenarioLabel = `done:${scenario}`
  console.log('[suite] runScenario done', scenario, router.state.location.pathname)
  await router.navigate({
    to: router.state.location.pathname as '/',
    search: {
      ...(router.state.location.search as Record<string, unknown>),
      __scenario: scenarioLabel,
    } as never,
    replace: true,
  })
}

const scenario = queryItems().scenario
if (scenario) {
  scenarioLabel = 'pending'
  // Wait for RouterProvider to subscribe before navigating.
  setTimeout(() => {
    void runScenario(scenario).catch((error) => {
      scenarioLabel = `error:${String(error)}`
      console.error('[suite] scenario failed', error)
      // Force a no-op replace so UI can show the error label via search.
      void router.navigate({
        to: '/',
        search: { __scenario: scenarioLabel } as never,
        replace: true,
      })
    })
  }, 300)
}

root.render(<RouterProvider router={router} />)
