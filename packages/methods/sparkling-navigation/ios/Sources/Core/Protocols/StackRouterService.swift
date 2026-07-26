// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

/// Optional host service implementing the hard-navigation stack protocol (RFC §4).
///
/// Hosts that only implement `RouterService` continue to work for open/close.
/// Stack methods resolve this protocol separately and return `.notImplemented`
/// until a host registers an implementation (iOS-first S4 path).
public protocol StackRouterService {
    func push(withParams params: StackPushParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func pop(withParams params: StackPopParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func popTo(withParams params: StackPopToParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func replace(withParams params: StackReplaceParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func reset(withParams params: StackResetParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func getState(withParams params: StackGetStateParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func prefetch(withParams params: StackPrefetchParamModel, completion: @escaping PipeMethod.CompletionBlock)
    func syncOwnLocation(withParams params: StackSyncOwnLocationParamModel, completion: @escaping PipeMethod.CompletionBlock)
}
