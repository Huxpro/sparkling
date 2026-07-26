// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext, type Context } from '@lynx-js/react';
import type { ReadonlyURLSearchParams } from './search-params';

/**
 * Mirror of Next.js AppRouterInstance (next/dist/shared/lib/app-router-context).
 */
export interface AppRouterInstance {
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string, options?: { kind?: string }): void;
}

export interface NavigateOptions {
  scroll?: boolean;
}

export type Params = Record<string, string | string[]>;

export const AppRouterContext: Context<AppRouterInstance | null> = createContext<AppRouterInstance | null>(null);
export const PathnameContext: Context<string | null> = createContext<string | null>(null);
export const SearchParamsContext: Context<ReadonlyURLSearchParams | null> = createContext<ReadonlyURLSearchParams | null>(null);
export const PathParamsContext: Context<Params | null> = createContext<Params | null>(null);
