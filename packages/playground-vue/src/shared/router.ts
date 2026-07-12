// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RouteRecordRaw } from 'vue-router'
import { createSparklingRouter, type SparklingRouter } from 'sparkling-history/vue'
import manifest from '../generated/route-manifest'

/**
 * Create the router for ONE page bundle (one Lynx container / JS heap).
 *
 * `routes` are the routes THIS page implements locally (in-container SPA
 * navigation). Navigations resolving to routes owned by other pages — per
 * the generated manifest — are diverted to Sparkling native navigation and
 * open a new container.
 */
export function createPageRouter(routes: RouteRecordRaw[]): SparklingRouter {
  const router = createSparklingRouter({ manifest, routes })

  // Boot the initial navigation from the container's URL, like vue-router
  // does on app install for browser histories.
  router.push(router.hybridHistory.location).catch(err => {
    console.error('[playground-vue] initial navigation failed:', err)
  })

  return router
}
