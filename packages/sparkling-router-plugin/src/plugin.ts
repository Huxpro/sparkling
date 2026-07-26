// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { generateSparklingRoutes } from './generator';
import type { SparklingRouterPluginOptions } from './types';

interface RsbuildConfigLike {
    source?: {
        entry?: Record<string, string>;
        alias?: Record<string, string>;
    };
}

interface RsbuildPluginApiLike {
    context: {
        rootPath: string;
    };
    modifyRsbuildConfig(
        callback: (config: RsbuildConfigLike) => RsbuildConfigLike | void,
    ): void;
}

export interface SparklingRouterRsbuildPlugin {
    name: string;
    enforce: 'pre';
    setup(api: RsbuildPluginApiLike): Promise<void>;
}

export function pluginSparklingRouter(
    options: SparklingRouterPluginOptions = {},
): SparklingRouterRsbuildPlugin {
    return {
        name: 'sparkling-router-plugin',
        enforce: 'pre',
        async setup(api) {
            const generated = await generateSparklingRoutes(api.context.rootPath, options);
            api.modifyRsbuildConfig((config) => {
                config.source ??= {};
                config.source.entry = {
                    ...(config.source.entry ?? {}),
                    ...generated.entries,
                };
                config.source.alias = {
                    ...(config.source.alias ?? {}),
                    'react$': '@lynx-js/react/compat',
                };
                return config;
            });
        },
    };
}
