// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling

import android.app.Activity
import android.content.Context
import android.net.Uri
import com.tiktok.sparkling.hybridkit.KitViewManager
import org.json.JSONObject
import java.lang.ref.WeakReference

data class SparklingNavigationTarget(
    val path: String,
    val search: Map<String, String> = emptyMap(),
    val bundle: String,
    val scheme: String,
    val presentation: String = "push",
)

data class SparklingNavigationResult(
    val success: Boolean,
    val message: String,
    val entryId: String? = null,
)

private data class AndroidStackEntry(
    val id: String,
    var path: String,
    var search: Map<String, String>,
    val bundle: String,
    val presentation: String,
    var activity: WeakReference<Activity>? = null,
) {
    fun toMap(): Map<String, Any> =
        mapOf(
            "id" to id,
            "path" to path,
            "search" to search,
            "bundle" to bundle,
            "presentation" to presentation,
        )
}

/**
 * Android implementation of Sparkling's hard-container source of truth.
 *
 * Activities register themselves on creation and are held weakly. Commands
 * update the ordered mirror before broadcasting through every live KitView.
 */
object SparklingNavigationStack {
    const val STACK_CHANGED_EVENT = "router.stackchanged"

    private var version = 0
    private val orderedIds = mutableListOf<String>()
    private val entries = linkedMapOf<String, AndroidStackEntry>()
    private val pendingReasons = mutableMapOf<String, String>()
    private val pendingResults = mutableMapOf<String, Any?>()
    private val prefetchedContexts = mutableMapOf<String, SparklingContext>()

    @Synchronized
    fun register(
        activity: Activity,
        sparklingContext: SparklingContext?,
    ) {
        val context = sparklingContext ?: return
        val existing = entries[context.containerId]
        if (existing != null) {
            existing.activity = WeakReference(activity)
            return
        }
        val target = targetFromScheme(context.scheme.orEmpty())
        entries[context.containerId] =
            AndroidStackEntry(
                id = context.containerId,
                path = target.path,
                search = target.search,
                bundle = target.bundle,
                presentation = target.presentation,
                activity = WeakReference(activity),
            )
        orderedIds += context.containerId
        publish("system")
    }

    @Synchronized
    fun unregister(containerId: String?) {
        val id = containerId ?: return
        val index = orderedIds.indexOf(id)
        if (index < 0 || entries.remove(id) == null) return
        orderedIds.removeAt(index)
        val parentId = orderedIds.getOrNull(index - 1)
        val reason = pendingReasons.remove(id) ?: "system"
        val value = pendingResults.remove(id)
        val result =
            if (parentId != null && value != null) {
                mapOf("forEntryId" to parentId, "value" to value)
            } else {
                null
            }
        publish(reason, result)
    }

    @Synchronized
    fun push(
        context: Context,
        target: SparklingNavigationTarget,
        usePrefetched: Boolean = false,
        publishChange: Boolean = true,
    ): SparklingNavigationResult {
        if (target.scheme.isBlank()) {
            return SparklingNavigationResult(false, "scheme is required")
        }
        if (target.presentation == "modal") {
            return SparklingNavigationResult(false, "modal presentation is not implemented on Android")
        }
        val sparklingContext =
            if (usePrefetched) {
                prefetchedContexts.remove(target.scheme)
            } else {
                null
            } ?: SparklingContext().also { it.scheme = target.scheme }
        val success = Sparkling.build(context, sparklingContext).navigate()
        if (!success) {
            return SparklingNavigationResult(false, "Unable to start SparklingActivity")
        }
        val id = sparklingContext.containerId
        entries[id] =
            AndroidStackEntry(
                id = id,
                path = target.path,
                search = target.search,
                bundle = target.bundle,
                presentation = target.presentation,
            )
        if (!orderedIds.contains(id)) orderedIds += id
        if (publishChange) publish("push")
        return SparklingNavigationResult(true, "ok", id)
    }

    @Synchronized
    fun pop(
        entryId: String?,
        result: Any? = null,
        reason: String = "pop",
    ): SparklingNavigationResult {
        val id = entryId ?: orderedIds.lastOrNull()
            ?: return SparklingNavigationResult(false, "Stack is empty")
        val entry = entries[id]
            ?: return SparklingNavigationResult(false, "Unknown entry: $id")
        pendingReasons[id] = reason
        if (result != null) pendingResults[id] = result
        val activity = entry.activity?.get()
        if (activity != null) {
            activity.finish()
        } else {
            unregister(id)
        }
        return SparklingNavigationResult(true, "ok", id)
    }

