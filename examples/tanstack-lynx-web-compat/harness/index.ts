// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Minimal Lynx-for-Web host (experimental).
 * Uses mainline @lynx-js/web-core 0.20.x custom-element API (`/client` export),
 * same surface the website go-web gallery uses. Shell stacking ideas from
 * PR #3 / stack/3-sparkling-web-shell are intentionally out of scope here —
 * this harness hosts a single soft-nav suite bundle.
 */
import '@lynx-js/web-core/client'
import '@lynx-js/web-core/client.prod.css'
import '@lynx-js/web-elements/all'
import '@lynx-js/web-elements/index.css'

const params = new URLSearchParams(window.location.search)
const bundle =
  params.get('bundle') ||
  params.get('url') ||
  '/suite.web.bundle'

const root = document.getElementById('root')!
const view = document.createElement('lynx-view') as HTMLElement & {
  url: string
  globalProps?: Record<string, unknown>
}

view.setAttribute('style', 'width:100%;height:100%;')
const globalProps = {
  containerID: 'compat-suite-1',
  os: 'web',
  queryItems: {
    __path: params.get('__path') || '/',
    // Auto-scenario runner (see suite-app.tsx). Avoids bindtap↔Playwright click gap.
    ...(params.get('scenario') ? { scenario: params.get('scenario')! } : {}),
  },
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  pixelRatio: window.devicePixelRatio,
}
// Set props before url so the Worker boots with them (web-core 0.20).
view.globalProps = globalProps
try {
  view.setAttribute('global-props', JSON.stringify(globalProps))
} catch {
  // attribute optional
}
view.url = bundle

root.appendChild(view)

;(window as unknown as { __LYNX_VIEW__: unknown }).__LYNX_VIEW__ = view
console.log('[compat-harness] mounted lynx-view url=', bundle)
