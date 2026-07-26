// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import UIKit

public enum SPKStackChangeReason: String {
    case push
    case pop
    case replace
    case reset
    case userBackGesture = "user-back-gesture"
    case userBackButton = "user-back-button"
    case system
}

public struct SPKNavigationTarget {
    public var path: String
    public var search: [String: String]
    public var bundle: String
    public var scheme: String
    public var presentation: String

    public init(
        path: String,
        search: [String: String] = [:],
        bundle: String,
        scheme: String,
        presentation: String = "push"
    ) {
        self.path = path
        self.search = search
        self.bundle = bundle
        self.scheme = scheme
        self.presentation = presentation == "modal" ? "modal" : "push"
    }

    static func from(urlString: String) -> SPKNavigationTarget {
        guard let components = URLComponents(string: urlString) else {
            return SPKNavigationTarget(
                path: "/",
                bundle: "",
                scheme: urlString
            )
        }
        var query: [String: String] = [:]
        components.queryItems?.forEach { item in
            if let value = item.value {
                query[item.name] = value
            }
        }
        let path = query.removeValue(forKey: "__path") ?? "/"
        let bundle = query.removeValue(forKey: "bundle") ?? ""
        query.removeValue(forKey: "url")
        return SPKNavigationTarget(
            path: path,
            search: query,
            bundle: bundle,
            scheme: urlString
        )
    }
}

public struct SPKNavigationResult {
    public var success: Bool
    public var message: String
    public var entryId: String?

    public init(success: Bool, message: String, entryId: String? = nil) {
        self.success = success
        self.message = message
        self.entryId = entryId
    }
}

private struct SPKStackEntryRecord {
    var id: String
    var path: String
    var search: [String: String]
    var bundle: String
    var presentation: String
    var returnToEntryId: String?

    var dictionary: [String: Any] {
        return [
            "id": id,
            "path": path,
            "search": search,
            "bundle": bundle,
            "presentation": presentation,
        ]
    }
}

private struct SPKPrefetchedContainer {
    var container: SPKViewController
    var expiresAt: Date
}

/// Native source of truth for hard-container navigation.
public final class SPKNavigationStack {
    public static let shared = SPKNavigationStack()
    public static let changedEvent = "router.stackchanged"

    private var version = 0
    private var orderedEntryIds: [String] = []
    private var entries: [String: SPKStackEntryRecord] = [:]
    private var prefetched: [String: SPKPrefetchedContainer] = [:]
    private var prefetchTimer: Timer?
    private var publicationQueue: [[String: Any]] = []
    private var isPublishing = false
    private let prefetchTTL: TimeInterval = 30

