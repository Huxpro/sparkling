// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Pre-build step that turns the local monorepo `examples/*` packages into
 * assets the go-web `<Go>` component can consume.
 *
 * For every example it:
 *   1. generates an `example-metadata.json` (the schema `@lynx-js/go-web`
 *      expects — `name`, `files`, `templateFiles[{name,file,webFile}]`,
 *      `previewImage`, `exampleGitBaseUrl`);
 *   2. copies the browsable source files + built `dist/` bundles + preview
 *      image into `public/examples/<name>/`.
 *
 * This is the local-monorepo equivalent of go-web's registry-fetching
 * `prepare-examples` — instead of downloading published `@lynx-example/*`
 * packages, we read the examples that live in this repo.
 *
 * Usage:
 *   node scripts/prepare-examples.mjs           # build missing dist/, then generate
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
const EXAMPLE_GIT_BASE_URL =
  'https://github.com/tiktok/sparkling/tree/main/examples'

const noBuild = process.argv.includes('--no-build')

// Binary asset extensions that shouldn't be copied as browsable source.
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
  '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.zip', '.tar', '.tgz', '.gz', '.rar',
  '.pdf', '.psd', '.tif',
])

// Directories never worth scanning/copying as source.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.cache', '.git', '.turbo'])

/** Walk a directory recursively, returning paths relative to `base`. */
function walkDir(dir, base = dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, base))
    } else {
      // Normalise to POSIX separators — these become URL/metadata paths.
      results.push(path.relative(base, fullPath).split(path.sep).join('/'))
    }
  }
  return results
}

/** Recursively copy a directory verbatim (used for built `dist/`). */
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
 * Extract entry names from `lynx.config.ts`'s `source.entry: { name: path }`.
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
    entries.push({ name: match[1], entryPath: match[2] })
  }
  return entries
}

/** Generate metadata + copy assets for one example directory. */
function processExample(exampleName) {
  const srcDir = path.join(EXAMPLES_SRC, exampleName)
  const destDir = path.join(EXAMPLES_DEST, exampleName)
  if (!fs.statSync(srcDir).isDirectory()) return

  console.info(`Processing example: ${exampleName}`)

  const allFiles = walkDir(srcDir)
  const textFiles = allFiles.filter((f) => isPreviewImage(f) || isTextFile(f))
  const previewImage = allFiles.find(isPreviewImage) || undefined

  // Build `templateFiles`, mapping each rspeedy entry to its bundle outputs.
  const entries = parseEntries(path.join(srcDir, 'lynx.config.ts'))
  const templateFiles = entries.map(({ name }) => {
    const entry = { name, file: `dist/${name}.lynx.bundle` }
    // rspeedy's `web` environment emits `<name>.web.bundle` — only advertise
    // it when it actually exists so <Go> can fall back gracefully.
    if (fs.existsSync(path.join(srcDir, `dist/${name}.web.bundle`))) {
      entry.webFile = `dist/${name}.web.bundle`
    }
    return entry
  })

  const metadata = {
    name: exampleName,
    files: textFiles.filter((f) => !isPreviewImage(f)),
    templateFiles,
    previewImage,
    exampleGitBaseUrl: `${EXAMPLE_GIT_BASE_URL}/${exampleName}`,
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
    fs.copyFileSync(path.join(srcDir, relPath), destFile)
  }

  // Copy the whole dist/ (bundles + any static assets they reference).
  const distSrcDir = path.join(srcDir, 'dist')
  if (fs.existsSync(distSrcDir)) {
    copyDirRecursive(distSrcDir, path.join(destDir, 'dist'))
  } else {
    console.warn(
      `  ⚠ ${exampleName} has no dist/ — web/QR preview will be unavailable ` +
        `until it is built.`,
    )
  }

  if (previewImage) {
    fs.copyFileSync(
      path.join(srcDir, previewImage),
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
console.info(`Source: ${EXAMPLES_SRC}`)
console.info(`Dest:   ${EXAMPLES_DEST}`)

if (!fs.existsSync(EXAMPLES_SRC)) {
  console.info('No examples/ directory found — nothing to do.')
  process.exit(0)
}

const examples = fs
  .readdirSync(EXAMPLES_SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name))
  .filter((d) => fs.existsSync(path.join(EXAMPLES_SRC, d.name, 'package.json')))
  .map((d) => d.name)

// Build any example missing its dist/ (e.g. on CI where dist/ is gitignored).
// Best-effort: a build failure warns but never aborts the whole site build.
if (!noBuild) {
  for (const example of examples) {
    const distDir = path.join(EXAMPLES_SRC, example, 'dist')
    if (fs.existsSync(distDir)) continue
    console.info(`Building example: ${example} (no dist/ found)`)
    try {
      execSync('pnpm build', {
        cwd: path.join(EXAMPLES_SRC, example),
        stdio: 'inherit',
      })
    } catch (err) {
      console.error(`  ⚠ Failed to build ${example}: ${err.message}`)
    }
  }
}

// Clean and regenerate the destination.
if (fs.existsSync(EXAMPLES_DEST)) {
  fs.rmSync(EXAMPLES_DEST, { recursive: true })
}
fs.mkdirSync(EXAMPLES_DEST, { recursive: true })

for (const example of examples) {
  processExample(example)
}

console.info(`\nDone! Processed ${examples.length} example(s).`)
