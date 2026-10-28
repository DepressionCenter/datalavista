/* ============================================================
This file is part of DataLaVista™
bundle-guard.test.cjs: Unit tests for the module loader guard around the packed libraries.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks that before-libraries.js hides define.amd, exports, and module and that after-libraries.js restores them.
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
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const before = readFileSync(join(__dirname, '..', 'src', 'before-libraries.js'), 'utf8');
const after = readFileSync(join(__dirname, '..', 'src', 'after-libraries.js'), 'utf8');

/**
 * Run the guard files around a probe, the way the build places them around the libraries.
 * @param {object} page Properties to put on the fake window before the guard runs.
 * @returns {{ during: object, after: object }} What a library would see while the guard is active, and the page afterward.
 */
function runGuard(page) {
  const context = vm.createContext({});
  context.window = context;
  Object.assign(context, page);
  vm.runInContext(before, context, { filename: 'before-libraries.js' });
  const during = vm.runInContext(`({
    amd: typeof define === 'function' ? define.amd : 'no define',
    exportsType: typeof exports,
    moduleType: typeof module,
  })`, context);
  vm.runInContext(after, context, { filename: 'after-libraries.js' });
  return { during, after: context };
}

test('a standalone page without loaders is left alone', () => {
  const { during, after } = runGuard({});
  assert.equal(during.amd, 'no define');
  assert.equal(during.exportsType, 'undefined');
  assert.equal(during.moduleType, 'undefined');
  assert.equal(after.define, undefined);
});

test('define.amd, exports, and module are hidden while the libraries run and restored afterward', () => {
  const define = function () {};
  define.amd = { jQuery: true };
  const exportsObject = {};
  const moduleObject = { exports: {} };
  const { during, after } = runGuard({ define, exports: exportsObject, module: moduleObject });
  // null, not undefined: AlaSQL's FileSaver code registers with RequireJS unless define.amd is null
  assert.equal(during.amd, null);
  assert.equal(during.exportsType, 'undefined');
  assert.equal(during.moduleType, 'undefined');
  assert.deepEqual(after.define.amd, { jQuery: true });
  assert.equal(after.exports, exportsObject);
  assert.equal(after.module, moduleObject);
});

test('a value assigned to define.amd while hidden is kept and restored', () => {
  const define = function () {};
  define.amd = { first: true };
  const context = vm.createContext({});
  context.window = context;
  context.define = define;
  vm.runInContext(before, context);
  vm.runInContext('define.amd = { second: true }', context);
  assert.equal(vm.runInContext('define.amd', context), null);
  vm.runInContext(after, context);
  // The object was made inside the sandbox, so compare a plain copy
  assert.deepEqual(JSON.parse(JSON.stringify(define.amd)), { second: true });
});

test('a frozen define is tolerated', () => {
  const define = Object.freeze(Object.assign(function () {}, { amd: {} }));
  const { during, after } = runGuard({ define });
  // Nothing can hide a frozen amd; the guard must not throw and must leave define as it was
  assert.deepEqual(during.amd, {});
  assert.equal(after.define, define);
});
