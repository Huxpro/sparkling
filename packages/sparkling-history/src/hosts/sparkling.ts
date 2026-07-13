// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { open as sparklingOpen, close as sparklingClose } from 'sparkling-navigation'
import type { NavigationHost } from '../types'
import { DEFAULT_SCHEME } from '../codec'

/**
 * {@link NavigationHost} implementation over the Sparkling container stack.
 *
 * Runs inside a Lynx background thread (one per container/heap):
 * - the initial URL is rebuilt from `lynx.__globalProps.queryItems`, the
 *   query params the Sparkling SDK parsed off this container's scheme
 * - `open`/`close` map to sparkling-navigation's `router.open`/`router.close`
 * - visibility maps to the `viewAppeared`/`viewDisappeared` GlobalEvents
 *   the Sparkling SDK sends to every container.
 */

interface GlobalEventEmitterLike {
  addListener(event: string, listener: (...args: unknown[]) => void): void
  removeListener(event: string, listener: (...args: unknown[]) => void): void
}

interface LynxGlobalLike {
  __globalProps?: {
    containerID?: string
    queryItems?: Record<string, string>
  }
  getJSModule?(name: string): unknown
}

declare const lynx: LynxGlobalLike | undefined

function getLynx(): LynxGlobalLike | undefined {
  return typeof lynx !== 'undefined' ? lynx : undefined
}

export interface SparklingHostOptions {
  /** Base scheme used to rebuild this container's initial URL. */
  scheme?: string
}

export function createSparklingNavigationHost(
  options: SparklingHostOptions = {}
): NavigationHost {
  const scheme = options.scheme ?? DEFAULT_SCHEME
  const globalProps = getLynx()?.__globalProps

  const queryItems = globalProps?.queryItems ?? {}
  const query = Object.entries(queryItems)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return {
    initialUrl: query ? `${scheme}?${query}` : scheme,
    containerId: globalProps?.containerID ?? '',

    open(url, opts) {
      return new Promise<void>((resolve, reject) => {
        sparklingOpen(
          {
            scheme: url,
            options: opts?.replace ? { replace: true } : undefined,
          },
          result => {
            if (result.code === 1) resolve()
            else reject(new Error(`[sparkling-history] router.open failed: ${result.msg}`))
          }
        )
      })
    },

    close(opts) {
      const count = opts?.count ?? 1
      if (count > 1) {
        // Sparkling's router.close only dismisses the current container.
        // Multi-entry pops (history.go(-n) across containers) degrade to a
        // single pop — see the compatibility notes in the README.
        console.warn(
          `[sparkling-history] close({ count: ${count} }) is not supported by ` +
            'sparkling-navigation; closing only the current container.'
        )
      }
      return new Promise<void>((resolve, reject) => {
        sparklingClose({}, result => {
          if (result.code === 1) resolve()
          else reject(new Error(`[sparkling-history] router.close failed: ${result.msg}`))
        })
      })
    },

    onVisibilityChange(callback) {
      const emitter = getLynx()?.getJSModule?.('GlobalEventEmitter') as
        | GlobalEventEmitterLike
        | undefined
      if (!emitter?.addListener) {
        return () => {}
      }
      const onAppear = () => callback(true)
      const onDisappear = () => callback(false)
      emitter.addListener('viewAppeared', onAppear)
      emitter.addListener('viewDisappeared', onDisappear)
      return () => {
        emitter.removeListener('viewAppeared', onAppear)
        emitter.removeListener('viewDisappeared', onDisappear)
      }
    },
  }
}
