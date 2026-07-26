// Copyright (c) 2022 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling

import java.util.concurrent.ConcurrentHashMap

object SparklingContextTransferStation {
    private val sparklingContextMap = ConcurrentHashMap<String, SparklingContext>()

    fun saveSparklingContext(context: SparklingContext) {
        sparklingContextMap[context.containerId] = context
    }

    fun getSparklingContext(containerId: String?): SparklingContext? =
        containerId?.let(sparklingContextMap::get)

    fun releaseSparklingContext(containerId: String?) {
        containerId?.let(sparklingContextMap::remove)
    }

    @JvmStatic
    internal fun clearAllContexts() {
        sparklingContextMap.clear()
    }
}
