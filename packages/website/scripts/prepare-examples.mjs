// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Pre-build step that turns local monorepo examples into assets the go-web
 * `<Go>` component can consume.
 *
 * Two kinds of source are supported:
 *   1. Standalone example apps under `examples/*` (built via `pnpm build`,
 *      one example per directory).
 *   2. Explicitly registered monorepo packages (see PACKAGE_SOURCES) — e.g.
 *      the Sparkling Go playground, exposed as a single multi-entry example.
 *
 * For each example it:
 *   1. generates an `example-metadata.json` (the schema `@lynx-js/go-web`
 *      expects — `name`, `files`, `templateFiles[{name,file,webFile}]`,
 *      `previewImage`, `exampleGitBaseUrl`);
 *   2. copies the browsable source files + built bundles into
 *      `public/examples/<name>/`.
 *
 * Usage:
 *   node scripts/prepare-examples.mjs             # build missing bundles, then generate
 *   node scripts/prepare-examples.mjs --no-build  # only generate from existing files
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const EXAMPLES_SRC = path.resolve(REPO_ROOT, 'examples')
const EXAMPLES_DEST = path.resolve(__dirname, '../public/examples')
const GIT_TREE = 'https://github.com/tiktok/sparkling/tree/main'

const noBuild = process.argv.includes('--no-build')

/**
 * Monorepo packages surfaced as examples (in addition to `examples/*`).
 * The playground is one app with many entries; we expose it as a single
 * multi-entry example and only surface the feature demos (not the nav hubs).
 */
const PACKAGE_SOURCES = [
  {
    name: 'sparkling-go',
    dir: path.resolve(REPO_ROOT, 'packages/playground'),
    // Entries live in the shared config, not lynx.config.ts.
    configFile: 'lynx.shared.config.ts',
    // Emits *.web.bundle + *.lynx.bundle with an HTTP assetPrefix into dist-web/
    // (kept separate from the native `dist/`).
    buildScript: 'build:web',
    bundleDir: 'dist-web',
    gitPath: 'packages/playground',
    includeEntries: [
      'scheme-builder', 'scheme-presets',
      'nav-basic', 'nav-chain',
      'gp-device', 'gp-screen', 'gp-container',
      'storage-demo',
      'media-choose', 'media-upload', 'media-download',
    ],
    // Don't browse the native shells / generated dirs as source.
    skipDirs: ['android', 'ios', '.sparkling', 'coverage'],
  },
]

// Binary asset extensions that shouldn't be copied as browsable source.
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.zip', '.tar', '.tgz', '.gz', '.rar',
  '.pdf', '.psd', '.tif',
])

// Directories never worth scanning/copying as source.
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dist-web', '.cache', '.git', '.turbo',
])

/** Walk a directory recursively, returning paths relative to `base`. */
function walkDir(dir, base = dir, skip = SKIP_DIRS) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, base, skip))
    } else {
      // Normalise to POSIX separators — these become URL/metadata paths.
      results.push(path.relative(base, fullPath).split(path.sep).join('/'))
    }
  }
  return results
}

/** Recursively copy a directory verbatim (used for built bundles). */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/** A `preview-image.*` at the example root is the static screenshot. */
function isPreviewImage(relPath) {
  return (
    /^preview-image\.(png|jpg|jpeg|webp|gif)$/.test(path.basename(relPath)) &&
    !relPath.includes('/')
  )
}

/** Text source files are browsable; binary assets are skipped. */
function isTextFile(relPath) {
  return !BINARY_EXTENSIONS.has(path.extname(relPath).toLowerCase())
}

/**
 * Extract entry names from a config's `source.entry: { name: path }`.
 * A small regex parser — enough for the standard rspeedy config shape.
 */
function parseEntries(configPath) {
  if (!fs.existsSync(configPath)) return []
  const content = fs.readFileSync(configPath, 'utf-8')
  const entryMatch = content.match(/entry:\s*\{([^}]+)\}/s)
  if (!entryMatch) return []

  const entries = []
  const entryRegex = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g
  let match
  while ((match = entryRegex.exec(entryMatch[1])) !== null) {
    entries.push(match[1])
  }
  return entries
}

/**
 * Normalise `examples/*` dirs and PACKAGE_SOURCES into a single source list.
 * @returns {Array<{name,dir,configFile,buildScript,bundleDir,gitBaseUrl,includeEntries?,skipSet}>}
 */
