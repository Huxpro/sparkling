// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

private func resolveStackService() -> StackRouterService? {
    DIProviderRegistry.provider.pipeShared().resolve(StackRouterService.self)
}

private func dispatchStack(
    completionHandler: PipeMethod.CompletionHandlerProtocol,
    body: (StackRouterService, @escaping PipeMethod.CompletionBlock) -> Void
) {
    guard let service = resolveStackService() else {
        let status = MethodStatus.notImplemented(message: "StackRouterService is not registered")
        completionHandler.handleCompletion(status: status, result: nil)
        return
    }
    body(service) { status, result in
        completionHandler.handleCompletion(status: status, result: result)
    }
}

@objc(StackPushMethod)
public class StackPushMethod: PipeMethod {
    public override var methodName: String { "router.stack.push" }
    public override class func methodName() -> String { "router.stack.push" }
    @objc public override var paramsModelClass: AnyClass { StackPushParamModel.self }
    @objc public override var resultModelClass: AnyClass { StackNavResultModel.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackPushParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.push(withParams: params, completion: completion)
        }
    }
}

@objc(StackPopMethod)
public class StackPopMethod: PipeMethod {
    public override var methodName: String { "router.stack.pop" }
    public override class func methodName() -> String { "router.stack.pop" }
    @objc public override var paramsModelClass: AnyClass { StackPopParamModel.self }
    @objc public override var resultModelClass: AnyClass { StackNavResultModel.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackPopParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.pop(withParams: params, completion: completion)
        }
    }
}

@objc(StackPopToMethod)
public class StackPopToMethod: PipeMethod {
    public override var methodName: String { "router.stack.popTo" }
    public override class func methodName() -> String { "router.stack.popTo" }
    @objc public override var paramsModelClass: AnyClass { StackPopToParamModel.self }
    @objc public override var resultModelClass: AnyClass { StackNavResultModel.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackPopToParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.popTo(withParams: params, completion: completion)
        }
    }
}

@objc(StackReplaceMethod)
public class StackReplaceMethod: PipeMethod {
    public override var methodName: String { "router.stack.replace" }
    public override class func methodName() -> String { "router.stack.replace" }
    @objc public override var paramsModelClass: AnyClass { StackReplaceParamModel.self }
    @objc public override var resultModelClass: AnyClass { StackNavResultModel.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackReplaceParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.replace(withParams: params, completion: completion)
        }
    }
}

@objc(StackResetMethod)
public class StackResetMethod: PipeMethod {
    public override var methodName: String { "router.stack.reset" }
    public override class func methodName() -> String { "router.stack.reset" }
    @objc public override var paramsModelClass: AnyClass { StackResetParamModel.self }
    @objc public override var resultModelClass: AnyClass { StackNavResultModel.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackResetParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.reset(withParams: params, completion: completion)
        }
    }
}

@objc(StackGetStateMethod)
public class StackGetStateMethod: PipeMethod {
    public override var methodName: String { "router.stack.getState" }
    public override class func methodName() -> String { "router.stack.getState" }
    @objc public override var paramsModelClass: AnyClass { StackGetStateParamModel.self }
    @objc public override var resultModelClass: AnyClass { StackStateResultModel.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackGetStateParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.getState(withParams: params, completion: completion)
        }
    }
}

@objc(StackPrefetchMethod)
public class StackPrefetchMethod: PipeMethod {
    public override var methodName: String { "router.stack.prefetch" }
    public override class func methodName() -> String { "router.stack.prefetch" }
    @objc public override var paramsModelClass: AnyClass { StackPrefetchParamModel.self }
    @objc public override var resultModelClass: AnyClass { EmptyMethodModelClass.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackPrefetchParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.prefetch(withParams: params, completion: completion)
        }
    }
}

@objc(StackSyncOwnLocationMethod)
public class StackSyncOwnLocationMethod: PipeMethod {
    public override var methodName: String { "router.stack.syncOwnLocation" }
    public override class func methodName() -> String { "router.stack.syncOwnLocation" }
    @objc public override var paramsModelClass: AnyClass { StackSyncOwnLocationParamModel.self }
    @objc public override var resultModelClass: AnyClass { EmptyMethodModelClass.self }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? StackSyncOwnLocationParamModel else {
            completionHandler.handleCompletion(status: .invalidParameter(message: "Invalid parameter model type"), result: nil)
            return
        }
        dispatchStack(completionHandler: completionHandler) { service, completion in
            service.syncOwnLocation(withParams: params, completion: completion)
        }
    }
}
