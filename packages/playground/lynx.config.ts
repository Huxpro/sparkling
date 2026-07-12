// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'fs'
import path from 'path'
import { defineConfig } from '@lynx-js/rspeedy'
import lynxSharedConfig from './lynx.shared.config.js'

function copyDir(src: string, dest: string, filter?: (name: string) => boolean) {
  if (!fs.existsSync(src)) {
    console.warn(`Source directory ${src} does not exist, skipping copy`)
    return
  }

  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    if (filter && !filter(entry.name)) {
      continue
    }

    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filter)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

export default defineConfig({
  ...lynxSharedConfig,
  server: {
    port: 5969,
  },
  environments: {
    web: {
      output: {
        assetPrefix: '/',
        distPath: {
          root: 'dist/web',
        },
      },
    },
    lynx: {
      output: {
        assetPrefix: 'asset:///',
      },
    },
  },
  plugins: [
    ...(lynxSharedConfig.plugins ?? []),
    {
      name: 'copy-assets-plugin',
      setup(api) {
        api.onAfterBuild(() => {
          const sourceDir = 'dist'
          const androidDest = 'android/app/src/main/assets'
          const iosDest = 'ios/LynxResources'

          // Skip the web subdirectory when copying to native asset dirs
          const nativeFilter = (name: string) => name !== 'web'

          console.log(`Copying ${sourceDir} to Android (${androidDest})...`)
          copyDir(sourceDir, androidDest, nativeFilter)

          console.log(`Copying ${sourceDir} to iOS (${iosDest})...`)
          copyDir(sourceDir, iosDest, nativeFilter)

          console.log('Assets copied successfully!')
        })
      },
    },
  ],
})