    private init() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.removeAllPrefetches()
        }
    }

    public var stateDictionary: [String: Any] {
        return [
            "version": version,
            "entries": orderedEntryIds.compactMap { entries[$0]?.dictionary },
        ]
    }

    @discardableResult
    public func registerIfNeeded(_ container: SPKViewController) -> String? {
        guard !container.containerID.isEmpty else {
            return nil
        }
        let id = container.containerID
        SPKContainerRegistry.shared.register(container)
        guard entries[id] == nil else {
            return id
        }

        let target = SPKNavigationTarget.from(
            urlString: container.context?.originURL
                ?? container.originURL?.absoluteString
                ?? ""
        )
        let navigationController = container.navigationController
        let presentation =
            navigationController?.presentingViewController != nil
                && navigationController?.viewControllers.first === container
            ? "modal"
            : "push"
        entries[id] = SPKStackEntryRecord(
            id: id,
            path: target.path,
            search: target.search,
            bundle: target.bundle,
            presentation: presentation,
            returnToEntryId: orderedEntryIds.last
        )
        orderedEntryIds.append(id)
        publish(reason: .system)
        return id
    }

    public func push(
        _ target: SPKNavigationTarget,
        context: SPKContext?,
        animated: Bool = true,
        usePrefetched: Bool = false,
        sourceEntryId: String? = nil
    ) -> (SPKViewController?, SPKNavigationResult) {
        return push(
            target,
            context: context,
            animated: animated,
            usePrefetched: usePrefetched,
            sourceEntryId: sourceEntryId,
            publishChange: true
        )
    }

    public func pop(
        entryId: String? = nil,
        result: Any? = nil,
        animated: Bool = true,
        reason: SPKStackChangeReason = .pop
    ) -> SPKNavigationResult {
        return pop(
            entryId: entryId,
            result: result,
            animated: animated,
            reason: reason,
            publishChange: true
        )
    }

    public func popTo(entryId: String, animated: Bool = true) -> SPKNavigationResult {
        guard let targetIndex = orderedEntryIds.firstIndex(of: entryId) else {
            return SPKNavigationResult(success: false, message: "Unknown entry: \(entryId)")
        }
        let removed = Array(orderedEntryIds.suffix(from: targetIndex + 1)).reversed()
        guard !removed.isEmpty else {
            return SPKNavigationResult(success: true, message: "ok", entryId: entryId)
        }
        for id in removed {
            let response = pop(
                entryId: id,
                result: nil,
                animated: animated,
                reason: .pop,
                publishChange: false
            )
            if !response.success {
                return response
            }
        }
        publish(reason: .pop)
        return SPKNavigationResult(success: true, message: "ok", entryId: entryId)
    }

    public func replace(
        entryId: String?,
        target: SPKNavigationTarget,
        context: SPKContext?,
        animated: Bool = true
    ) -> SPKNavigationResult {
        guard let sourceId = entryId ?? orderedEntryIds.last,
            let sourceIndex = orderedEntryIds.firstIndex(of: sourceId),
            let sourceEntry = entries[sourceId],
            let source = SPKContainerRegistry.shared.container(for: sourceId)
        else {
            return SPKNavigationResult(success: false, message: "Source container not found")
        }
        guard orderedEntryIds.last == sourceId else {
            return SPKNavigationResult(
                success: false,
                message: "Only the top entry can be replaced"
            )
        }
        guard sourceEntry.presentation == target.presentation else {
            return SPKNavigationResult(
                success: false,
                message: "Changing presentation during replace is not supported"
            )
        }
        guard let replacement = createContainer(target, context: context) else {
            return SPKNavigationResult(success: false, message: "Unable to create container")
        }
        let replacementId = replacement.containerID
        guard !replacementId.isEmpty, entries[replacementId] == nil else {
            return SPKNavigationResult(success: false, message: "Container ID is unavailable")
        }

        guard let navigationController = source.navigationController,
            let controllerIndex = navigationController.viewControllers.firstIndex(
                where: { $0 === source }
            )
        else {
            return SPKNavigationResult(
                success: false,
                message: "Source navigation controller not found"
            )
        }
        var controllers = navigationController.viewControllers
        controllers[controllerIndex] = replacement
        navigationController.setViewControllers(controllers, animated: animated)

        removeRecord(sourceId)
        SPKContainerRegistry.shared.register(replacement)
        entries[replacementId] = SPKStackEntryRecord(
            id: replacementId,
            path: target.path,
            search: target.search,
            bundle: target.bundle,
            presentation: target.presentation,
            returnToEntryId: sourceEntry.returnToEntryId
        )
        orderedEntryIds.insert(replacementId, at: sourceIndex)
        publish(reason: .replace)
        return SPKNavigationResult(
            success: true,
            message: "ok",
            entryId: replacementId
        )
    }

    public func reset(
        targets: [SPKNavigationTarget],
        context: SPKContext?,
        animated: Bool = false
    ) -> SPKNavigationResult {
        guard !targets.isEmpty else {
            return SPKNavigationResult(success: false, message: "reset requires entries")
        }
        guard targets.allSatisfy({ $0.presentation == "push" }) else {
            return SPKNavigationResult(
                success: false,
                message: "Atomic reset currently supports push presentation only"
            )
        }

        var prepared: [(SPKNavigationTarget, SPKViewController)] = []
        var preparedIds = Set<String>()
        for target in targets {
            guard let container = createContainer(target, context: context) else {
                return SPKNavigationResult(
                    success: false,
                    message: "Unable to create reset container"
                )
            }
            let id = container.containerID
            guard !id.isEmpty, entries[id] == nil, preparedIds.insert(id).inserted else {
                return SPKNavigationResult(
                    success: false,
                    message: "Reset container ID is unavailable"
                )
            }
            prepared.append((target, container))
        }

        let oldIds = orderedEntryIds
        let oldContainers = oldIds.compactMap {
            SPKContainerRegistry.shared.container(for: $0)
        }
        let baseNavigationController =
            oldContainers.first(where: {
                entries[$0.containerID]?.presentation == "push"
            })?.navigationController
            ?? SPKResponder.topViewController?.navigationController
            ?? (SPKResponder.topViewController as? UINavigationController)
        guard let baseNavigationController = baseNavigationController else {
            return SPKNavigationResult(
                success: false,
                message: "No navigation host available for reset"
            )
        }

        let oldContainerIds = Set(oldIds)
        let preserved = baseNavigationController.viewControllers.filter { controller in
            guard let sparkling = controller as? SPKViewController else {
                return true
            }
            return !oldContainerIds.contains(sparkling.containerID)
        }
        let modalNavigationControllers = oldContainers.compactMap { container -> UINavigationController? in
            guard let navigationController = container.navigationController,
                navigationController.presentingViewController != nil,
                navigationController.viewControllers.first === container
            else {
                return nil
            }
            return navigationController
        }
        var dismissed = Set<ObjectIdentifier>()
        modalNavigationControllers.reversed().forEach { navigationController in
            if dismissed.insert(ObjectIdentifier(navigationController)).inserted {
                navigationController.dismiss(animated: false)
            }
        }
        baseNavigationController.setViewControllers(
            preserved + prepared.map { $0.1 },
            animated: animated
        )

        oldIds.forEach(removeRecord)
        var previousId: String?
        prepared.forEach { target, container in
            let id = container.containerID
            SPKContainerRegistry.shared.register(container)
            entries[id] = SPKStackEntryRecord(
                id: id,
                path: target.path,
                search: target.search,
                bundle: target.bundle,
                presentation: target.presentation,
                returnToEntryId: previousId
            )
            orderedEntryIds.append(id)
            previousId = id
        }
        publish(reason: .reset)
        return SPKNavigationResult(success: true, message: "ok", entryId: previousId)
    }

    public func prefetch(
        _ target: SPKNavigationTarget,
        context: SPKContext?
    ) -> SPKNavigationResult {
        purgeExpiredPrefetches()
        guard !target.scheme.isEmpty else {
            return SPKNavigationResult(success: false, message: "scheme is required")
        }
        guard let container = createContainer(target, context: context),
            !container.containerID.isEmpty
        else {
            return SPKNavigationResult(success: false, message: "Unable to create container")
        }
        prefetched[target.scheme] = SPKPrefetchedContainer(
            container: container,
            expiresAt: Date().addingTimeInterval(prefetchTTL)
        )
        schedulePrefetchPurge()
        return SPKNavigationResult(
            success: true,
            message: "ok",
            entryId: container.containerID
        )
    }

    public func syncOwnLocation(
        entryId: String?,
        path: String,
        search: [String: String]
    ) -> SPKNavigationResult {
        guard let id = entryId, var entry = entries[id] else {
            return SPKNavigationResult(success: false, message: "Source container not found")
        }
        guard entry.path != path || entry.search != search else {
            return SPKNavigationResult(success: true, message: "ok", entryId: id)
        }
        entry.path = path
        entry.search = search
        entries[id] = entry
        publish(reason: .replace)
        return SPKNavigationResult(success: true, message: "ok", entryId: id)
    }

    public func didRemove(
        containerID: String,
        reason: SPKStackChangeReason,
        removesNavigationController: Bool = false
    ) {
        guard entries[containerID] != nil else {
            return
        }
        let removedIds = SPKContainerRegistry.shared.container(for: containerID)
            .map {
                removalIds(
                    for: $0,
                    requestedId: containerID,
                    forceNavigationController: removesNavigationController
                )
            }
            ?? [containerID]
        removedIds.forEach(removeRecord)
        publish(reason: reason)
    }

    private func createContainer(
        _ target: SPKNavigationTarget,
        context: SPKContext?
    ) -> SPKViewController? {
        guard !target.scheme.isEmpty,
            let container = SPKRouter.create(
                withURL: target.scheme,
                context: context
            ) as? SPKViewController
        else {
            return nil
        }
        container.loadViewIfNeeded()
        return container
    }

    private func push(
        _ target: SPKNavigationTarget,
        context: SPKContext?,
        animated: Bool,
        usePrefetched: Bool,
        sourceEntryId: String?,
        publishChange: Bool
    ) -> (SPKViewController?, SPKNavigationResult) {
        purgeExpiredPrefetches()
        guard !target.scheme.isEmpty else {
            return (nil, SPKNavigationResult(success: false, message: "scheme is required"))
        }
        if let sourceEntryId = sourceEntryId {
            guard entries[sourceEntryId] != nil else {
                return (
                    nil,
                    SPKNavigationResult(
                        success: false,
                        message: "Unknown source entry: \(sourceEntryId)"
                    )
                )
            }
            guard orderedEntryIds.last == sourceEntryId else {
                return (
                    nil,
                    SPKNavigationResult(
                        success: false,
                        message: "Source entry is not on top: \(sourceEntryId)"
                    )
                )
            }
        }

        let container: SPKViewController
        if usePrefetched, let cached = prefetched.removeValue(forKey: target.scheme) {
            container = cached.container
        } else {
            guard let created = createContainer(target, context: context) else {
                return (
                    nil,
                    SPKNavigationResult(success: false, message: "Unable to create container")
                )
            }
            container = created
        }

        let id = container.containerID
        guard !id.isEmpty, entries[id] == nil else {
            return (
                nil,
                SPKNavigationResult(success: false, message: "Container ID is unavailable")
            )
        }

        guard present(container, presentation: target.presentation, animated: animated) else {
            return (
                nil,
                SPKNavigationResult(success: false, message: "No navigation host available")
            )
        }
        SPKContainerRegistry.shared.register(container)
        entries[id] = SPKStackEntryRecord(
            id: id,
            path: target.path,
            search: target.search,
            bundle: target.bundle,
            presentation: target.presentation,
            returnToEntryId: sourceEntryId ?? orderedEntryIds.last
        )
        if !orderedEntryIds.contains(id) {
            orderedEntryIds.append(id)
        }
        if publishChange {
            publish(reason: .push)
        }
        return (
            container,
            SPKNavigationResult(success: true, message: "ok", entryId: id)
        )
    }

    private func pop(
        entryId: String?,
        result: Any?,
        animated: Bool,
        reason: SPKStackChangeReason,
        publishChange: Bool
    ) -> SPKNavigationResult {
        guard let id = entryId ?? orderedEntryIds.last,
            let entry = entries[id],
            let container = SPKContainerRegistry.shared.container(for: id)
        else {
            return SPKNavigationResult(success: false, message: "Container not found")
        }
        let removedIds = removalIds(for: container, requestedId: id)
        guard close(container, animated: animated) else {
            return SPKNavigationResult(success: false, message: "Unable to close container")
        }
        removedIds.forEach(removeRecord)
        if publishChange {
            let resultEvent: [String: Any]? = {
                guard let parentId = entry.returnToEntryId,
                    entries[parentId] != nil,
                    let result = result
                else {
                    return nil
                }
                return [
                    "forEntryId": parentId,
                    "fromEntryId": id,
                    "value": result,
                ]
            }()
            publish(reason: reason, result: resultEvent)
        }
        return SPKNavigationResult(success: true, message: "ok", entryId: id)
    }

    private func present(
        _ container: SPKViewController,
        presentation: String,
        animated: Bool
    ) -> Bool {
        guard let top = SPKResponder.topViewController else {
            return false
        }
        if presentation == "modal" {
            let navigationController = UINavigationController(rootViewController: container)
            top.present(navigationController, animated: animated)
            return true
        }
        if let navigationController = top.navigationController
            ?? top.children.last(where: { $0 is UINavigationController }) as? UINavigationController
        {
            navigationController.pushViewController(container, animated: animated)
            return true
        }
        return false
    }

    private func close(_ container: SPKViewController, animated: Bool) -> Bool {
        if let navigationController = container.navigationController {
            if navigationController.viewControllers.first === container,
                navigationController.presentingViewController != nil
            {
                navigationController.dismiss(animated: animated)
                return true
            }
            if navigationController.viewControllers.contains(container) {
                if navigationController.topViewController === container {
                    guard navigationController.popViewController(animated: animated) === container
                    else {
                        return false
                    }
                } else {
                    navigationController.setViewControllers(
                        navigationController.viewControllers.filter { $0 !== container },
                        animated: animated
                    )
                }
                return true
            }
        }
        if container.presentingViewController != nil {
            container.dismiss(animated: animated)
            return true
        }
        return false
    }

    private func removalIds(
        for container: SPKViewController,
        requestedId: String,
        forceNavigationController: Bool = false
    ) -> [String] {
        guard let navigationController = container.navigationController else {
            return [requestedId]
        }
        let dismissesNavigationController =
            forceNavigationController
            || navigationController.isBeingDismissed
            || (
                navigationController.viewControllers.first === container
                    && navigationController.presentingViewController != nil
            )
        guard dismissesNavigationController else {
            return [requestedId]
        }
        return orderedEntryIds.filter { id in
            SPKContainerRegistry.shared.container(for: id)?.navigationController
                === navigationController
        }
    }

    private func removeRecord(_ id: String) {
        orderedEntryIds.removeAll { $0 == id }
        entries.removeValue(forKey: id)
        SPKContainerRegistry.shared.unregister(containerID: id)
    }

    private func publish(
        reason: SPKStackChangeReason,
        result: [String: Any]? = nil
    ) {
        version += 1
        var event: [String: Any] = [
            "state": stateDictionary,
            "reason": reason.rawValue,
        ]
        if let result = result {
            event["result"] = result
        }
        publicationQueue.append(event)
        guard !isPublishing else {
            return
        }
        isPublishing = true
        while !publicationQueue.isEmpty {
            let nextEvent = publicationQueue.removeFirst()
            SPKContainerRegistry.shared.allContainers().forEach { container in
                container.send(
                    event: Self.changedEvent,
                    params: nextEvent,
                    callback: nil
                )
            }
        }
        isPublishing = false
    }

    private func purgeExpiredPrefetches() {
        let now = Date()
        let expired = prefetched.filter { $0.value.expiresAt <= now }
        expired.forEach { key, _ in
            prefetched.removeValue(forKey: key)
        }
        schedulePrefetchPurge()
    }

    private func schedulePrefetchPurge() {
        prefetchTimer?.invalidate()
        guard let nextExpiry = prefetched.values.map(\.expiresAt).min() else {
            prefetchTimer = nil
            return
        }
        prefetchTimer = Timer.scheduledTimer(
            withTimeInterval: max(nextExpiry.timeIntervalSinceNow, 0.1),
            repeats: false
        ) { [weak self] _ in
            self?.purgeExpiredPrefetches()
        }
    }

    private func removeAllPrefetches() {
        prefetchTimer?.invalidate()
        prefetchTimer = nil
        prefetched.removeAll()
    }
}
