// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

@objc(StackMethod)
public class StackMethod: PipeMethod {
    public override var methodName: String {
        return "router.stack"
    }

    public override class func methodName() -> String {
        return "router.stack"
    }

    @objc public override var paramsModelClass: AnyClass {
        return StackMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return StackMethodResultModel.self
    }
}

@objc(StackMethodParamModel)
public class StackMethodParamModel: SPKMethodModel {
    public override class func requiredKeyPaths() -> Set<String>? {
        return ["command"]
    }

    @objc public var command: String?
    @objc public var path: String?
    @objc public var search: NSDictionary?
    @objc public var bundle: String?
    @objc public var scheme: String?
    @objc public var presentation: String?
    @objc public var entryId: String?
    @objc public var entries: NSArray?
    @objc public var result: Any?
    @objc public var animated: Bool = true
    @objc public var usePrefetched: Bool = false

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "command": "command",
            "path": "path",
            "search": "search",
            "bundle": "bundle",
            "scheme": "scheme",
            "presentation": "presentation",
            "entryId": "entryId",
            "entries": "entries",
            "result": "result",
            "animated": "animated",
            "usePrefetched": "usePrefetched",
        ]
    }
}

@objc(StackMethodResultModel)
public class StackMethodResultModel: SPKMethodModel {
    @objc public var entryId: String?
    @objc public var state: NSDictionary?

    public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "entryId": "entryId",
            "state": "state",
        ]
    }
}
