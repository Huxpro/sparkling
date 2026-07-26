// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import UIKit

/// Weak container lookup used by URL-first navigation and targeted close.
public final class SPKContainerRegistry {
    public static let shared = SPKContainerRegistry()

    private let containers = NSMapTable<NSString, SPKViewController>(
        keyOptions: .strongMemory,
        valueOptions: .weakMemory
    )
    private let lock = NSRecursiveLock()

    private init() {}

    public func register(_ container: SPKViewController) {
        guard !container.containerID.isEmpty else {
            return
        }
        lock.lock()
        containers.setObject(container, forKey: container.containerID as NSString)
        lock.unlock()
    }

    public func unregister(containerID: String) {
        lock.lock()
        containers.removeObject(forKey: containerID as NSString)
        lock.unlock()
    }

    public func container(for containerID: String) -> SPKViewController? {
        lock.lock()
        defer { lock.unlock() }
        return containers.object(forKey: containerID as NSString)
    }

    public func allContainers() -> [SPKViewController] {
        lock.lock()
        defer { lock.unlock() }
        return containers.objectEnumerator()?.allObjects.compactMap {
            $0 as? SPKViewController
        } ?? []
    }
}
