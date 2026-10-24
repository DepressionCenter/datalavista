const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../src/70-preview.js'), 'utf8');

async function exportRows(rows, title = '') {
  const downloads = [];
  const notifications = [];
  const alasql = () => rows;
  alasql.tables = { dlv_results: {} };
  const context = vm.createContext({
    alasql,
    DataLaVistaState: { design: { title } },
    downloadText: (...args) => downloads.push(args),
    toast: (...args) => notifications.push(args),
  });
  vm.runInContext(source, context);
  await context.downloadCSV();
  return { downloads, notifications };
}

for (const [name, field, encoded] of [
  ['comma', 'Total, USD', '"Total, USD"'],
  ['quote', 'Say "hello"', '"Say ""hello"""'],
  ['newline', 'first\nsecond', '"first\nsecond"'],
  ['carriage return', 'first\rsecond', '"first\rsecond"'],
  ['CRLF', 'first\r\nsecond', '"first\r\nsecond"'],
]) {
  test(`escapes ${name} in headings and values`, async () => {
    const { downloads } = await exportRows([{ [field]: field }]);
    assert.equal(downloads[0][0], `${encoded}\n${encoded}`);
  });
}

test('preserves numbers, booleans, empty strings, null and missing values', async () => {
  const { downloads } = await exportRows([
    { amount: 42, zero: 0, enabled: false, empty: '', nullable: null, missing: undefined },
    { amount: -3.5, zero: 0, enabled: true },
  ], 'Report');
  assert.deepEqual(downloads, [[
    'amount,zero,enabled,empty,nullable,missing\n42,0,false,,,\n-3.5,0,true,,,',
    'Report.csv', 'text/csv',
  ]]);
});

test('uses the default filename and reports the exported row count', async () => {
  const { downloads, notifications } = await exportRows([{ amount: 42 }]);
  assert.deepEqual(downloads, [['amount\n42', 'DataLaVista-export.csv', 'text/csv']]);
  assert.deepEqual(notifications, [['Exported 1 rows', 'success']]);
});

test('does not download an empty result', async () => {
  const { downloads, notifications } = await exportRows([]);
  assert.equal(downloads.length, 0);
  assert.deepEqual(notifications, [['No data to export', 'warning']]);
});
