// Copyright (c) 2022 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registerWebMethod } from 'sparkling-method/web-registry';

/** Options forwarded from `router.open` to the {@link RouterWebHost}. */
export interface RouterOpenOptions {
    /** Replace the current entry/container instead of stacking a new one. */
    replace?: boolean;
}

/**
 * How web navigation is actually performed. The default host drives the
 * browser History API and assumes the Lynx app owns the whole page (e.g.
 * `sparkling-web-shell`). Embedders that render Lynx cards inside a larger page
 * (such as the go-web `<Go>` preview) can override this with `setRouterWebHost`
 * so navigation stays scoped to the card instead of the top-level document.
 */
export interface RouterWebHost {
    open(pageName: string, scheme: string, options?: RouterOpenOptions): void;
    close(): void;
}

const defaultHost: RouterWebHost = {
    open(pageName, scheme, options) {
        const state = { page: pageName, scheme };
        const method = options?.replace ? 'replaceState' : 'pushState';
        window.history[method](state, '', `?page=${encodeURIComponent(pageName)}`);
        // Notify a full-page host (e.g. the web shell) to swap its <lynx-view>.
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
        const replace = (params.data as Record<string, unknown>)?.replace === true;
        host.open(pageName, scheme, { replace });
        callback({ code: 1, msg: 'ok' });
    } catch (e) {
        callback({ code: 0, msg: `Failed to parse scheme: ${e}` });
    }
});

registerWebMethod('router.close', (_params, callback) => {
    try {
        host.close();
        callback({ code: 1, msg: 'ok' });
    } catch (e) {
        callback({ code: 0, msg: `Failed to close: ${e}` });
    }
});
