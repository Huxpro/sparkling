// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import UIKit

/// Minimal native stack state for the hard-navigation protocol (S4 skeleton).
///
/// Tracks ordered container entries, broadcasts `sparklingStackChanged`, and
/// uses `SPKContainerRegistry` for id → instance lookup. Full push/pop wiring
/// into `SPKRouter` / modal present is completed as hosts adopt `StackRouterService`.
@objcMembers
public final class SPKStackCoordinator: NSObject {
    public static let shared = SPKStackCoordinator()

    public struct Entry {
        public let id: String
        public var path: String
        public var search: [String: String]
        public var bundle: String
        public var presentation: String

        public init(id: String, path: String, search: [String: String], bundle: String, presentation: String) {
            self.id = id
            self.path = path
            self.search = search
            self.bundle = bundle
            self.presentation = presentation
        }

        public func asDictionary() -> [String: Any] {
            [
                "id": id,
                "path": path,
                "search": search,
                "bundle": bundle,
                "presentation": presentation,
            ]
        }
    }

    private let lock = NSLock()
    private var version: Int = 0
    private var entries: [Entry] = []

    public func currentState() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return [
            "version": version,
            "entries": entries.map { $0.asDictionary() },
        ]
    }

    public func append(_ entry: Entry, reason: String = "push") {
        lock.lock()
        entries.append(entry)
        version += 1
        let payload = snapshotLocked(reason: reason)
        lock.unlock()
        broadcast(payload)
    }

    @discardableResult
    public func pop(reason: String = "pop") -> Entry? {
        lock.lock()
        guard entries.count > 0 else {
            lock.unlock()
            return nil
        }
        let removed = entries.removeLast()
        version += 1
        let payload = snapshotLocked(reason: reason)
        lock.unlock()
        broadcast(payload)
        return removed
    }

    public func syncOwnLocation(containerID: String, path: String, search: [String: String]) {
        lock.lock()
        guard let index = entries.firstIndex(where: { $0.id == containerID }) else {
            lock.unlock()
            return
        }
        entries[index].path = path
        entries[index].search = search
        version += 1
        let payload = snapshotLocked(reason: "sync")
        lock.unlock()
        broadcast(payload)
    }

    public func noteUserBack(containerID: String, fromGesture: Bool) {
        lock.lock()
        if let index = entries.firstIndex(where: { $0.id == containerID }) {
            entries.removeSubrange(index...)
        } else if !entries.isEmpty {
            entries.removeLast()
        }
        version += 1
        let reason = fromGesture ? "user-back-gesture" : "user-back-button"
        let payload = snapshotLocked(reason: reason)
        lock.unlock()
        broadcast(payload)
    }

    private func snapshotLocked(reason: String) -> [String: Any] {
        [
            "state": [
                "version": version,
                "entries": entries.map { $0.asDictionary() },
            ],
            "reason": reason,
        ]
    }

    private func broadcast(_ payload: [String: Any]) {
        DispatchQueue.main.async {
            for id in SPKContainerRegistry.shared.allContainerIDs() {
                guard let container = SPKContainerRegistry.shared.container(forID: id) else { continue }
                container.send(event: SPKEvent.Stack.changed, params: payload, callback: nil)
            }
        }
    }
}
