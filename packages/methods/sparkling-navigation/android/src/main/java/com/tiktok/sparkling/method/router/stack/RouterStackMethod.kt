// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling.method.router.stack

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.method.router.utils.RouterProvider
import com.tiktok.sparkling.method.router.utils.RouterStackCommand
import com.tiktok.sparkling.method.router.utils.RouterStackTarget

class RouterStackMethod : AbsRouterStackMethodIDL() {
    override fun handle(
        params: IDLMethodStackParamModel,
        callback: CompletionBlock<IDLMethodStackResultModel>,
        type: BridgePlatformType,
    ) {
        val commandName =
            params.command.ifBlank {
                callback.onFailure(IDLBridgeMethod.INVALID_PARAM, "command must not be empty")
                return
            }
        val routerDepend =
            RouterProvider.hostRouterDepend ?: run {
                callback.onFailure(IDLBridgeMethod.FAIL, "Router service not available")
                return
            }
        val command =
            RouterStackCommand(
                command = commandName,
                target = targetFrom(params),
                entryId = params.entryId,
                entries = params.entries.orEmpty().mapNotNull(::targetFrom),
                result = params.result,
                animated = params.animated ?: true,
                usePrefetched = params.usePrefetched ?: false,
            )
        val result =
            runCatching {
                routerDepend.executeStackCommand(
                    getSDKContext(),
                    command,
                    getSDKContext()?.context,
                )
            }.getOrNull()

        if (result == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Stack protocol is not implemented by host")
            return
        }
        if (!result.success) {
            callback.onFailure(IDLBridgeMethod.FAIL, result.message)
            return
        }
        callback.onSuccess(
            IDLMethodStackResultModel::class.java.createXModel().apply {
                entryId = result.entryId
                state = result.state
            },
        )
    }

    private fun targetFrom(params: IDLMethodStackParamModel): RouterStackTarget? {
        val path = params.path?.takeIf { it.isNotBlank() } ?: return null
        val scheme =
            params.scheme?.takeIf { it.isNotBlank() }
                ?: if (params.command == "syncOwnLocation") "" else return null
        return RouterStackTarget(
            path = path,
            search = params.search.orEmpty().mapValues { it.value.toString() },
            bundle = params.bundle.orEmpty(),
            scheme = scheme,
            presentation = params.presentation ?: "push",
        )
    }

    private fun targetFrom(value: Map<String, Any>): RouterStackTarget? {
        val scheme = value["scheme"]?.toString()?.takeIf { it.isNotBlank() } ?: return null
        val path = value["path"]?.toString()?.takeIf { it.isNotBlank() } ?: return null
        val search =
            (value["search"] as? Map<*, *>)
                .orEmpty()
                .mapNotNull { (key, item) ->
                    key?.toString()?.let { it to item.toString() }
                }.toMap()
        return RouterStackTarget(
            path = path,
            search = search,
            bundle = value["bundle"]?.toString().orEmpty(),
            scheme = scheme,
            presentation = value["presentation"]?.toString() ?: "push",
        )
    }
}
