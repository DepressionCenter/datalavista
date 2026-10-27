/* ============================================================
This file is part of DataLaVista™
helpers.test.cjs: Unit tests for parsing and safety helpers.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks parsing, safety helpers, trusted SharePoint addresses, and clipboard handling.
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

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./load-source.cjs');

// Values from the sandbox have their own Object and Array types, so compare plain copies
const plain = value => JSON.parse(JSON.stringify(value));

const get = loadSource();

test('parseCSV keeps quoted commas and doubled quotes', () => {
  const parsed = get('parseCSV')('Site,Note\nA,"Ann Arbor, MI"\nB,"Says ""hi"""\n');
  assert.deepEqual(plain(parsed), {
    headers: ['Site', 'Note'],
    rows: [{ Site: 'A', Note: 'Ann Arbor, MI' }, { Site: 'B', Note: 'Says "hi"' }],
  });
});

test('parseCSV returns no headers for empty text', () => {
  assert.deepEqual(plain(get('parseCSV')('\n\n')), { headers: [], rows: [] });
});

test('toPascalCase builds names that SQL accepts', () => {
  const toPascalCase = get('toPascalCase');
  assert.deepEqual(['weight kg', "Participant's Name", '  start_date '].map(n => toPascalCase(n)),
    ['WeightKg', 'ParticipantsName', 'StartDate']);
});

// Negative security test: markup from a data file must be escaped before it is written into the page
test('_attrEnc escapes markup and quotes', () => {
  assert.equal(get('_attrEnc')('<img src=x onerror="go()">&\''),
    '&lt;img src=x onerror=&quot;go()&quot;&gt;&amp;&#39;');
});

test('_safeCssColor accepts colors and rejects anything else', () => {
  const safeCssColor = get('_safeCssColor');
  const results = ['#0078d4', 'navy', 'rgb(0, 120, 212)', 'red;background:url(https://example.org/x)', 'url(x)']
    .map(v => safeCssColor(v, 'FALLBACK'));
  assert.deepEqual(results, ['#0078d4', 'navy', 'rgb(0, 120, 212)', 'FALLBACK', 'FALLBACK']);
});

test('isTrustedSharePointSite accepts only https SharePoint hosts', () => {
  const isTrusted = get('isTrustedSharePointSite');
  assert.deepEqual([
    'https://contoso.sharepoint.com/sites/research',
    'http://contoso.sharepoint.com/sites/research',
    'https://contoso.sharepoint.com.example.org/sites/research',
    'https://example.org/sharepoint.com',
    'not an address',
  ].map(u => isTrusted(u)), [true, false, false, false, false]);
});

test('clipboard success is reported only after the browser finishes copying', async () => {
  let completeWrite;
  const notifications = [];
  const dialogs = [];
  const pendingWrite = new Promise(resolve => { completeWrite = resolve; });
  const get = loadSource({
    navigator: { clipboard: { writeText: text => {
      assert.equal(text, 'Example report');
      return pendingWrite;
    } } },
    recordToast: (message, type) => notifications.push({ message, type }),
    recordDialog: options => dialogs.push(options),
  });
  get('toast = (message, type) => recordToast(message, type)');
  get('dlvAskDialog = async options => recordDialog(options)');
  const result = get('copyTextWithFallback')('Example report', 'Copied');
  assert.equal(notifications.length, 0);
  completeWrite();
  assert.equal(await result, true);
  assert.deepEqual(notifications, [{ message: 'Copied', type: 'success' }]);
  assert.equal(dialogs.length, 0);
});

test('clipboard failures offer the original text for manual copying', async () => {
  const unsafeText = '<img src=x onerror="alert(1)">\nExample report';
  for (const navigator of [
    {},
    { clipboard: { writeText: () => Promise.reject(new Error('Permission denied')) } },
    { clipboard: { writeText: () => { throw new Error('Blocked'); } } },
  ]) {
    const notifications = [];
    const dialogs = [];
    const get = loadSource({
      navigator,
      recordToast: (message, type) => notifications.push({ message, type }),
      recordDialog: options => dialogs.push(options),
    });
    get('toast = (message, type) => recordToast(message, type)');
    get('dlvAskDialog = async options => recordDialog(options)');
    assert.equal(await get('copyTextWithFallback')(unsafeText, 'Copied'), false);
    assert.equal(notifications.length, 0);
    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].title, 'Copy text manually');
    assert.equal(dialogs[0].sections[1].copyText.value, unsafeText);
    assert.equal(dialogs[0].hideCancel, true);
  }
});
