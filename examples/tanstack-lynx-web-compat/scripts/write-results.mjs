// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = path.join(root, 'artifacts')

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const unit = readJson(path.join(artifacts, 'unit-results.json'))
const e2e = readJson(path.join(artifacts, 'e2e-results.json'))

const lines = []
lines.push('# TanStack Router × Lynx-for-Web Compat Results')
lines.push('')
lines.push(`Generated: ${new Date().toISOString()}`)
lines.push('')
lines.push('## Environment')
lines.push('')
lines.push('- Host: experimental Lynx for Web via `@lynx-js/web-core` `<lynx-view>` (mainline API; shell patterns from PR #3 / `stack/3-sparkling-web-shell`)')
lines.push('- Router: `@tanstack/react-router@1.170.18` + `sparkling-router` `CompositeHistory`')
lines.push('- Soft-nav only in e2e (single container, `memoryStack: true`)')
lines.push('')

lines.push('## Unit (headless ports of upstream cases)')
lines.push('')
if (unit?.numTotalTests != null) {
  lines.push(`- Total: ${unit.numTotalTests}`)
  lines.push(`- Passed: ${unit.numPassedTests}`)
  lines.push(`- Failed: ${unit.numFailedTests}`)
  lines.push(`- Skipped: ${unit.numPendingTests ?? 0}`)
} else {
  lines.push('_No unit artifact — run `pnpm test:unit` first._')
}
lines.push('')

lines.push('## E2E (Playwright × lynx-view)')
lines.push('')
if (e2e?.stats) {
  lines.push(`- Expected: ${e2e.stats.expected}`)
  lines.push(`- Unexpected failures: ${e2e.stats.unexpected}`)
  lines.push(`- Skipped: ${e2e.stats.skipped}`)
} else if (e2e) {
  lines.push('```json')
  lines.push(JSON.stringify(e2e, null, 2).slice(0, 2000))
  lines.push('```')
} else {
  lines.push('_No e2e artifact — run `pnpm test:e2e` first._')
}
lines.push('')

lines.push('## Upstream surface coverage map')
lines.push('')
lines.push('| Upstream area | Approach | Status |')
lines.push('| --- | --- | --- |')
lines.push('| `@tanstack/history` memory | direct port | see unit |')
lines.push('| `useNavigate` / `router.navigate` | headless + e2e | see unit/e2e |')
lines.push('| path params / search | headless + e2e | see unit/e2e |')
lines.push('| loaders / redirect / notFound | headless | see unit |')
lines.push('| `CompositeHistory` soft/hard | headless | see unit |')
lines.push('| `<Link>` / `<a>` / preload IO | probe only | **known gap on ReactLynx** |')
lines.push('| `createBrowserHistory` / History API | not applicable | Lynx has no History API; memory/Composite only |')
lines.push('| SSR / `renderRouterToStream` / Scripts | not run | out of Lynx Web scope |')
lines.push('| full upstream RTL suite (~250+ DOM tests) | not runnable as-is | needs `<div>`/`button`/`screen.getByRole` |')
lines.push('')

lines.push('## What works / what does not (narrative)')
lines.push('')
lines.push('See PR description — this file is machine-refreshed from artifacts.')
lines.push('')

fs.mkdirSync(artifacts, { recursive: true })
fs.writeFileSync(path.join(root, 'RESULTS.md'), lines.join('\n'))
console.log('Wrote RESULTS.md')
