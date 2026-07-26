// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import Sparkling
import SparklingMethod
import Sparkling_Router

extension RouterServiceImpl: RouterStackService {
    func performStackCommand(
        withParams params: Sparkling_Router.StackMethodParamModel,
        completion: @escaping SparklingMethod.PipeMethod.CompletionBlock
    ) {
        DispatchQueue.main.async {
            let stack = SPKNavigationStack.shared
            let sourceID = params.context?.pipeContainer?.spk_containerID
            let resultModel = StackMethodResultModel()

            func finish(_ result: SPKNavigationResult) {
                resultModel.entryId = result.entryId
                resultModel.state = stack.stateDictionary as NSDictionary
                if result.success {
                    completion(.succeeded(), resultModel)
                } else {
                    completion(.failed(message: result.message), nil)
                }
            }

            switch params.command {
            case "getState":
                resultModel.state = stack.stateDictionary as NSDictionary
                completion(.succeeded(), resultModel)
            case "push":
                guard let target = self.stackTarget(from: params) else {
                    completion(.invalidParameter(message: "push requires scheme and path"), nil)
                    return
                }
                let (_, result) = stack.push(
                    target,
                    context: SPKContext(),
                    animated: params.animated,
                    usePrefetched: params.usePrefetched
                )
                finish(result)
            case "pop":
                finish(stack.pop(
                    entryId: sourceID,
                    result: params.result,
                    animated: params.animated
                ))
            case "popTo":
                guard let entryId = params.entryId, !entryId.isEmpty else {
                    completion(.invalidParameter(message: "popTo requires entryId"), nil)
                    return
                }
                finish(stack.popTo(entryId: entryId, animated: params.animated))
            case "replace":
                guard let target = self.stackTarget(from: params) else {
                    completion(.invalidParameter(message: "replace requires scheme and path"), nil)
                    return
                }
                finish(stack.replace(
                    entryId: sourceID,
                    target: target,
                    context: SPKContext(),
                    animated: params.animated
                ))
            case "reset":
                let targets = (params.entries as? [[String: Any]] ?? []).compactMap {
                    self.stackTarget(from: $0)
                }
                finish(stack.reset(
                    targets: targets,
                    context: SPKContext(),
                    animated: params.animated
                ))
            case "prefetch":
                guard let target = self.stackTarget(from: params) else {
                    completion(.invalidParameter(message: "prefetch requires scheme and path"), nil)
                    return
                }
                finish(stack.prefetch(target, context: SPKContext()))
            case "syncOwnLocation":
                stack.syncOwnLocation(
                    entryId: sourceID,
                    path: params.path ?? "/",
                    search: self.stackStringDictionary(params.search)
                )
                finish(SPKNavigationResult(success: true, message: "ok", entryId: sourceID))
            default:
                completion(
                    .invalidParameter(message: "Unknown stack command: \(params.command ?? "")"),
                    nil
                )
            }
        }
    }

    private func stackTarget(
        from params: Sparkling_Router.StackMethodParamModel
    ) -> SPKNavigationTarget? {
        guard let scheme = params.scheme, !scheme.isEmpty,
            let path = params.path, !path.isEmpty
        else {
            return nil
        }
        return SPKNavigationTarget(
            path: path,
            search: stackStringDictionary(params.search),
            bundle: params.bundle ?? "",
            scheme: scheme,
            presentation: params.presentation ?? "push"
        )
    }

    private func stackTarget(from dictionary: [String: Any]) -> SPKNavigationTarget? {
        guard let scheme = dictionary["scheme"] as? String, !scheme.isEmpty,
            let path = dictionary["path"] as? String, !path.isEmpty
        else {
            return nil
        }
        return SPKNavigationTarget(
            path: path,
            search: stackStringDictionary(dictionary["search"] as? NSDictionary),
            bundle: dictionary["bundle"] as? String ?? "",
            scheme: scheme,
            presentation: dictionary["presentation"] as? String ?? "push"
        )
    }

    private func stackStringDictionary(
        _ dictionary: NSDictionary?
    ) -> [String: String] {
        var result: [String: String] = [:]
        dictionary?.forEach { key, value in
            result[String(describing: key)] = String(describing: value)
        }
        return result
    }
}
