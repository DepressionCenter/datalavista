/* ============================================================
This file is part of DataLaVista™
page-load.spec.js: Startup tests for the built pages.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks that both built pages load their libraries and draw the interface without script errors.
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

const { test, expect, openApp } = require('./app');

for (const file of ['DataLaVista.html', 'DataLaVista-nojs.html']) {
  test(`${file} draws the interface without script errors`, async ({ page }) => {
    const errors = await openApp(page, file);
    await expect(page.locator('#dlv-root #tab-query')).toBeVisible();
    await expect(page.locator('#dlv-styles')).toHaveCount(1);
    const libraries = await page.evaluate(() => ({
      alasql: typeof window.alasql,
      xlsx: typeof window.XLSX,
      echarts: typeof window.echarts,
      codeMirror: typeof window.CodeMirror,
    }));
    expect(libraries).toEqual({ alasql: 'function', xlsx: 'object', echarts: 'object', codeMirror: 'function' });
    expect(errors).toEqual([]);
  });
}
