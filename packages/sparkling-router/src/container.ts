// Copyright 2026 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { StackPresentation } from 'sparkling-navigation';

export interface ContainerOptions {
    presentation?: StackPresentation;
    containerOptions?: Record<string, string>;
}

/**
 * Type-only authoring helper for `_container.tsx` files. The build plugin reads
 * this serializable object; it is never shared across container runtimes.
 */
export function defineContainer(options: ContainerOptions): ContainerOptions {
    return options;
}
