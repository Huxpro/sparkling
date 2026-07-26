// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core';
import { generateSparklingRoutes } from './generator';
import type { SparklingRouterPluginOptions } from './types';

export type SparklingRouterRsbuildPlugin = RsbuildPlugin;

export function pluginSparklingRouter(
    options: SparklingRouterPluginOptions = {},
): SparklingRouterRsbuildPlugin {
    return {
        name: 'sparkling-router-plugin',
        enforce: 'pre',
        async setup(api) {
            const generated = await generateSparklingRoutes(api.context.rootPath, options);
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
                return mergeRsbuildConfig(config, {
                    source: {
                        entry: generated.entries,
                    },
                    resolve: {
                        alias: {
                            'react$': '@lynx-js/react/compat',
                            'react/jsx-runtime$': '@lynx-js/react/jsx-runtime',
                            'react/jsx-dev-runtime$': '@lynx-js/react/jsx-dev-runtime',
                            'react-dom$': 'sparkling-router/react-dom-shim',
                        },
                    },
                });
            });
        },
    };
}
