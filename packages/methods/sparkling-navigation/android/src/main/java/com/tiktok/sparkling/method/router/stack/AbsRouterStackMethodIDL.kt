// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling.method.router.stack

import com.tiktok.sparkling.method.registry.core.annotation.IDLMethodName
import com.tiktok.sparkling.method.registry.core.annotation.IDLMethodParamField
import com.tiktok.sparkling.method.registry.core.annotation.IDLMethodParamModel
import com.tiktok.sparkling.method.registry.core.annotation.IDLMethodResultModel
import com.tiktok.sparkling.method.registry.core.base.AbsSparklingIDLMethod
import com.tiktok.sparkling.method.registry.core.model.idl.IDLMethodBaseParamModel
import com.tiktok.sparkling.method.registry.core.model.idl.IDLMethodBaseResultModel

abstract class AbsRouterStackMethodIDL :
    AbsSparklingIDLMethod<
        AbsRouterStackMethodIDL.IDLMethodStackParamModel,
        AbsRouterStackMethodIDL.IDLMethodStackResultModel,
    >() {
    @IDLMethodName(
        name = "router.stack",
        params = [
            "command",
            "path",
            "search",
            "bundle",
            "scheme",
            "presentation",
            "entryId",
            "entries",
            "result",
            "animated",
            "usePrefetched",
        ],
        results = ["entryId", "state"],
    )
    final override val name: String = "router.stack"

    @IDLMethodParamModel
    interface IDLMethodStackParamModel : IDLMethodBaseParamModel {
        @get:IDLMethodParamField(required = true, isGetter = true, keyPath = "command")
        val command: String

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "path")
        val path: String?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "search")
        val search: Map<String, Any>?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "bundle")
        val bundle: String?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "scheme")
        val scheme: String?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "presentation")
        val presentation: String?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "entryId")
        val entryId: String?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "entries")
        val entries: List<Map<String, Any>>?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "result")
        val result: Any?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "animated")
        val animated: Boolean?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "usePrefetched")
        val usePrefetched: Boolean?
    }

    @IDLMethodResultModel
    interface IDLMethodStackResultModel : IDLMethodBaseResultModel {
        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "entryId")
        @set:IDLMethodParamField(required = false, isGetter = false, keyPath = "entryId")
        var entryId: String?

        @get:IDLMethodParamField(required = false, isGetter = true, keyPath = "state")
        @set:IDLMethodParamField(required = false, isGetter = false, keyPath = "state")
        var state: Map<String, Any>?
    }
}
