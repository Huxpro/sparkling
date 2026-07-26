// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

extension StackMethod {
    @objc public override func call(
        withParamModel paramModel: Any,
        completionHandler: CompletionHandlerProtocol
    ) {
        guard let params = paramModel as? StackMethodParamModel else {
            completionHandler.handleCompletion(
                status: .invalidParameter(message: "Invalid parameter model type"),
                result: nil
            )
            return
        }
        guard let command = params.command, !command.isEmpty else {
            completionHandler.handleCompletion(
                status: .invalidParameter(message: "command must be a non-empty string"),
                result: nil
            )
            return
        }
        guard let service = DIProviderRegistry.provider.pipeShared().resolve(
            RouterStackService.self
        ) else {
            handleNotImplemented { status, result in
                completionHandler.handleCompletion(status: status, result: result)
            }
            return
        }

        service.performStackCommand(withParams: params) { status, result in
            completionHandler.handleCompletion(status: status, result: result)
        }
    }
}
