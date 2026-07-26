// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.example.sparkling.go

import android.content.Context
import com.tiktok.sparkling.Sparkling
import com.tiktok.sparkling.SparklingContext
import com.tiktok.sparkling.SparklingNavigationStack
import com.tiktok.sparkling.SparklingNavigationTarget
import com.tiktok.sparkling.hybridkit.service.HybridActivityStackManager
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IBridgeContext
import com.tiktok.sparkling.method.router.utils.IHostRouterDepend
import com.tiktok.sparkling.method.router.utils.RouterStackCommand
import com.tiktok.sparkling.method.router.utils.RouterStackResult
import com.tiktok.sparkling.method.router.utils.RouterStackTarget

class SparklingHostRouterDepend : IHostRouterDepend {
    override fun openScheme(
        bridgeContext: IBridgeContext?,
        scheme: String,
        extraParams: Map<String, Any>,
        platformType: BridgePlatformType,
        context: Context?,
    ): Boolean {
        val sparklingContext = SparklingContext()
        sparklingContext.scheme = scheme
        return context?.let {
            Sparkling.Companion.build(it, sparklingContext).navigate()
        } ?: false
    }

    override fun closeView(
        bridgeContext: IBridgeContext?,
        type: BridgePlatformType,
        containerID: String?,
        animated: Boolean?,
    ): Boolean {
        if (!containerID.isNullOrBlank()) {
            return SparklingNavigationStack.pop(containerID).success
        }
        val currentId = bridgeContext?.containerID
        if (!currentId.isNullOrBlank() && SparklingNavigationStack.pop(currentId).success) {
            return true
        }
        val ownerActivity = bridgeContext?.ownerActivity
        if (ownerActivity != null) {
            ownerActivity.finish()
            return true
        } else {
            val top = HybridActivityStackManager.getTopActivity() ?: return false
            top.finish()
            return true
        }
    }

    override fun executeStackCommand(
        bridgeContext: IBridgeContext?,
        command: RouterStackCommand,
        context: Context?,
    ): RouterStackResult? {
        val appContext = context ?: bridgeContext?.context
        val response =
            when (command.command) {
                "getState" -> null
                "push" -> {
                    val target = command.target ?: return RouterStackResult(false, "push requires a target")
                    val hostContext = appContext ?: return RouterStackResult(false, "Context not available")
                    SparklingNavigationStack.push(
                        hostContext,
                        target.toNative(),
                        usePrefetched = command.usePrefetched,
                        sourceEntryId = bridgeContext?.containerID,
                    )
                }
                "pop" ->
                    SparklingNavigationStack.pop(
                        bridgeContext?.containerID,
                        result = command.result,
                    )
                "popTo" -> {
                    val entryId = command.entryId ?: return RouterStackResult(false, "popTo requires entryId")
                    SparklingNavigationStack.popTo(entryId)
                }
                "replace" -> {
                    val target = command.target ?: return RouterStackResult(false, "replace requires a target")
                    val hostContext = appContext ?: return RouterStackResult(false, "Context not available")
                    SparklingNavigationStack.replace(
                        hostContext,
                        bridgeContext?.containerID,
                        target.toNative(),
                    )
                }
                "reset" -> {
                    val hostContext = appContext ?: return RouterStackResult(false, "Context not available")
                    SparklingNavigationStack.reset(
                        hostContext,
                        command.entries.map { it.toNative() },
                    )
                }
                "prefetch" -> {
                    val target = command.target ?: return RouterStackResult(false, "prefetch requires a target")
                    val hostContext = appContext ?: return RouterStackResult(false, "Context not available")
                    SparklingNavigationStack.prefetch(hostContext, target.toNative())
                }
                "syncOwnLocation" -> {
                    val target = command.target ?: return RouterStackResult(false, "syncOwnLocation requires a location")
                    SparklingNavigationStack.syncOwnLocation(
                        bridgeContext?.containerID,
                        target.path,
                        target.search,
                    )
                }
                else -> return RouterStackResult(false, "Unknown command: ${command.command}")
            }
        return RouterStackResult(
            success = response?.success ?: true,
            message = response?.message ?: "ok",
            entryId = response?.entryId,
            state = SparklingNavigationStack.stateMap(),
        )
    }

    private fun RouterStackTarget.toNative(): SparklingNavigationTarget =
        SparklingNavigationTarget(
            path = path,
            search = search,
            bundle = bundle,
            scheme = scheme,
            presentation = presentation,
        )
}
