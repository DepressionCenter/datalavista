/* ============================================================
This file is part of DataLaVista™
load-source.cjs: Loads the application source into Node.js for unit tests.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Runs the src/ files in build order inside a sandbox with small browser stand-ins.
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

const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const SRC = join(__dirname, '..', 'src');
const noop = () => {};

// Just enough of the page for the source files to load; nothing is drawn
function fakeElement() {
  return {
    addEventListener: noop, appendChild: noop, setAttribute: noop, focus: noop,
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: {}, dataset: {},
  };
}

/**
 * Load every numbered src/ file in build order, except the one that starts the app.
 * @param {object} [globals] Extra or replacement globals, such as an alasql stand-in.
 * @returns {(name: string) => any} Returns a function or value defined by the source, by name.
 */
function loadSource(globals = {}) {
  const document = {
    addEventListener: noop, getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], createElement: fakeElement,
    body: fakeElement(), head: fakeElement(), documentElement: fakeElement(),
  };
  const window = { addEventListener: noop, location: new URL('http://127.0.0.1:8765/DataLaVista.html'), document };
  const alasql = () => [];
  alasql.tables = {};
  const context = vm.createContext({
    console, URL, setTimeout, clearTimeout, window, document, alasql,
    navigator: { userAgent: 'node' },
    MutationObserver: class { observe() {} disconnect() {} },
    ...globals,
  });
  const files = readdirSync(SRC).filter(n => /^\d\d-.*\.js$/.test(n) && !n.startsWith('99-')).sort();
  for (const file of files) {
    vm.runInContext(readFileSync(join(SRC, file), 'utf8'), context, { filename: file });
  }
  return name => vm.runInContext(name, context);
}

module.exports = { loadSource };