    @Synchronized
    fun popTo(entryId: String): SparklingNavigationResult {
        val targetIndex = orderedIds.indexOf(entryId)
        if (targetIndex < 0) {
            return SparklingNavigationResult(false, "Unknown entry: $entryId")
        }
        val removing = orderedIds.drop(targetIndex + 1).reversed()
        removing.forEach { id ->
            entries[id]?.activity?.get()?.finish()
            entries.remove(id)
            orderedIds.remove(id)
            pendingReasons.remove(id)
            pendingResults.remove(id)
        }
        publish("pop")
        return SparklingNavigationResult(true, "ok", entryId)
    }

    @Synchronized
    fun replace(
        context: Context,
        sourceEntryId: String?,
        target: SparklingNavigationTarget,
    ): SparklingNavigationResult {
        val sourceId = sourceEntryId ?: orderedIds.lastOrNull()
        val pushed = push(context, target, publishChange = false)
        if (!pushed.success) return pushed
        if (sourceId != null && sourceId != pushed.entryId) {
            entries[sourceId]?.activity?.get()?.finish()
            entries.remove(sourceId)
            orderedIds.remove(sourceId)
        }
        publish("replace")
        return pushed
    }

    @Synchronized
    fun reset(
        context: Context,
        targets: List<SparklingNavigationTarget>,
    ): SparklingNavigationResult {
        val oldEntries = orderedIds.toList()
        oldEntries.reversed().forEach { id ->
            entries[id]?.activity?.get()?.finish()
            entries.remove(id)
        }
        orderedIds.clear()

        var lastResult = SparklingNavigationResult(true, "ok")
        targets.forEach { target ->
            lastResult = push(context, target, publishChange = false)
            if (!lastResult.success) {
                publish("reset")
                return lastResult
            }
        }
        publish("reset")
        return lastResult
    }

    @Synchronized
    fun prefetch(
        context: Context,
        target: SparklingNavigationTarget,
    ): SparklingNavigationResult {
        if (target.scheme.isBlank()) {
            return SparklingNavigationResult(false, "scheme is required")
        }
        val sparklingContext = SparklingContext().also {
            it.scheme = target.scheme
        }
        Sparkling.build(context, sparklingContext).processSparklingContext(sparklingContext)
        prefetchedContexts[target.scheme] = sparklingContext
        return SparklingNavigationResult(true, "ok", sparklingContext.containerId)
    }

    @Synchronized
    fun syncOwnLocation(
        entryId: String?,
        path: String,
        search: Map<String, String>,
    ) {
        val id = entryId ?: orderedIds.lastOrNull() ?: return
        val entry = entries[id] ?: return
        entry.path = path
        entry.search = search
        publish("replace")
    }

    @Synchronized
    fun markUserBack(containerId: String?) {
        if (containerId != null) pendingReasons[containerId] = "user-back-button"
    }

    @Synchronized
    fun stateMap(): Map<String, Any> =
        mapOf(
            "version" to version,
            "entries" to orderedIds.mapNotNull { entries[it]?.toMap() },
        )

    private fun publish(
        reason: String,
        result: Map<String, Any?>? = null,
    ) {
        version += 1
        val event =
            mutableMapOf<String, Any>(
                "state" to stateMap(),
                "reason" to reason,
            )
        if (result != null) event["result"] = result
        val payload = JSONObject(event)
        KitViewManager.getKitViews().values.forEach { kitView ->
            runCatching {
                kitView.sendEventByJSON(STACK_CHANGED_EVENT, payload)
            }
        }
    }

    private fun targetFromScheme(scheme: String): SparklingNavigationTarget {
        val uri = runCatching { Uri.parse(scheme) }.getOrNull()
        val query =
            uri
                ?.queryParameterNames
                ?.associateWith { uri.getQueryParameter(it).orEmpty() }
                ?.toMutableMap()
                ?: mutableMapOf()
        val path = query.remove("__path") ?: "/"
        val bundle = query.remove("bundle").orEmpty()
        query.remove("url")
        return SparklingNavigationTarget(
            path = path,
            search = query,
            bundle = bundle,
            scheme = scheme,
        )
    }
}
