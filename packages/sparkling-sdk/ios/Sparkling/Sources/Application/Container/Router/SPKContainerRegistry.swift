// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import UIKit

/// Weak-reference registry mapping `containerID` → live container instances.
///
/// Required by stack protocol `popTo(entryId)` and result routing. Also fixes
/// the existing `close({ containerID })` path that currently ignores the ID
/// on both platforms (RFC appendix A.1).
@objcMembers
public final class SPKContainerRegistry: NSObject {
    public static let shared = SPKContainerRegistry()

    private let lock = NSLock()
    private var storage: [String: WeakBox] = [:]

    private final class WeakBox {
        weak var value: (UIViewController & SPKContainerProtocol)?
        init(_ value: UIViewController & SPKContainerProtocol) {
            self.value = value
        }
    }

    public func register(_ container: UIViewController & SPKContainerProtocol) {
        let id = container.containerID
        guard !id.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }
        storage[id] = WeakBox(container)
        compactLocked()
    }

    public func unregister(containerID: String) {
        lock.lock()
        defer { lock.unlock() }
        storage.removeValue(forKey: containerID)
    }

    public func container(forID containerID: String) -> (UIViewController & SPKContainerProtocol)? {
        lock.lock()
        defer { lock.unlock() }
        compactLocked()
        return storage[containerID]?.value
    }

    public func allContainerIDs() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        compactLocked()
        return Array(storage.keys)
    }

    private func compactLocked() {
        storage = storage.filter { $0.value.value != nil }
    }
}
