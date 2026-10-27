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

/**
 * Load the source with stand-ins for the clipboard feature, the older copy command, the success message, and the popup.
 * @param {object} navigator Stand-in for the browser's navigator, with or without a clipboard.
 * @param {() => boolean} [copyCommand] Result of the older copy command. It may throw instead.
 */
function loadCopy(navigator, copyCommand = () => false) {
  const shown = { notifications: [], dialogs: [], copyCommands: [], textBoxes: [] };
  const get = loadSource({
    navigator,
    recordToast: (message, type) => shown.notifications.push({ message, type }),
    recordDialog: options => shown.dialogs.push(options),
  });
  get('toast = (message, type) => recordToast(message, type)');
  get('dlvAskDialog = async options => recordDialog(options)');
  const document = get('document');
  document.createElement = () => {
    const textBox = {
      value: '', style: {}, isConnected: false, selected: '',
      focus() {}, select() { this.selected = this.value; }, remove() { this.isConnected = false; },
    };
    shown.textBoxes.push(textBox);
    return textBox;
  };
  document.body.appendChild = element => { element.isConnected = true; };
  document.execCommand = command => {
    shown.copyCommands.push({ command, selected: shown.textBoxes[shown.textBoxes.length - 1].selected });
    return copyCommand();
  };
  return { copy: get('copyTextWithFallback'), document, shown };
}

// Ways the clipboard feature can be missing or refuse to copy
const clipboardFailures = [
  {},
  { clipboard: {} },
  { clipboard: { writeText: null } },
  { clipboard: { writeText: () => Promise.reject(new Error('Permission denied')) } },
  { clipboard: { writeText: () => { throw new Error('Blocked'); } } },
];

test('clipboard success is reported only after the browser finishes copying', async () => {
  let completeWrite;
  const pendingWrite = new Promise(resolve => { completeWrite = resolve; });
  const { copy, shown } = loadCopy({ clipboard: { writeText: text => {
    assert.equal(text, 'Example report');
    return pendingWrite;
  } } });
  const result = copy('Example report', 'Copied');
  assert.equal(shown.notifications.length, 0);
  completeWrite();
  assert.equal(await result, true);
  assert.deepEqual(shown.notifications, [{ message: 'Copied', type: 'success' }]);
  assert.equal(shown.copyCommands.length, 0);
  assert.equal(shown.dialogs.length, 0);
});

test('the older copy command copies the text when the clipboard feature is missing or refuses', async () => {
  for (const navigator of clipboardFailures) {
    const { copy, shown } = loadCopy(navigator, () => true);
    assert.equal(await copy('Example report', 'Copied'), true);
    assert.deepEqual(shown.copyCommands, [{ command: 'copy', selected: 'Example report' }]);
    assert.deepEqual(shown.notifications, [{ message: 'Copied', type: 'success' }]);
    assert.equal(shown.dialogs.length, 0);
    assert.equal(shown.textBoxes[0].isConnected, false);
  }
});

test('the older copy command returns focus to the control that started it, unless that control was removed', async () => {
  for (const removed of [false, true]) {
    let rejectWrite;
    const { copy, document, shown } = loadCopy(
      { clipboard: { writeText: () => new Promise((resolve, reject) => { rejectWrite = reject; }) } },
      () => true);
    const focusCalls = [];
    const button = { isConnected: true, focus: options => focusCalls.push(options) };
    document.activeElement = button;
    const result = copy('Example report', 'Copied');
    button.isConnected = !removed;
    rejectWrite(new Error('Permission denied'));
    assert.equal(await result, true);
    assert.deepEqual(plain(focusCalls), removed ? [] : [{ preventScroll: true }]);
    assert.equal(shown.textBoxes[0].isConnected, false);
  }
});

test('copy failures offer the original text for manual copying', async () => {
  const unsafeText = '<img src=x onerror="alert(1)">\nExample report';
  for (const navigator of clipboardFailures) {
    for (const copyCommand of [() => false, () => { throw new Error('Blocked'); }]) {
      const { copy, shown } = loadCopy(navigator, copyCommand);
      assert.equal(await copy(unsafeText, 'Copied'), false);
      assert.equal(shown.notifications.length, 0);
      assert.equal(shown.dialogs.length, 1);
      assert.equal(shown.dialogs[0].title, 'Copy text manually');
      assert.equal(shown.dialogs[0].sections[1].copyText.value, unsafeText);
      assert.equal(shown.dialogs[0].hideCancel, true);
      assert.equal(shown.textBoxes[0].isConnected, false);
    }
  }
});
