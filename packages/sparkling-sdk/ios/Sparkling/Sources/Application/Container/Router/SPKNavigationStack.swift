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
    private let prefetchTTL: TimeInterval = 30

    private init() {}

    public var stateDictionary: [String: Any] {
        purgeReleasedEntries()
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
        let presentation = container.navigationController?.presentingViewController != nil
            ? "modal"
            : "push"
        entries[id] = SPKStackEntryRecord(
            id: id,
            path: target.path,
            search: target.search,
            bundle: target.bundle,
            presentation: presentation
        )
        orderedEntryIds.append(id)
        publish(reason: .system)
        return id
    }

    public func push(
        _ target: SPKNavigationTarget,
        context: SPKContext?,
        animated: Bool = true,
        usePrefetched: Bool = false
    ) -> (SPKViewController?, SPKNavigationResult) {
        return push(
            target,
            context: context,
            animated: animated,
            usePrefetched: usePrefetched,
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
        for id in removed {
            let response = pop(
                entryId: id,
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
        let sourceId = entryId ?? orderedEntryIds.last
        if let sourceId = sourceId {
            let popped = pop(
                entryId: sourceId,
                animated: false,
                reason: .replace,
                publishChange: false
            )
            if !popped.success {
                return popped
            }
        }
        let (_, pushed) = push(
            target,
            context: context,
            animated: animated,
            usePrefetched: false,
            publishChange: false
        )
        if pushed.success {
            publish(reason: .replace)
        }
        return pushed
    }

    public func reset(
        targets: [SPKNavigationTarget],
        context: SPKContext?,
        animated: Bool = false
    ) -> SPKNavigationResult {
        for id in orderedEntryIds.reversed() {
            let response = pop(
                entryId: id,
                animated: false,
                reason: .reset,
                publishChange: false
            )
            if !response.success {
                return response
            }
        }

        var lastId: String?
        for target in targets {
            let (_, response) = push(
                target,
                context: context,
                animated: animated,
                usePrefetched: false,
                publishChange: false
            )
            if !response.success {
                return response
            }
            lastId = response.entryId
        }
        publish(reason: .reset)
        return SPKNavigationResult(success: true, message: "ok", entryId: lastId)
    }

    public func prefetch(
        _ target: SPKNavigationTarget,
        context: SPKContext?
    ) -> SPKNavigationResult {
        purgeExpiredPrefetches()
        guard !target.scheme.isEmpty else {
            return SPKNavigationResult(success: false, message: "scheme is required")
        }
        let container = SPKRouter.create(
            withURL: target.scheme,
            context: context
        ) as? SPKViewController
        guard let container = container else {
            return SPKNavigationResult(success: false, message: "Unable to create container")
        }
        container.loadViewIfNeeded()
        SPKContainerRegistry.shared.register(container)
        prefetched[target.scheme] = SPKPrefetchedContainer(
            container: container,
            expiresAt: Date().addingTimeInterval(prefetchTTL)
        )
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
    ) {
        guard let id = entryId ?? orderedEntryIds.last, var entry = entries[id] else {
            return
        }
        entry.path = path
        entry.search = search
        entries[id] = entry
        publish(reason: .replace)
    }

    public func didRemove(
        containerID: String,
        reason: SPKStackChangeReason
    ) {
        guard entries[containerID] != nil else {
            return
        }
        removeRecord(containerID)
        publish(reason: reason)
    }

    private func push(
        _ target: SPKNavigationTarget,
        context: SPKContext?,
        animated: Bool,
        usePrefetched: Bool,
        publishChange: Bool
    ) -> (SPKViewController?, SPKNavigationResult) {
        purgeExpiredPrefetches()
        guard !target.scheme.isEmpty else {
            return (nil, SPKNavigationResult(success: false, message: "scheme is required"))
        }

        let container: SPKViewController
        if usePrefetched, let cached = prefetched.removeValue(forKey: target.scheme) {
            container = cached.container
        } else {
            guard let created = SPKRouter.create(
                withURL: target.scheme,
                context: context
            ) as? SPKViewController else {
                return (
                    nil,
                    SPKNavigationResult(success: false, message: "Unable to create container")
                )
            }
            container = created
            container.loadViewIfNeeded()
        }

        guard present(container, presentation: target.presentation, animated: animated) else {
            return (
                nil,
                SPKNavigationResult(success: false, message: "No navigation host available")
            )
        }

        let id = container.containerID
        SPKContainerRegistry.shared.register(container)
        entries[id] = SPKStackEntryRecord(
            id: id,
            path: target.path,
            search: target.search,
            bundle: target.bundle,
            presentation: target.presentation
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
            let container = SPKContainerRegistry.shared.container(for: id)
        else {
            return SPKNavigationResult(success: false, message: "Container not found")
        }
        let parentId = orderedEntryIds.firstIndex(of: id).flatMap { index in
            index > 0 ? orderedEntryIds[index - 1] : nil
        }
        guard close(container, animated: animated) else {
            return SPKNavigationResult(success: false, message: "Unable to close container")
        }
        removeRecord(id)
        if publishChange {
            let resultEvent: [String: Any]? = {
                guard let parentId = parentId, let result = result else {
                    return nil
                }
                return ["forEntryId": parentId, "value": result]
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
                    navigationController.popViewController(animated: animated)
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
        SPKContainerRegistry.shared.allContainers().forEach { container in
            container.send(
                event: Self.changedEvent,
                params: event,
                callback: nil
            )
        }
    }

    private func purgeReleasedEntries() {
        let stale = orderedEntryIds.filter {
            SPKContainerRegistry.shared.container(for: $0) == nil
        }
        stale.forEach(removeRecord)
    }

    private func purgeExpiredPrefetches() {
        let now = Date()
        let expired = prefetched.filter { $0.value.expiresAt <= now }
        expired.forEach { key, value in
            SPKContainerRegistry.shared.unregister(
                containerID: value.container.containerID
            )
            prefetched.removeValue(forKey: key)
        }
    }
}
