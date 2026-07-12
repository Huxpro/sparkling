// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect } from 'react';
import {
  Go as GoBase,
  GoConfigProvider,
  type GoConfig,
  type GoProps,
} from '@lynx-js/go-web';
import { rspressAdapter } from '@lynx-js/go-web/adapters/rspress';

// The `<Go>` component embeds live Lynx examples on the web: code browsing, an
// in-browser web preview, and a QR code for on-device testing.
//
// `rspressAdapter` wires go-web's pluggable hooks (base path, i18n, language,
// dark mode, NoSSR, syntax-highlighted CodeBlock) to Rspress's runtime. The
// `go.*` i18n strings are provided by `i18n.json`.
const config: GoConfig = {
  // Where `prepare-examples.mjs` writes each example (served from the site's
  // public dir). `withBase` from the adapter prepends the site `base`
  // (`/sparkling/`), yielding e.g. `/sparkling/examples/hello-world/...`.
  exampleBasePath: '/examples',
  // Default to the live web preview; falls back to source when a web bundle
  // isn't available for an example.
  defaultTab: 'web',
  explorerText: 'Lynx Explorer',
  ...rspressAdapter,
};

/** Keep Semi UI (go-web's UI kit) in sync with Rspress's dark mode. */
function useSemiDarkMode() {
  const dark = rspressAdapter.useDark!();
  useEffect(() => {
    document.body.setAttribute('theme-mode', dark ? 'dark' : 'light');
  }, [dark]);
}

export function Go(props: GoProps) {
  useSemiDarkMode();
  return (
    <GoConfigProvider config={config}>
      <GoBase {...props} />
    </GoConfigProvider>
  );
}

export type { GoProps };
export default Go;
