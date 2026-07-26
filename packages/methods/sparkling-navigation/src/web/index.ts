// Copyright (c) 2022 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registerWebMethod } from 'sparkling-method/web-registry';
import {
    emitLocalStackChanged,
    STACK_CHANGED_EVENT,
} from '../stack/stack';
import type {
    StackChangedEvent,
    StackEntry,
    StackState,
} from '../stack/stack.types';

/**
 * How web navigation is actually performed. The default host drives the
 * browser History API and assumes the Lynx app owns the whole page (e.g.
 * `sparkling-web-shell`). Embedders that render Lynx cards inside a larger page
 * (such as the go-web `<Go>` preview) can override this with `setRouterWebHost`
 * so navigation stays scoped to the card instead of the top-level document.
 */
export interface RouterWebHost {
    open(pageName: string, scheme: string): void;
    replace?(pageName: string, scheme: string): void;
    close(params?: { containerID?: string; animated?: boolean }): void;
}

const defaultHost: RouterWebHost = {
    open(pageName, scheme) {
        const state = { page: pageName, scheme };
        window.history.pushState(state, '', `?page=${encodeURIComponent(pageName)}`);
        // Notify a full-page host (e.g. the web shell) to swap its <lynx-view>.
        window.dispatchEvent(
            new CustomEvent('sparkling:navigate', { detail: { page: pageName, state } }),
        );
    },
    replace(pageName, scheme) {
        const state = { page: pageName, scheme };
        window.history.replaceState(state, '', `?page=${encodeURIComponent(pageName)}`);
        window.dispatchEvent(
            new CustomEvent('sparkling:navigate', { detail: { page: pageName, state } }),
        );
    },
    close() {
        window.history.back();
    },
};

let host: RouterWebHost = defaultHost;

/**
 * Override how `router.open` / `router.close` navigate on web. Call with a
 * host that navigates within an embedded card to avoid touching global
 * `window.history`.
 */
export function setRouterWebHost(next: RouterWebHost): void {
    host = next;
}

/** Extract the target page name (no extension) from a router scheme. */
function parsePageName(scheme: string): string | null {
    const url = new URL(scheme);
    const bundleParam = url.searchParams.get('bundle');
    const urlParam = url.searchParams.get('url');
    if (urlParam) {
        // Dev mode: url param is a full URL, extract the basename.
        const urlPath = new URL(urlParam).pathname;
        return urlPath.replace(/^\//, '').replace(/\.lynx\.bundle$/, '');
    }
    if (bundleParam) {
        return bundleParam.replace(/\.lynx\.bundle$/, '');
    }
    return null;
}

registerWebMethod('router.open', (params, callback) => {
    const scheme = (params.data as Record<string, unknown>)?.scheme as string | undefined;

    if (!scheme) {
        callback({ code: 0, msg: 'scheme is required' });
        return;
    }

    try {
        const pageName = parsePageName(scheme);
        if (!pageName) {
            callback({ code: 0, msg: 'No bundle or url param in scheme' });
            return;
        }
        host.open(pageName, scheme);
        callback({ code: 1, msg: 'ok' });
    } catch (e) {
        callback({ code: 0, msg: `Failed to parse scheme: ${e}` });
    }
});

registerWebMethod('router.close', (params, callback) => {
    try {
        host.close(params.data as { containerID?: string; animated?: boolean });
        callback({ code: 1, msg: 'ok' });
    } catch (e) {
        callback({ code: 0, msg: `Failed to close: ${e}` });
    }
});

let webStackState: StackState = { version: 0, entries: [] };

function nextEntryId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function publishStack(
    reason: StackChangedEvent['reason'],
    result?: StackChangedEvent['result'],
): void {
    webStackState = {
        version: webStackState.version + 1,
        entries: webStackState.entries.slice(),
    };
    const event: StackChangedEvent = { state: webStackState, reason, result };
    emitLocalStackChanged(event);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STACK_CHANGED_EVENT, { detail: event }));
    }
}

