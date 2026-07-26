// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling.method.router.utils

import com.tiktok.sparkling.method.registry.core.IBridgeContext

/**
 * Optional host contract for the hard-navigation stack protocol (RFC §4).
 *
 * Android implements against the shared conformance suite after iOS freezes
 * semantics. Default methods return false / empty so hosts can opt in gradually.
 */
interface IHostStackRouterDepend {
    fun push(
        bridgeContext: IBridgeContext?,
        path: String,
        search: Map<String, String>?,
        presentation: String?,
        usePrefetched: Boolean,
        animated: Boolean,
    ): String? = null

    fun pop(
        bridgeContext: IBridgeContext?,
        result: Any?,
        animated: Boolean,
    ): String? = null

    fun popTo(
        bridgeContext: IBridgeContext?,
        entryId: String,
        animated: Boolean,
    ): Boolean = false

    fun replace(
        bridgeContext: IBridgeContext?,
        path: String,
        search: Map<String, String>?,
    ): String? = null

    fun reset(
        bridgeContext: IBridgeContext?,
        entries: List<Map<String, Any?>>,
    ): String? = null

    fun getState(bridgeContext: IBridgeContext?): Map<String, Any?> =
        mapOf("version" to 0, "entries" to emptyList<Any>())

    fun prefetch(
        bridgeContext: IBridgeContext?,
        path: String,
        search: Map<String, String>?,
    ): Boolean = false

    fun syncOwnLocation(
        bridgeContext: IBridgeContext?,
        path: String,
        search: Map<String, String>?,
    ) {
        // no-op by default
    }
}
