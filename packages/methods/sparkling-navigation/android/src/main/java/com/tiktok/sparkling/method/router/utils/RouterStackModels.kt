// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling.method.router.utils

data class RouterStackTarget(
    val path: String,
    val search: Map<String, String>,
    val bundle: String,
    val scheme: String,
    val presentation: String,
)

data class RouterStackCommand(
    val command: String,
    val target: RouterStackTarget?,
    val entryId: String?,
    val entries: List<RouterStackTarget>,
    val result: Any?,
    val animated: Boolean,
    val usePrefetched: Boolean,
)

data class RouterStackResult(
    val success: Boolean,
    val message: String,
    val entryId: String? = null,
    val state: Map<String, Any>? = null,
)
