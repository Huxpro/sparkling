// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  NavigationHost,
  NavigationHostCloseOptions,
  NavigationHostOpenOptions,
} from '../types'

/**
 * In-memory simulation of a native container stack.
 *
 * Each simulated container gets its own {@link NavigationHost}, so tests can
 * instantiate one `HybridRouterHistory` (and one router) per container and
 * exercise real cross-"heap" flows — open, replace, close, visibility
 * restore — without a device. Also usable for SSR-ish environments.
 */

export interface SimulatedContainer {
  readonly id: string
  readonly url: string
  readonly host: NavigationHost
  /** Whether this container is the visible top of the stack. */
  readonly visible: boolean
}

export interface MemoryNavigationEnvironment {
  /** Bottom → top. */
  readonly stack: readonly SimulatedContainer[]
  readonly top: SimulatedContainer | undefined
  /** Open a container from outside (e.g. simulate the app's entry deeplink). */
  open(url: string, options?: NavigationHostOpenOptions): SimulatedContainer
  /** Notified after every stack mutation. */
  onStackChange(callback: () => void): () => void
}

interface ContainerImpl {
  id: string
  url: string
  visible: boolean
  visibilityListeners: Array<(visible: boolean) => void>
  host: NavigationHost
}

export function createMemoryNavigationEnvironment(): MemoryNavigationEnvironment {
  const stack: ContainerImpl[] = []
  let nextId = 0
  let stackListeners: Array<() => void> = []

  function notifyStackChange() {
    for (const listener of stackListeners.slice()) listener()
  }

  function setVisible(container: ContainerImpl, visible: boolean) {
    if (container.visible === visible) return
    container.visible = visible
    for (const listener of container.visibilityListeners.slice()) {
      listener(visible)
    }
  }

  function syncVisibility() {
    stack.forEach((container, index) => {
      setVisible(container, index === stack.length - 1)
    })
  }

  function createContainer(url: string): ContainerImpl {
    const id = `container-${nextId++}`
    const container: ContainerImpl = {
      id,
      url,
      visible: false,
      visibilityListeners: [],
      host: {
        initialUrl: url,
        containerId: id,
        open(childUrl, options) {
          openFrom(container, childUrl, options)
          return Promise.resolve()
        },
        close(options) {
          closeFrom(container, options)
          return Promise.resolve()
        },
        onVisibilityChange(callback) {
          container.visibilityListeners.push(callback)
          return () => {
            const index = container.visibilityListeners.indexOf(callback)
            if (index > -1) container.visibilityListeners.splice(index, 1)
          }
        },
      },
    }
    return container
  }

  function openFrom(
    opener: ContainerImpl | null,
    url: string,
    options?: NavigationHostOpenOptions
  ): ContainerImpl {
    const container = createContainer(url)
    if (options?.replace && opener) {
      const index = stack.indexOf(opener)
      if (index > -1) {
        stack.splice(index, 1, container)
      } else {
        stack.push(container)
      }
    } else {
      stack.push(container)
    }
    syncVisibility()
    notifyStackChange()
    return container
  }

  function closeFrom(
    container: ContainerImpl,
    options?: NavigationHostCloseOptions
  ) {
    const count = Math.max(1, options?.count ?? 1)
    const index = stack.indexOf(container)
    if (index < 0) return
    // close self and (count - 1) containers below, clamped at the stack root
    const start = Math.max(0, index - count + 1)
    stack.splice(start, index - start + 1)
    syncVisibility()
    notifyStackChange()
  }

  return {
    get stack() {
      return stack.slice()
    },
    get top() {
      return stack[stack.length - 1]
    },
    open(url, options) {
      return openFrom(null, url, options)
    },
    onStackChange(callback) {
      stackListeners.push(callback)
      return () => {
        const index = stackListeners.indexOf(callback)
        if (index > -1) stackListeners.splice(index, 1)
      }
    },
  }
}
