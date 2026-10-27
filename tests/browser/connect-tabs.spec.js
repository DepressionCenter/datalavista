/* ============================================================
This file is part of DataLaVista™
connect-tabs.spec.js: Keyboard and accessibility tests for the Connect popup tabs.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks keyboard movement between data source tabs and scans the tab list with axe-core.
Notes: See README file for documentation and full license information.
Website: https://github.com/DepressionCenter/datalavista

Copyright © 2026 The Regents of the University of Michigan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
You should have received a copy of the GNU General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.
================================================================ */

const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, openApp } = require('./app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => dlv.showConnectPopup());
  await page.focus('#popup-close-btn');
});

test('arrow keys, Home, and End move between tabs and skip SharePoint outside SharePoint', async ({ page }) => {
  const sharepoint = page.locator('#tab-sharepoint');
  await expect(sharepoint).toHaveAttribute('aria-disabled', 'true');

  // Tab reaches the selected tab first
  await page.keyboard.press('Tab');
  await expect(page.locator('.source-tab[aria-selected="true"]')).toBeFocused();

  await page.keyboard.press('Home');
  await expect(page.locator('#tab-upload')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-remote')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-loadconfig')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-upload')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tab-loadconfig')).toBeFocused();
});

test('Enter opens the focused tab and its pane', async ({ page }) => {
  await page.locator('#tab-remote').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tab-remote')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tab-remote')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('#src-remote')).toHaveClass(/active/);
  await expect(page.locator('#tab-upload')).toHaveAttribute('aria-selected', 'false');
});

test('the tab list has no axe-core violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include('#source-tablist')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
});
