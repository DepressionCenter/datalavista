/* ============================================================
This file is part of DataLaVista™
upload-queue.test.cjs: Tests for upload selection feedback.
Author(s): Sukhdeep Singh Panesar.
Created: 2026-11-06
Last Modified: 2026-11-06
Summary: Checks that upload feedback matches the files added to the queue.
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

function selectFiles(names) {
  const get = loadSource();
  const input = { files: names.map(name => ({ name })), value: 'selection' };
  get('document').getElementById = id => id === 'upload-file-input' ? input : null;
  const notices = [];
  get('notify => { toast = notify; }')((message, type) => notices.push({ message, type }));

  const queue = get('ConnectQueue');
  queue.addUploadedFile({ name: 'previous.csv' }, 'csv', 'Previous');
  get('handleUploadFiles')();
  return { input, notices, names: Array.from(queue.uploadedFiles, item => item.file.name) };
}

test('a mixed selection reports only new additions and explains skipped files', () => {
  const { input, notices, names } = selectFiles(['sample.CSV', 'notes.txt']);
  assert.deepEqual(names, ['previous.csv', 'sample.CSV']);
  assert.deepEqual(notices, [{ type: 'warning', message:
    'Added 1 file to the queue. Skipped 1 unsupported file. Choose a supported file type.' }]);
  assert.equal(input.value, '');
});

test('an unsupported selection leaves the queue alone and shows one warning', () => {
  const { notices, names } = selectFiles(['sample.txt', 'sample.csv.exe']);
  assert.deepEqual(names, ['previous.csv']);
  assert.deepEqual(notices, [{ type: 'warning', message:
    'No files were added. Skipped 2 unsupported files. Choose a supported file type.' }]);
});

test('supported selections report the number of additions', () => {
  for (const files of [['sample.xls'], ['sample.XLSX', 'data.db', 'config.json']]) {
    const { names, notices } = selectFiles(files);
    assert.deepEqual(names, ['previous.csv', ...files]);
    assert.deepEqual(notices, [{ type: 'success', message:
      files.length === 1 ? 'Added 1 file to the queue.' : 'Added 3 files to the queue.' }]);
  }
});

test('an empty selection keeps the existing prompt', () => {
  const { names, notices } = selectFiles([]);
  assert.deepEqual(names, ['previous.csv']);
  assert.deepEqual(notices, [{ type: 'warning', message: 'Please select files to upload' }]);
});
