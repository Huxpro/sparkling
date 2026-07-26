// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

@objc(StackNavResultModel)
public class StackNavResultModel: SPKMethodModel {
    @objc public var entryId: String?

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return ["entryId": "entryId"]
    }
}

@objc(StackPushParamModel)
public class StackPushParamModel: SPKMethodModel {
    @objc public var path: String?
    @objc public var search: NSDictionary?
    @objc public var presentation: String?
    @objc public var usePrefetched: Bool = false
    @objc public var animated: Bool = true

    public override class func requiredKeyPaths() -> Set<String>? {
        return ["path"]
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "path": "path",
            "search": "search",
            "presentation": "presentation",
            "usePrefetched": "usePrefetched",
            "animated": "animated",
        ]
    }
}

@objc(StackPopParamModel)
public class StackPopParamModel: SPKMethodModel {
    @objc public var result: Any?
    @objc public var animated: Bool = true

    public override class func requiredKeyPaths() -> Set<String>? {
        return []
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "result": "result",
            "animated": "animated",
        ]
    }
}

@objc(StackPopToParamModel)
public class StackPopToParamModel: SPKMethodModel {
    @objc public var entryId: String?
    @objc public var animated: Bool = true

    public override class func requiredKeyPaths() -> Set<String>? {
        return ["entryId"]
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "entryId": "entryId",
            "animated": "animated",
        ]
    }
}

@objc(StackReplaceParamModel)
public class StackReplaceParamModel: SPKMethodModel {
    @objc public var path: String?
    @objc public var search: NSDictionary?

    public override class func requiredKeyPaths() -> Set<String>? {
        return ["path"]
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "path": "path",
            "search": "search",
        ]
    }
}

@objc(StackResetParamModel)
public class StackResetParamModel: SPKMethodModel {
    @objc public var entries: NSArray?

    public override class func requiredKeyPaths() -> Set<String>? {
        return ["entries"]
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return ["entries": "entries"]
    }
}

@objc(StackGetStateParamModel)
public class StackGetStateParamModel: SPKMethodModel {
    public override class func requiredKeyPaths() -> Set<String>? {
        return []
    }
}

@objc(StackStateResultModel)
public class StackStateResultModel: SPKMethodModel {
    @objc public var version: NSNumber?
    @objc public var entries: NSArray?

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "version": "version",
            "entries": "entries",
        ]
    }
}

@objc(StackPrefetchParamModel)
public class StackPrefetchParamModel: SPKMethodModel {
    @objc public var path: String?
    @objc public var search: NSDictionary?

    public override class func requiredKeyPaths() -> Set<String>? {
        return ["path"]
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "path": "path",
            "search": "search",
        ]
    }
}

@objc(StackSyncOwnLocationParamModel)
public class StackSyncOwnLocationParamModel: SPKMethodModel {
    @objc public var path: String?
    @objc public var search: NSDictionary?

    public override class func requiredKeyPaths() -> Set<String>? {
        return ["path"]
    }

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "path": "path",
            "search": "search",
        ]
    }
}
