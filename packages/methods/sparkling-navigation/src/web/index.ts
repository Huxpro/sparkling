// Copyright (c) 2022 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registerWebMethod } from 'sparkling-method/web-registry';

/**
 * Scheme params that identify the target bundle rather than carry page data.
 * Everything else is forwarded to the opened page as queryItems, matching the
 * native containers which expose scheme query params via
 * `lynx.__globalProps.queryItems`.
 */
const RESERVED_SCHEME_PARAMS = new Set(['bundle', 'url']);

registerWebMethod('router.open', (params, callback) => {
    const scheme = (params.data as Record<string, unknown>)?.scheme as string | undefined;

    if (!scheme) {
        callback({ code: 0, msg: 'scheme is required' });
        return;
    }

    try {
        const url = new URL(scheme);
        const bundleParam = url.searchParams.get('bundle');
        const urlParam = url.searchParams.get('url');

        // Extract page name (without extension).
        // Web shell constructs the full URL as /${page}.lynx.bundle
        let pageName: string;
        if (urlParam) {
            // Dev mode: url param is a full URL, extract the basename
            const urlPath = new URL(urlParam).pathname;
            pageName = urlPath.replace(/^\//, '').replace(/\.lynx\.bundle$/, '');
        } else if (bundleParam) {
            pageName = bundleParam.replace(/\.lynx\.bundle$/, '');
        } else {
            callback({ code: 0, msg: 'No bundle or url param in scheme' });
            return;
        }

        // Forward every non-reserved scheme param in the browser URL so the
        // shell can hand them to the new page as globalProps.queryItems.
        const nextParams = new URLSearchParams();
        nextParams.set('page', pageName);
        url.searchParams.forEach((value, key) => {
            if (!RESERVED_SCHEME_PARAMS.has(key) && key !== 'page') {
                nextParams.set(key, value);
            }
        });

        // Update browser history. `options.replace` swaps the current entry
        // instead of pushing a new one, matching the native OpenOptions.replace
        // semantics (e.g. Next.js redirect()/router.replace()).
        const data = (params.data as Record<string, unknown>) ?? {};
        const options = (data.options as Record<string, unknown> | undefined) ?? undefined;
        const replace = options?.replace === true || data.replace === true;
        const state = { page: pageName, scheme };
        if (replace) {
            window.history.replaceState(state, '', `?${nextParams.toString()}`);
        } else {
            window.history.pushState(state, '', `?${nextParams.toString()}`);
        }

        // Dispatch custom event for web shell to swap <lynx-view>
        window.dispatchEvent(new CustomEvent('sparkling:navigate', {
            detail: { page: pageName, state },
        }));

        callback({ code: 1, msg: 'ok' });
    } catch (e) {
        callback({ code: 0, msg: `Failed to parse scheme: ${e}` });
    }
});

registerWebMethod('router.close', (_params, callback) => {
    window.history.back();
    callback({ code: 1, msg: 'ok' });
});
