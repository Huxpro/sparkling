// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useContext, useEffect, useRef, type ReactNode } from '@lynx-js/react';
import { AppRouterContext } from './contexts';

export interface LinkProps {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  /**
   * Called before navigation; call `preventDefault()` to cancel.
   * Mirrors Next.js `<Link onNavigate>`.
   */
  onNavigate?: (event: { preventDefault: () => void }) => void;
  children?: ReactNode;
  /** Passed through to the underlying <view>. */
  className?: string;
  style?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * `<Link>` for ReactLynx. Renders a `<view>` and maps tap → router.push /
 * router.replace. Anchor-specific behavior (modifier-clicks, `target`,
 * `passHref`, drag) has no Lynx equivalent and is intentionally omitted;
 * see the compatibility matrix.
 */
export function Link(props: LinkProps): ReactNode {
  const { href, replace, prefetch, onNavigate, children, className, style, ...rest } = props;
  const router = useContext(AppRouterContext);
  const hrefRef = useRef(href);
  hrefRef.current = href;

  useEffect(() => {
    if (prefetch !== false && router) {
      router.prefetch(href);
    }
  }, [href, prefetch, router]);

  const handleTap = () => {
    if (!router) return;
    if (onNavigate) {
      let prevented = false;
      onNavigate({ preventDefault: () => (prevented = true) });
      if (prevented) return;
    }
    if (replace) {
      router.replace(hrefRef.current);
    } else {
      router.push(hrefRef.current);
    }
  };

  return (
    <view bindtap={handleTap} className={className} style={style} {...rest}>
      {children}
    </view>
  );
}

export default Link;
