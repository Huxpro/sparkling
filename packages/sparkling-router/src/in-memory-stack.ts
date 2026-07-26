// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getGlobalStackMirror } from './global-stack-mirror.js'
import { hrefFromPathAndSearch, pathToScheme } from './scheme.js'
import type {
  NativeStackProtocol,
  NavResult,
  RouteManifest,
  StackChangeReason,
  StackEntry,
  StackState,
} from './types.js'

export interface InMemoryStackOptions {
  manifest: RouteManifest
  /** Seed the stack with an initial entry (defaults to first container `/`). */
  initial?: { path: string; search?: Record<string, string> }
  onChange?: (state: StackState, reason: StackChangeReason) => void
}

/**
 * JS-only stack protocol for unit tests and soft-nav playgrounds.
 * Mirrors native semantics closely enough to exercise CompositeHistory.
 */
export function createInMemoryStackProtocol(
  options: InMemoryStackOptions,
): NativeStackProtocol {
  let version = 0
  const entries: StackEntry[] = []
  const mirror = getGlobalStackMirror()

  const emit = (reason: StackChangeReason, result?: { forEntryId: string; value: unknown }) => {
    version += 1
    const state: StackState = {
      version,
      entries: entries.map((e) => ({ ...e, search: { ...e.search } })),
    }
    mirror.apply({ state, reason, result })
    options.onChange?.(state, reason)
  }

  const resolveEntry = (
    path: string,
    search: Record<string, string> | undefined,
    presentation: 'push' | 'modal' | undefined,
  ): StackEntry | undefined => {
    const translated = pathToScheme(hrefFromPathAndSearch(path, search), options.manifest)
    if (!translated) {
      return undefined
    }
    return {
      id: `mem-${Math.random().toString(36).slice(2, 10)}`,
      path: translated.path,
      search: translated.search,
      bundle: translated.container.bundle,
      presentation: presentation ?? translated.container.presentation,
    }
  }

  if (options.initial) {
    const seed = resolveEntry(options.initial.path, options.initial.search, 'push')
    if (seed) {
      entries.push(seed)
      emit('reset')
    }
  } else if (options.manifest.containers[0]) {
    const first = options.manifest.containers[0]
    const path = first.routes[0]?.path ?? '/'
    const seed = resolveEntry(path, undefined, first.presentation)
    if (seed) {
      entries.push(seed)
      emit('reset')
    }
  }

  const ok = (entryId: string): NavResult => ({ code: 1, entryId })
  const fail = (msg: string): NavResult => ({ code: 0, msg })

  return {
    async push(req) {
      const entry = resolveEntry(req.path, req.search, req.presentation)
      if (!entry) {
        return fail(`No container owns path: ${req.path}`)
      }
      entries.push(entry)
      emit('push')
      return ok(entry.id)
    },

    async pop(req) {
      if (entries.length <= 1) {
        return fail('Cannot pop root stack entry')
      }
      const removed = entries.pop()!
      const below = entries[entries.length - 1]!
      emit(
        'pop',
        req?.result !== undefined
          ? { forEntryId: below.id, value: req.result }
          : undefined,
      )
      return ok(removed.id)
    },

    async popTo(req) {
      const index = entries.findIndex((e) => e.id === req.entryId)
      if (index < 0) {
        return fail(`Unknown entryId: ${req.entryId}`)
      }
      if (index === entries.length - 1) {
        return ok(req.entryId)
      }
      entries.splice(index + 1)
      emit('pop')
      return ok(req.entryId)
    },

    async replace(req) {
      if (entries.length === 0) {
        return fail('Stack is empty')
      }
      const entry = resolveEntry(req.path, req.search, entries[entries.length - 1]?.presentation)
      if (!entry) {
        return fail(`No container owns path: ${req.path}`)
      }
      const prev = entries[entries.length - 1]!
      entry.id = prev.id
      entries[entries.length - 1] = entry
      emit('replace')
      return ok(entry.id)
    },

    async reset(req) {
      const next: StackEntry[] = []
      for (const item of req.entries) {
        const entry = resolveEntry(item.path, item.search, item.presentation)
        if (!entry) {
          return fail(`No container owns path: ${item.path}`)
        }
        next.push(entry)
      }
      entries.splice(0, entries.length, ...next)
      emit('reset')
      return ok(entries[entries.length - 1]?.id ?? '')
    },

    async getState() {
      return {
        version,
        entries: entries.map((e) => ({ ...e, search: { ...e.search } })),
      }
    },

    async prefetch() {
      return { code: 1, msg: 'ok' }
    },

    syncOwnLocation(req) {
      if (entries.length === 0) {
        return
      }
      const top = entries[entries.length - 1]!
      top.path = req.path
      top.search = { ...req.search }
      emit('sync')
    },
  }
}
