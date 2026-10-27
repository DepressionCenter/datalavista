/* ============================================================
This file is part of DataLaVista™
helpers.spec.js: Tests for parsing and safety helpers.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks CSV parsing, name conversion, HTML cleaning, style values, and trusted SharePoint addresses.
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

test.beforeEach(async ({ page }) => { await openApp(page); });

test('parseCSV keeps quoted commas and doubled quotes', async ({ page }) => {
  const parsed = await page.evaluate(() => dlv.parseCSV('Site,Note\nA,"Ann Arbor, MI"\nB,"Says ""hi"""\n'));
  expect(parsed.headers).toEqual(['Site', 'Note']);
  expect(parsed.rows).toEqual([{ Site: 'A', Note: 'Ann Arbor, MI' }, { Site: 'B', Note: 'Says "hi"' }]);
});

test('parseCSV returns no headers for empty text', async ({ page }) => {
  expect(await page.evaluate(() => dlv.parseCSV('\n\n'))).toEqual({ headers: [], rows: [] });
});

test('toPascalCase builds names that SQL accepts', async ({ page }) => {
  const names = await page.evaluate(() => ['weight kg', 'Participant\'s Name', '  start_date '].map(dlv.toPascalCase));
  expect(names).toEqual(['WeightKg', 'ParticipantsName', 'StartDate']);
});

test('sanitizeHTML keeps formatting and removes scripts, handlers, and unsafe links', async ({ page }) => {
  const html = await page.evaluate(() => dlv.sanitizeHTML(
    '<b>Bold</b><script>window.__dlvTest = 1</script><img src="x" onerror="window.__dlvTest = 2">'
    + '<a href="javascript:alert(1)">bad</a><a href="https://example.org/help">good</a>'));
  expect(html).toContain('<b>Bold</b>');
  expect(html).not.toMatch(/<script|onerror|javascript:/i);
  expect(html).toContain('href="https://example.org/help"');
  expect(await page.evaluate(() => window.__dlvTest)).toBeUndefined();
});

test('_safeCssColor accepts colors and rejects anything else', async ({ page }) => {
  const results = await page.evaluate(() => ['#0078d4', 'navy', 'rgb(0, 120, 212)', 'red;background:url(https://example.org/x)', 'url(x)']
    .map(v => dlv._safeCssColor(v, 'FALLBACK')));
  expect(results).toEqual(['#0078d4', 'navy', 'rgb(0, 120, 212)', 'FALLBACK', 'FALLBACK']);
});

test('isTrustedSharePointSite accepts only https SharePoint hosts', async ({ page }) => {
  const results = await page.evaluate(() => [
    'https://contoso.sharepoint.com/sites/research',
    'http://contoso.sharepoint.com/sites/research',
    'https://contoso.sharepoint.com.example.org/sites/research',
    'https://example.org/sharepoint.com',
    'not an address',
  ].map(dlv.isTrustedSharePointSite));
  expect(results).toEqual([true, false, false, false, false]);
});
