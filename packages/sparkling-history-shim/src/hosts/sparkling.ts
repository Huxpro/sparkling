// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { open, close } from 'sparkling-navigation';
import type { NavigationHost } from '../types';
import { UrlSearchParamsShim } from '../url';

interface SparklingGlobalProps {
  containerID?: string;
  queryItems?: Record<string, string>;
}

declare const lynx: {
  __globalProps?: SparklingGlobalProps;
  getJSModule?(name: string): {
    addListener(event: string, cb: () => void): void;
    removeListener(event: string, cb: () => void): void;
  } | undefined;
} | undefined;

const DEFAULT_BASE_SCHEME = 'hybrid://lynxview_page';

function getGlobalProps(): SparklingGlobalProps {
  if (typeof lynx !== 'undefined' && lynx && lynx.__globalProps) {
    return lynx.__globalProps;
  }
  return {};
}

/**
 * NavigationHost implemented over sparkling-navigation.
 *
 * Works on every platform sparkling-navigation supports (Android, iOS, web
 * shell): `open`/`close` go through the spkPipe method bridge, and the
 * initial URL is reconstructed from `lynx.__globalProps.queryItems`, which
 * all Sparkling containers populate from the scheme they were opened with.
 */
export function createSparklingHost(baseScheme: string = DEFAULT_BASE_SCHEME): NavigationHost {
  function lifecycle(event: 'onShow' | 'onHide', cb: () => void): () => void {
    if (typeof lynx === 'undefined' || !lynx?.getJSModule) {
      return () => undefined;
    }
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    if (!emitter) {
      return () => undefined;
    }
    emitter.addListener(event, cb);
    return () => {
      emitter.removeListener(event, cb);
    };
  }

  return {
    open(scheme: string): Promise<void> {
      return new Promise((resolve, reject) => {
        open({ scheme }, (result) => {
          if (result.code === 1) {
            resolve();
          } else {
            reject(new Error(result.msg ?? `router.open failed (code ${result.code})`));
          }
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        close({}, (result) => {
          if (result.code === 1) {
            resolve();
          } else {
            reject(new Error(result.msg ?? `router.close failed (code ${result.code})`));
          }
        });
      });
    },
    initialUrl(): string {
      const { queryItems } = getGlobalProps();
      const params = new UrlSearchParamsShim();
      if (queryItems) {
        for (const key of Object.keys(queryItems)) {
          params.append(key, queryItems[key]);
        }
      }
      const query = params.toString();
      return query === '' ? baseScheme : `${baseScheme}?${query}`;
    },
    containerId(): string {
      return getGlobalProps().containerID ?? 'unknown-container';
    },
    onShow(cb) {
      return lifecycle('onShow', cb);
    },
    onHide(cb) {
      return lifecycle('onHide', cb);
    },
  };
}
