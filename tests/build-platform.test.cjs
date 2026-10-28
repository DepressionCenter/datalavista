/* ============================================================
This file is part of DataLaVista™
build-platform.test.cjs: Unit tests for the esbuild platform choice in build.sh.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Runs the esbuild_platform function from build.sh for several computers and checks the package it picks.
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
const { spawnSync } = require('node:child_process');

// The function is copied out of build.sh so the test runs exactly what the build runs
const buildScript = readFileSync(join(__dirname, '..', 'build.sh'), 'utf8');
const match = buildScript.match(/^esbuild_platform\(\) \{[\s\S]*?^\}/m);

function runBash(script) {
  return spawnSync('bash', ['-c', script], { encoding: 'utf8' });
}

const bashWorks = runBash('echo ok').stdout?.trim() === 'ok';

test('build.sh defines esbuild_platform', () => {
  assert.ok(match, 'build.sh must define an esbuild_platform function');
});

test('esbuild_platform picks the package that matches the computer', { skip: !bashWorks && 'bash is not available on this computer' }, () => {
  const cases = [
    ['Linux', 'x86_64', 'linux-x64'],
    ['Linux', 'aarch64', 'linux-arm64'],
    ['Darwin', 'x86_64', 'darwin-x64'],
    ['Darwin', 'arm64', 'darwin-arm64'],
    ['MINGW64_NT-10.0', 'x86_64', ''],
    ['Linux', 'armv7l', ''],
    ['FreeBSD', 'amd64', ''],
  ];
  for (const [os, arch, expected] of cases) {
    const result = runBash(`${match[0]}\nesbuild_platform '${os}' '${arch}'`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected, `${os} on ${arch}`);
  }
});
