/* ============================================================
This file is part of DataLaVista™
csv-import.test.cjs: CSV import regression tests.
Author(s): Sukhdeep Singh Panesar.
Created: 2026-11-05
Last Modified: 2026-11-05
Summary: Checks quoted CSV records, whitespace, and upload row counts.
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
const { loadSource } = require('./load-source.cjs');

const get = loadSource();
const parse = text => JSON.parse(JSON.stringify(get('parseCSV')(text)));

for (const newline of ['\n', '\r\n', '\r']) {
  test(`quoted cells preserve ${JSON.stringify(newline)} without adding rows`, () => {
    const note = `line one${newline}${newline}line three`;
    assert.deepEqual(parse(`id,note${newline}1,"${note}"${newline}2,ok${newline}`), {
      headers: ['id', 'note'], rows: [{ id: '1', note }, { id: '2', note: 'ok' }],
    });
  });
}

test('quoted whitespace, commas, and doubled quotes survive together', () => {
  assert.deepEqual(parse('id,note\n1,"  says ""hello,""\n again  "\n2,"  "').rows,
    [{ id: '1', note: '  says "hello,"\n again  ' }, { id: '2', note: '  ' }]);
});

test('multiline headings are one header field', () => {
  assert.deepEqual(parse('id,"long\nheading"\n1,value'), {
    headers: ['id', 'long\nheading'], rows: [{ id: '1', 'long\nheading': 'value' }],
  });
});

test('blank records are skipped but quoted empty records are retained', () => {
  assert.deepEqual(parse('\ufeffnote\n\n \t\n""\n"  "\n').rows, [{ note: '' }, { note: '  ' }]);
});

test('unquoted fields stay trimmed and missing values stay null', () => {
  assert.deepEqual(parse(' id , note ,extra\n 1 , value ,\n2,other').rows,
    [{ id: '1', note: 'value', extra: '' }, { id: '2', note: 'other', extra: null }]);
  assert.deepEqual(parse(' \r\n\t'), { headers: [], rows: [] });
  assert.deepEqual(parse('id,note'), { headers: ['id', 'note'], rows: [] });
});

test('script-like CSV values remain literal text', () => {
  const value = '<script>globalThis.csvExecuted = true</script>\nnext';
  assert.equal(parse(`note\n"${value}"`).rows[0].note, value);
  assert.equal(get('typeof csvExecuted'), 'undefined');
});

test('bundled studies CSV still imports every record', () => {
  const text = readFileSync(join(__dirname, '..', 'samples', 'data', 'studies.csv'), 'utf8');
  const result = parse(text);
  assert.equal(result.rows.length, text.trim().split('\n').length - 1);
  assert.ok(result.headers.includes('budget'));
  assert.ok(result.rows.every(row => Object.keys(row).length === result.headers.length));
});

test('uploaded multiline CSV retains its data and metadata row count', async () => {
  class FileReader {
    readAsText(file) { this.onload({ target: { result: file.text } }); }
  }
  const pipeline = loadSource({ FileReader })('CyberdynePipeline');
  const result = await pipeline.loadCSVFile({ text: 'id,note\n1,"first\nsecond"\n2,ok' },
    'Example', { fileName: 'notes.csv' });
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].note, 'first\nsecond');
  assert.equal(result.metadata.rowCount, 2);
});

test('remote fetch loader keeps multiline records and their row count', async () => {
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    return { ok: true, headers: { get: () => null },
      text: async () => 'id,note\r\n1,"first\r\nsecond"\r\n2,ok' };
  };
  const pipeline = loadSource({ fetch, AbortController })('CyberdynePipeline');
  const result = await pipeline.loadWithFetch('https://example.org/notes.csv', 'Example', 'csv', {});
  assert.deepEqual(calls, ['https://example.org/notes.csv']);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].note, 'first\r\nsecond');
  assert.equal(result.metadata.rowCount, 2);
});
