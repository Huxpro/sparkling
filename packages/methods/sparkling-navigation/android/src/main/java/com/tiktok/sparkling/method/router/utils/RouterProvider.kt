// Copyright (c) 2022 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling.method.router.utils

object RouterProvider {
    var hostRouterDepend: IHostRouterDepend? = null

    /** Optional stack-protocol host. Null until Android S4/P3 adoption. */
    var hostStackRouterDepend: IHostStackRouterDepend? = null
}