function collectSources() {
  const sources = []

  if (fs.existsSync(EXAMPLES_SRC)) {
    for (const d of fs.readdirSync(EXAMPLES_SRC, { withFileTypes: true })) {
      if (!d.isDirectory() || SKIP_DIRS.has(d.name)) continue
      const dir = path.join(EXAMPLES_SRC, d.name)
      if (!fs.existsSync(path.join(dir, 'package.json'))) continue
      sources.push({
        name: d.name,
        dir,
        configFile: 'lynx.config.ts',
        buildScript: 'build',
        bundleDir: 'dist',
        gitBaseUrl: `${GIT_TREE}/examples/${d.name}`,
        includeEntries: null,
        skipSet: SKIP_DIRS,
      })
    }
  }

  for (const s of PACKAGE_SOURCES) {
    if (!fs.existsSync(s.dir)) {
      console.warn(`  ⚠ package source not found, skipping: ${s.dir}`)
      continue
    }
    sources.push({
      name: s.name,
      dir: s.dir,
      configFile: s.configFile ?? 'lynx.config.ts',
      buildScript: s.buildScript ?? 'build',
      bundleDir: s.bundleDir ?? 'dist',
      gitBaseUrl: `${GIT_TREE}/${s.gitPath}`,
      includeEntries: s.includeEntries ?? null,
      skipSet: new Set([...SKIP_DIRS, ...(s.skipDirs ?? [])]),
    })
  }

  return sources
}

/** Build a source's bundles if they're missing (best-effort). */
function ensureBuilt(source) {
  const bundlePath = path.join(source.dir, source.bundleDir)
  if (fs.existsSync(bundlePath)) return
  console.info(`Building ${source.name} (no ${source.bundleDir}/ found)`)
  try {
    execSync(`pnpm run ${source.buildScript}`, {
      cwd: source.dir,
      stdio: 'inherit',
    })
  } catch (err) {
    console.error(`  ⚠ Failed to build ${source.name}: ${err.message}`)
  }
}

/** Generate metadata + copy assets for one source. */
function processSource(source) {
  const { name, dir, bundleDir, skipSet } = source
  const destDir = path.join(EXAMPLES_DEST, name)

  console.info(`Processing example: ${name}`)

  const allFiles = walkDir(dir, dir, skipSet)
  const textFiles = allFiles.filter((f) => isPreviewImage(f) || isTextFile(f))
  const previewImage = allFiles.find(isPreviewImage) || undefined

  // Build `templateFiles`, mapping each (included) entry to its bundle outputs.
  let entries = parseEntries(path.join(dir, source.configFile))
  if (source.includeEntries) {
    const wanted = new Set(source.includeEntries)
    entries = entries.filter((e) => wanted.has(e))
  }
  const bundleSrc = path.join(dir, bundleDir)
  const templateFiles = entries.map((entry) => {
    const meta = { name: entry, file: `dist/${entry}.lynx.bundle` }
    // rspeedy's `web` environment emits `<name>.web.bundle` — only advertise
    // it when it actually exists so <Go> can fall back gracefully.
    if (fs.existsSync(path.join(bundleSrc, `${entry}.web.bundle`))) {
      meta.webFile = `dist/${entry}.web.bundle`
    }
    return meta
  })

  const metadata = {
    name,
    files: textFiles.filter((f) => !isPreviewImage(f)),
    templateFiles,
    previewImage,
    exampleGitBaseUrl: source.gitBaseUrl,
  }

  fs.mkdirSync(destDir, { recursive: true })
  fs.writeFileSync(
    path.join(destDir, 'example-metadata.json'),
    JSON.stringify(metadata, null, 2),
  )

  // Copy browsable source files.
  for (const relPath of textFiles) {
    const destFile = path.join(destDir, relPath)
    fs.mkdirSync(path.dirname(destFile), { recursive: true })
    fs.copyFileSync(path.join(dir, relPath), destFile)
  }

  // Copy the built bundles into a canonical `dist/` (metadata always points there).
  if (fs.existsSync(bundleSrc)) {
    copyDirRecursive(bundleSrc, path.join(destDir, 'dist'))
  } else {
    console.warn(
      `  ⚠ ${name} has no ${bundleDir}/ — web/QR preview will be unavailable ` +
        `until it is built.`,
    )
  }

  if (previewImage) {
    fs.copyFileSync(
      path.join(dir, previewImage),
      path.join(destDir, previewImage),
    )
  }

  console.info(
    `  -> ${metadata.files.length} files, ${templateFiles.length} entries` +
      `${templateFiles.some((t) => t.webFile) ? ' (web preview ready)' : ''}`,
  )
}

// --- Main -----------------------------------------------------------------

console.info('Preparing examples...')
console.info(`Dest: ${EXAMPLES_DEST}`)

const sources = collectSources()
if (sources.length === 0) {
  console.info('No example sources found — nothing to do.')
  process.exit(0)
}

if (!noBuild) {
  for (const source of sources) ensureBuilt(source)
}

// Clean and regenerate the destination.
if (fs.existsSync(EXAMPLES_DEST)) {
  fs.rmSync(EXAMPLES_DEST, { recursive: true })
}
fs.mkdirSync(EXAMPLES_DEST, { recursive: true })

for (const source of sources) processSource(source)

console.info(`\nDone! Processed ${sources.length} example source(s).`)
