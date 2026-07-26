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
import java.util.ArrayDeque

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
    var returnToEntryId: String? = null,
    var pendingLaunch: Boolean = false,
    var activity: WeakReference<Activity>? = null,
) {
    fun toMap(): Map<String, Any> =
        mapOf(
            "id" to id,
            "path" to path,
            "search" to search.toMap(),
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
    private val cancelledLaunches = mutableSetOf<String>()
    private val publicationQueue = ArrayDeque<JSONObject>()
    private var isPublishing = false

    @Synchronized
    fun register(
        activity: Activity,
        sparklingContext: SparklingContext?,
    ): Boolean {
        val context = sparklingContext ?: return false
        if (cancelledLaunches.remove(context.containerId)) {
            return false
        }
        val existing = entries[context.containerId]
        if (existing != null) {
            existing.activity = WeakReference(activity)
            existing.pendingLaunch = false
            return true
        }
        val target = targetFromScheme(context.scheme.orEmpty())
        entries[context.containerId] =
            AndroidStackEntry(
                id = context.containerId,
                path = target.path,
                search = target.search,
                bundle = target.bundle,
                presentation = target.presentation,
                returnToEntryId = orderedIds.lastOrNull(),
                activity = WeakReference(activity),
            )
        orderedIds += context.containerId
        publish("system")
        return true
    }

    @Synchronized
    fun unregister(containerId: String?) {
        val id = containerId ?: return
        val reason = pendingReasons.remove(id) ?: "system"
        removeRecord(id, reason, null, publishChange = true)
    }

    @Synchronized
    fun push(
        context: Context,
        target: SparklingNavigationTarget,
        usePrefetched: Boolean = false,
        sourceEntryId: String? = null,
        publishChange: Boolean = true,
    ): SparklingNavigationResult {
        if (target.scheme.isBlank()) {
            return SparklingNavigationResult(false, "scheme is required")
        }
        if (target.presentation !in setOf("push", "modal")) {
            return SparklingNavigationResult(false, "Unknown presentation: ${target.presentation}")
        }
        if (target.presentation != "push") {
            return SparklingNavigationResult(false, "modal presentation is not implemented on Android")
        }
        if (usePrefetched) {
            return SparklingNavigationResult(false, "Android container prefetch is not implemented")
        }
        if (sourceEntryId != null) {
            if (!entries.containsKey(sourceEntryId)) {
                return SparklingNavigationResult(false, "Unknown source entry: $sourceEntryId")
            }
            if (orderedIds.lastOrNull() != sourceEntryId) {
                return SparklingNavigationResult(false, "Source entry is not on top: $sourceEntryId")
            }
        }
        val sparklingContext = SparklingContext().also { it.scheme = target.scheme }
        val id = sparklingContext.containerId
        entries[id] =
            AndroidStackEntry(
                id = id,
                path = target.path,
                search = target.search.toMap(),
                bundle = target.bundle,
                presentation = target.presentation,
                returnToEntryId = sourceEntryId ?: orderedIds.lastOrNull(),
                pendingLaunch = true,
            )
        orderedIds += id
        val success = Sparkling.build(context, sparklingContext).navigate()
        if (!success) {
            entries.remove(id)
            orderedIds.remove(id)
            return SparklingNavigationResult(false, "Unable to start SparklingActivity")
        }
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
        val activity = entry.activity?.get()
        if (entry.pendingLaunch && activity == null) {
            cancelledLaunches += id
        }
        removeRecord(id, reason, result, publishChange = true)
        activity?.finish()
        return SparklingNavigationResult(true, "ok", id)
    }

    @Synchronized
    fun popTo(entryId: String): SparklingNavigationResult {
        val targetIndex = orderedIds.indexOf(entryId)
        if (targetIndex < 0) {
            return SparklingNavigationResult(false, "Unknown entry: $entryId")
        }
        val removing = orderedIds.drop(targetIndex + 1).reversed()
        if (removing.isEmpty()) {
            return SparklingNavigationResult(true, "ok", entryId)
        }
        removing.forEach { id ->
            val entry = entries[id]
            val activity = entry?.activity?.get()
            if (entry?.pendingLaunch == true && activity == null) {
                cancelledLaunches += id
            }
            removeRecord(id, "pop", null, publishChange = false)
            activity?.finish()
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
            ?: return SparklingNavigationResult(false, "Stack is empty")
        val source = entries[sourceId]
            ?: return SparklingNavigationResult(false, "Unknown source entry: $sourceId")
        if (orderedIds.lastOrNull() != sourceId) {
            return SparklingNavigationResult(false, "Only the top entry can be replaced")
        }
        val pushed =
            push(
                context,
                target,
                sourceEntryId = sourceId,
                publishChange = false,
            )
        if (!pushed.success) return pushed
        val replacementId = pushed.entryId
            ?: return SparklingNavigationResult(false, "Replacement entry ID is unavailable")
        entries[replacementId]?.returnToEntryId = source.returnToEntryId
        if (sourceId != replacementId) {
            val activity = source.activity?.get()
            removeRecord(sourceId, "replace", null, publishChange = false)
            activity?.finish()
        }
        publish("replace")
        return pushed
    }

    @Synchronized
    fun reset(
        context: Context,
        targets: List<SparklingNavigationTarget>,
    ): SparklingNavigationResult {
        if (targets.isEmpty()) {
            return SparklingNavigationResult(false, "reset requires entries")
        }
        val invalidTarget =
            targets.firstOrNull {
                it.scheme.isBlank() || it.presentation != "push"
            }
        if (invalidTarget != null) {
            return SparklingNavigationResult(
                false,
                "Android reset requires valid push entries",
            )
        }

        val oldEntries = orderedIds.toList()
        val stagedIds = mutableListOf<String>()
        var lastResult = SparklingNavigationResult(true, "ok")
        targets.forEach { target ->
            lastResult =
                push(
                    context,
                    target,
                    sourceEntryId = orderedIds.lastOrNull(),
                    publishChange = false,
                )
            if (!lastResult.success) {
                stagedIds.reversed().forEach { id ->
                    val entry = entries[id]
                    val activity = entry?.activity?.get()
                    if (entry?.pendingLaunch == true && activity == null) {
                        cancelledLaunches += id
                    }
                    removeRecord(id, "reset", null, publishChange = false)
                    activity?.finish()
                }
                return lastResult
            }
            lastResult.entryId?.let(stagedIds::add)
        }

        oldEntries.reversed().forEach { id ->
            val activity = entries[id]?.activity?.get()
            removeRecord(id, "reset", null, publishChange = false)
            activity?.finish()
        }
        var previousId: String? = null
        stagedIds.forEach { id ->
            entries[id]?.returnToEntryId = previousId
            previousId = id
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
        return SparklingNavigationResult(
            false,
            "Android container prefetch is not implemented",
        )
    }

    @Synchronized
    fun syncOwnLocation(
        entryId: String?,
        path: String,
        search: Map<String, String>,
    ): SparklingNavigationResult {
        val id = entryId
            ?: return SparklingNavigationResult(false, "Source entry is required")
        val entry = entries[id]
            ?: return SparklingNavigationResult(false, "Unknown source entry: $id")
        if (entry.path == path && entry.search == search) {
            return SparklingNavigationResult(true, "ok", id)
        }
        entry.path = path
        entry.search = search.toMap()
        publish("replace")
        return SparklingNavigationResult(true, "ok", id)
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
        publicationQueue.addLast(payload)
        if (isPublishing) return

        isPublishing = true
        try {
            while (publicationQueue.isNotEmpty()) {
                val next = publicationQueue.removeFirst()
                KitViewManager.getKitViews().values.forEach { kitView ->
                    runCatching {
                        kitView.sendEventByJSON(STACK_CHANGED_EVENT, next)
                    }
                }
            }
        } finally {
            isPublishing = false
        }
    }

    private fun targetFromScheme(scheme: String): SparklingNavigationTarget {
        val query: MutableMap<String, String> =
            runCatching {
                val uri = Uri.parse(scheme)
                if (!uri.isHierarchical) {
                    mutableMapOf<String, String>()
                } else {
                    uri.queryParameterNames
                        .associateWith { uri.getQueryParameter(it).orEmpty() }
                        .toMutableMap()
                }
            }.getOrElse { mutableMapOf() }
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

    private fun removeRecord(
        id: String,
        reason: String,
        resultValue: Any?,
        publishChange: Boolean,
    ) {
        val index = orderedIds.indexOf(id)
        val removedEntry = entries[id]
        if (index < 0 || removedEntry == null) return
        entries.remove(id)
        orderedIds.removeAt(index)
        pendingReasons.remove(id)
        if (publishChange) {
            val parentId = removedEntry.returnToEntryId?.takeIf(entries::containsKey)
            val result =
                if (parentId != null && resultValue != null) {
                    mapOf(
                        "forEntryId" to parentId,
                        "fromEntryId" to id,
                        "value" to resultValue,
                    )
                } else {
                    null
                }
            publish(reason, result)
        }
    }
}
