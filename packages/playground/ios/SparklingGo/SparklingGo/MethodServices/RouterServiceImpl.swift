// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import Sparkling
import SparklingMethod
import Sparkling_Router
import UIKit

class RouterServiceImpl: RouterService, RouterStackService {
    func closeContainer(withParams params: Sparkling_Router.CloseMethodParamModel, completion: @escaping SparklingMethod.PipeMethod.CompletionBlock) {
        DispatchQueue.main.async {
            let success: Bool
            if let containerID = params.containerID, !containerID.isEmpty {
                success = SPKRouter.close(
                    containerID: containerID,
                    animated: params.animated
                )
            } else {
                success = SPKRouter.close(container: params.context?.pipeContainer)
            }
            if success {
                completion(.succeeded(), nil)
            } else {
                completion(.failed(message: "Unable to close the container"), nil)
            }
        }
    }

    func openScheme(withParams params: Sparkling_Router.OpenMethodParamModel, completion: @escaping SparklingMethod.PipeMethod.CompletionBlock) {
        let urlString = params.scheme
        let context = SPKContext()
        if let rawExtra = params.extra as? [String: Any] {
            var extra: [String: AnyHashable] = [:]
            for (key, value) in rawExtra {
                if let hashable = value as? AnyHashable {
                    extra[key] = hashable
                } else {
                    extra[key] = String(describing: value)
                }
            }
            context.extra = extra
        }

        DispatchQueue.main.async {
            func openWithRouter(completionHandler: ((Bool) -> Void)? = nil) {
                if let (_, success) = SPKRouter.open(
                    withURL: urlString,
                    context: context,
                    presentation: "push",
                    animated: params.animated
                ), success {
                    completionHandler?(true)
                    completion(.succeeded(), nil)
                } else {
                    completionHandler?(false)
                    completion(.failed(message: "Failed to open URL"), nil)
                }
            }

            if params.useSysBrowser == true {
                let success = SPKRouter.openInSystemBrowser(withURL: urlString)
                if success {
                    completion(.succeeded(), nil)
                } else {
                    completion(.failed(message: "Failed to open URL in system browser"), nil)
                }
            } else {
                if params.replace == true && params.replaceType == "alwaysCloseBeforeOpen" {
                    if !SPKRouter.close(container: params.context?.pipeContainer) {
                        print("Unable to close the container")
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        openWithRouter()
                    }
                } else if params.replace == true {
                    openWithRouter { success in
                        if params.replaceType == "alwaysCloseAfterOpen" || (params.replaceType == "onlyCloseAfterOpenSucceed" && success) {
                            if !SPKRouter.close(container: params.context?.pipeContainer) {
                                print("Unable to close the container")
                            }
                        }
                    }
                } else {
                    openWithRouter()
                }
            }
        }
    }

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
                guard let target = self.target(from: params) else {
                    completion(.invalidParameter(message: "push requires scheme and path"), nil)
                    return
                }
                let (_, result) = stack.push(
                    target,
                    context: SPKContext(),
                    animated: params.animated,
                    usePrefetched: params.usePrefetched,
                    sourceEntryId: sourceID
                )
                finish(result)
            case "pop":
                guard let sourceID = sourceID, !sourceID.isEmpty else {
                    completion(.invalidParameter(message: "pop requires a source container"), nil)
                    return
                }
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
                guard let sourceID = sourceID, !sourceID.isEmpty else {
                    completion(.invalidParameter(message: "replace requires a source container"), nil)
                    return
                }
                guard let target = self.target(from: params) else {
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
                guard let rawEntries = params.entries as? [[String: Any]],
                    !rawEntries.isEmpty
                else {
                    completion(.invalidParameter(message: "reset requires entries"), nil)
                    return
                }
                let targets = rawEntries.compactMap { self.target(from: $0) }
                guard targets.count == rawEntries.count else {
                    completion(.invalidParameter(message: "reset contains an invalid entry"), nil)
                    return
                }
                finish(stack.reset(
                    targets: targets,
                    context: SPKContext(),
                    animated: params.animated
                ))
            case "prefetch":
                guard let target = self.target(from: params) else {
                    completion(.invalidParameter(message: "prefetch requires scheme and path"), nil)
                    return
                }
                finish(stack.prefetch(target, context: SPKContext()))
            case "syncOwnLocation":
                guard let sourceID = sourceID, !sourceID.isEmpty else {
                    completion(
                        .invalidParameter(message: "syncOwnLocation requires a source container"),
                        nil
                    )
                    return
                }
                finish(stack.syncOwnLocation(
                    entryId: sourceID,
                    path: params.path ?? "/",
                    search: self.stringDictionary(params.search)
                ))
            default:
                completion(
                    .invalidParameter(message: "Unknown stack command: \(params.command ?? "")"),
                    nil
                )
            }
        }
    }

    private func target(
        from params: Sparkling_Router.StackMethodParamModel
    ) -> SPKNavigationTarget? {
        guard let scheme = params.scheme, !scheme.isEmpty,
            let path = params.path, !path.isEmpty
        else {
            return nil
        }
        return SPKNavigationTarget(
            path: path,
            search: stringDictionary(params.search),
            bundle: params.bundle ?? "",
            scheme: scheme,
            presentation: params.presentation ?? "push"
        )
    }

    private func target(from dictionary: [String: Any]) -> SPKNavigationTarget? {
        guard let scheme = dictionary["scheme"] as? String, !scheme.isEmpty,
            let path = dictionary["path"] as? String, !path.isEmpty
        else {
            return nil
        }
        return SPKNavigationTarget(
            path: path,
            search: stringDictionary(dictionary["search"] as? NSDictionary),
            bundle: dictionary["bundle"] as? String ?? "",
            scheme: scheme,
            presentation: dictionary["presentation"] as? String ?? "push"
        )
    }

    private func stringDictionary(_ dictionary: NSDictionary?) -> [String: String] {
        var result: [String: String] = [:]
        dictionary?.forEach { key, value in
            result[String(describing: key)] = String(describing: value)
        }
        return result
    }
}
