// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RouteRecordRaw } from 'vue-router'
import { createSparklingRouter, type SparklingRouter } from 'sparkling-history/vue'
import { defaultLocationOf, findOwner } from 'sparkling-history'
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
  const { hybridHistory } = router

  // Boot the initial navigation from the container's URL, like vue-router
  // does on app install for browser histories.
  //
  // When the container URL carries no route this bundle owns — e.g. a
  // standalone go-web web preview, where there is no scheme/queryItems — fall
  // back to the bundle's own default route so each page previews correctly on
  // its own instead of at a route another bundle owns.
  const location = hybridHistory.location
  const owner = findOwner(manifest, location.split('?')[0])
  const bootLocation =
    owner && owner.page.bundle === hybridHistory.bundle
      ? location
      : defaultRouteFor(hybridHistory.bundle)

  router.push(bootLocation).catch(err => {
    console.error('[vue-router-mpa] initial navigation failed:', err)
  })

  return router
}

/** The default route of a page bundle, from the shared manifest. */
function defaultRouteFor(bundle: string | null): string {
  const page = manifest.pages.find(p => p.bundle === bundle)
  return page ? defaultLocationOf(page) : '/'
}