function stackEntry(data: Record<string, unknown>): StackEntry {
    return {
        id: nextEntryId(),
        path: String(data.path ?? '/'),
        search: (data.search as Record<string, string> | undefined) ?? {},
        bundle: String(data.bundle ?? parsePageName(String(data.scheme ?? '')) ?? ''),
        presentation: data.presentation === 'modal' ? 'modal' : 'push',
    };
}

registerWebMethod('router.stack', (params, callback) => {
    const data = (params.data ?? {}) as Record<string, unknown>;
    const command = data.command;

    try {
        if (command === 'getState') {
            callback({ code: 1, msg: 'ok', data: { state: webStackState } });
            return;
        }

        if (command === 'push') {
            const scheme = String(data.scheme ?? '');
            const pageName = parsePageName(scheme);
            if (!pageName) {
                callback({ code: 0, msg: 'push requires a resolved scheme' });
                return;
            }
            const entry = stackEntry(data);
            host.open(pageName, scheme);
            webStackState.entries.push(entry);
            publishStack('push');
            callback({ code: 1, msg: 'ok', data: { entryId: entry.id, state: webStackState } });
            return;
        }

        if (command === 'pop') {
            const popped = webStackState.entries.pop();
            host.close({ animated: data.animated as boolean | undefined });
            const parent = webStackState.entries[webStackState.entries.length - 1];
            publishStack(
                'pop',
                parent && 'result' in data
                    ? { forEntryId: parent.id, value: data.result }
                    : undefined,
            );
            callback({ code: popped ? 1 : 0, msg: popped ? 'ok' : 'stack is empty', data: { state: webStackState } });
            return;
        }

        if (command === 'popTo') {
            const index = webStackState.entries.findIndex((entry) => entry.id === data.entryId);
            if (index < 0) {
                callback({ code: 0, msg: `Unknown entry: ${String(data.entryId)}` });
                return;
            }
            webStackState.entries.splice(index + 1);
            publishStack('pop');
            callback({ code: 1, msg: 'ok', data: { state: webStackState } });
            return;
        }

        if (command === 'replace') {
            const scheme = String(data.scheme ?? '');
            const pageName = parsePageName(scheme);
            if (!pageName) {
                callback({ code: 0, msg: 'replace requires a resolved scheme' });
                return;
            }
            const entry = stackEntry(data);
            if (webStackState.entries.length > 0) {
                webStackState.entries.splice(-1, 1, entry);
            } else {
                webStackState.entries.push(entry);
            }
            (host.replace ?? host.open)(pageName, scheme);
            publishStack('replace');
            callback({ code: 1, msg: 'ok', data: { entryId: entry.id, state: webStackState } });
            return;
        }

        if (command === 'reset') {
            const entries = Array.isArray(data.entries)
                ? data.entries.map((entry) => stackEntry(entry as Record<string, unknown>))
                : [];
            webStackState.entries = entries;
            const rawEntries = Array.isArray(data.entries) ? data.entries : [];
            const last = rawEntries[rawEntries.length - 1] as Record<string, unknown> | undefined;
            const scheme = String(last?.scheme ?? '');
            const pageName = scheme ? parsePageName(scheme) : null;
            if (pageName) {
                (host.replace ?? host.open)(pageName, scheme);
            }
            publishStack('reset');
            callback({ code: 1, msg: 'ok', data: { entryId: entries[entries.length - 1]?.id, state: webStackState } });
            return;
        }

        if (command === 'syncOwnLocation') {
            const entry = webStackState.entries.find((item) => item.id === params.containerID)
                ?? webStackState.entries[webStackState.entries.length - 1];
            if (entry) {
                entry.path = String(data.path ?? entry.path);
                entry.search = (data.search as Record<string, string> | undefined) ?? entry.search;
                publishStack('replace');
            }
            callback({ code: 1, msg: 'ok', data: { state: webStackState } });
            return;
        }

        if (command === 'prefetch') {
            callback({ code: 1, msg: 'ok' });
            return;
        }

        callback({ code: 0, msg: `Unknown stack command: ${String(command)}` });
    } catch (e) {
        callback({ code: 0, msg: `Stack command failed: ${e}` });
    }
});
