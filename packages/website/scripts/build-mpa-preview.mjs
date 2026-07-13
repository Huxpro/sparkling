// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Build the Sparkling web shell as a static "MPA preview runtime" and drop it
 * into the site's public dir at `/mpa-preview/`.
 *
 * The go-web `<Go>` component previews ONE Lynx card with no native bridge, so
 * it can't run cross-page (MPA) navigation (see `<MpaPreview>` and the Vue
 * Router example docs). The web shell owns a whole page: it stacks a
 * `<lynx-view>` per container, provides the Sparkling `spkPipe` method bridge,
 * and installs a `RouterWebHost` — a faithful in-browser MPA environment. The
 * docs link to it (`<MpaPreview>` opens it in a new tab), so the shell owns the
 * whole page and the browser's own back/forward drive its MPA history.
 *
 * The shell is built with a relative asset prefix (`WEBSHELL_ASSET_PREFIX=auto`)
 * so it works under any deploy base (GitHub Pages `/sparkling/`, Vercel `/`),
 * and it loads each example's bundles from `?base=<url>` at runtime — so this
 * one static build serves every example.
 *
 * Best-effort: a failure here only disables the live MPA preview; the rest of
 * the site still builds.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const SHELL_DIR = path.resolve(REPO_ROOT, 'packages/sparkling-web-shell')
const SHELL_DIST = path.join(SHELL_DIR, 'dist')
const DEST = path.resolve(__dirname, '../public/mpa-preview')

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirRecursive(s, d)
    else fs.copyFileSync(s, d)
  }
}

console.info('Building MPA preview runtime (sparkling-web-shell)...')

try {
  // The shell needs the method packages' web handlers built first.
  execSync(
    'pnpm -C ../.. --filter sparkling-method --filter sparkling-navigation ' +
      '--filter sparkling-storage --filter sparkling-media build',
    { cwd: SHELL_DIR, stdio: 'inherit' },
  )
  execSync('pnpm run build', {
    cwd: SHELL_DIR,
    stdio: 'inherit',
    env: { ...process.env, WEBSHELL_ASSET_PREFIX: 'auto' },
  })

  if (!fs.existsSync(SHELL_DIST)) {
    throw new Error(`shell build produced no dist at ${SHELL_DIST}`)
  }

  if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true })
  copyDirRecursive(SHELL_DIST, DEST)
  console.info(`  -> copied web shell to ${path.relative(REPO_ROOT, DEST)}`)
} catch (err) {
  console.warn(
    `  ⚠ MPA preview runtime unavailable (live cross-page preview disabled): ${
      err instanceof Error ? err.message : String(err)
    }`,
  )
}
