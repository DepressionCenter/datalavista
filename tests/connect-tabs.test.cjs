/* ============================================================
This file is part of DataLaVista™
connect-tabs.test.cjs: Unit tests for keyboard movement between the Connect popup tabs.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks that the arrow keys, Home, and End move focus between the available data source tabs.
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

const handleSourceTabKeydown = (() => {
  let tabs = [];
  let selector = '';
  const document = {
    addEventListener: () => {}, getElementById: () => null, querySelector: () => null,
    querySelectorAll: s => { selector = s; return tabs; },
  };
  const handler = loadSource({ document })('handleSourceTabKeydown');
  /** Press a key on one of four fake tabs and report which tab gets focus. */
  return (key, fromIndex) => {
    let focused = null;
    tabs = [0, 1, 2, 3].map(i => ({ focus: () => { focused = i; } }));
    handler({ key, target: tabs[fromIndex], preventDefault: () => {} });
    return { focused, selector };
  };
})();

test('arrow keys move to the next and previous tab and wrap around', () => {
  assert.equal(handleSourceTabKeydown('ArrowRight', 1).focused, 2);
  assert.equal(handleSourceTabKeydown('ArrowRight', 3).focused, 0);
  assert.equal(handleSourceTabKeydown('ArrowLeft', 0).focused, 3);
});

test('Home and End move to the first and last tab', () => {
  assert.equal(handleSourceTabKeydown('Home', 2).focused, 0);
  assert.equal(handleSourceTabKeydown('End', 0).focused, 3);
});

test('other keys leave focus alone, and unavailable tabs are skipped', () => {
  const { focused, selector } = handleSourceTabKeydown('a', 1);
  assert.equal(focused, null);
  assert.match(selector, /:not\(\.disabled\)/);
});
