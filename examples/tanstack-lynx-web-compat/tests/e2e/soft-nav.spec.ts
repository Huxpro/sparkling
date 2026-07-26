// Copyright (c) 2026 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@playwright/test'

/**
 * Real Lynx-for-Web soft-nav suite.
 *
 * Navigation is driven by `?scenario=` (in-app useNavigate), because Playwright
 * click / touch on `<x-text bindtap>` does not currently fire Lynx tap handlers
 * inside `<lynx-view>` (documented known gap).
 */

async function waitForText(page: import('@playwright/test').Page, text: string) {
  await expect(page.getByText(text, { exact: false })).toBeVisible({
    timeout: 30_000,
  })
}

test.describe('Lynx Web soft navigation (TanStack + CompositeHistory)', () => {
  test('boots at /', async ({ page }) => {
    await page.goto('/?bundle=/suite.web.bundle')
    await waitForText(page, 'pathname=/')
    await waitForText(page, 'Index')
    await waitForText(page, 'scenario=idle')
  })

  test('scenario about-search', async ({ page }) => {
    await page.goto('/?bundle=/suite.web.bundle&scenario=about-search')
    await waitForText(page, 'scenario=done:about-search')
    await waitForText(page, 'pathname=/about')
    await waitForText(page, 'from=index')
  })

  test('scenario posts-params', async ({ page }) => {
    await page.goto('/?bundle=/suite.web.bundle&scenario=posts-params')
    await waitForText(page, 'scenario=done:posts-params')
    await waitForText(page, 'pathname=/posts/42')
    await waitForText(page, 'Post 42')
  })

  test('scenario soft-back', async ({ page }) => {
    await page.goto('/?bundle=/suite.web.bundle&scenario=soft-back')
    await waitForText(page, 'scenario=done:soft-back')
    await waitForText(page, 'pathname=/')
  })

  test('scenario replace', async ({ page }) => {
    await page.goto('/?bundle=/suite.web.bundle&scenario=replace')
    await waitForText(page, 'scenario=done:replace')
    await waitForText(page, 'pathname=/about')
    await waitForText(page, 'from=replace')
  })

  test('Playwright click triggers bindtap after use-sync-external-store alias', async ({ page }) => {
    // Early runs without @lynx-js/use-sync-external-store made this look broken
    // (navigate happened, UI did not re-render). With the alias, click→bindtap works.
    await page.goto('/?bundle=/suite.web.bundle')
    await waitForText(page, 'pathname=/')
    await page.locator('x-text#go-about').click({ force: true })
    await waitForText(page, 'pathname=/about')
    await waitForText(page, 'from=index')
  })
})

