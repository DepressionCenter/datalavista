/* ============================================================
This file is part of DataLaVista™
data.spec.js: Tests for loading and querying data.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Loads synthetic CSV, JSON, and Excel files and checks query results, chart sums, and escaping.
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

const { test, expect, openApp, uploadFile } = require('./app');

/** Run SQL the way the Run button does, and return the stored results. */
async function runQuery(page, sql) {
  return page.evaluate(async (sql) => {
    window._cmEditor.setValue(sql);
    DataLaVistaState.sql = sql;
    await dlv.runQuery();
    return alasql('SELECT * FROM dlv_results');
  }, sql);
}

test.beforeEach(async ({ page }) => { await openApp(page); });

test('an uploaded CSV file can be queried', async ({ page }) => {
  const view = await uploadFile(page, { name: 'visits.csv', type: 'csv', prefix: 'VISITS',
    text: 'Site,Visits\nA,12\nB,30\nC,5\n' });
  expect(view).toBeTruthy();
  const rows = await runQuery(page, `SELECT Site, Visits FROM [${view}] WHERE Visits > 10 ORDER BY Site`);
  expect(rows).toEqual([{ Site: 'A', Visits: 12 }, { Site: 'B', Visits: 30 }]);
});

test('an uploaded Excel workbook loads every sheet', async ({ page }) => {
  const counts = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Study: 'S1', Sites: 3 }, { Study: 'S2', Sites: 5 }]), 'Studies');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Wave: 1 }, { Wave: 2 }, { Wave: 3 }]), 'Waves');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    dlv.ConnectQueue.addUploadedFile(new File([bytes], 'studies.xlsx'), 'xlsx', 'XLSTUDY');
    await dlv.processConnectQueue('upload');
    return Object.keys(dlv.CyberdynePipeline.views)
      .filter(v => v.toLowerCase().startsWith('xlstudy'))
      .map(v => alasql(`SELECT COUNT(*) AS n FROM [${v}]`)[0].n)
      .sort();
  });
  expect(counts).toEqual([2, 3]);
});

// Column names that contain ] or ' used to stop the table from being queryable
test('columns named with brackets or apostrophes stay queryable', async ({ page }) => {
  const csvView = await uploadFile(page, { name: 'weights.csv', type: 'csv', prefix: 'WEIGHTS',
    text: "Name,Weight [kg],Participant's Group\nA,70,G1\nB,80,G2\n" });
  const csvRows = await page.evaluate(v => alasql(`SELECT * FROM [${v}]`), csvView);
  expect(csvRows).toHaveLength(2);
  expect(Object.values(csvRows[0]).map(String)).toEqual(expect.arrayContaining(['A', '70', 'G1']));

  const jsonView = await uploadFile(page, { name: 'nested.json', type: 'json', prefix: 'NESTED',
    text: JSON.stringify([{ id: 1, info: { "it's": 'yes' } }, { id: 2, info: { "it's": 'no' } }]) });
  const jsonRows = await page.evaluate(v => alasql(`SELECT * FROM [${v}]`), jsonView);
  expect(jsonRows).toHaveLength(2);
});

// A SUM series with conditions adds up the field over matching rows; the Count field counts them
test('conditioned SUM and Count series use only matching rows', async ({ page }) => {
  const view = await uploadFile(page, { name: 'budget.csv', type: 'csv', prefix: 'BUDGET',
    text: 'Grp,Status,Budget\nx,Active,100\nx,Active,250\nx,Closed,999\ny,Closed,5\n' });
  await runQuery(page, `SELECT * FROM [${view}]`);
  const rows = await page.evaluate(() => {
    const active = [{ field: 'Status', op: '=', value: 'Active' }];
    const widget = { id: 'wtest', type: 'bar', dimensions: ['Grp'], seriesProps: [
      { field: 'Budget', agg: 'SUM', conditions: active },
      { field: '__dlv_count__', agg: '', conditions: active },
      { field: 'Budget', agg: 'SUM', conditions: [] }] };
    return alasql(dlv.buildWidgetSQL(widget).sql);
  });
  const x = rows.find(r => Object.values(r).includes('x'));
  expect(Object.values(x).filter(v => typeof v === 'number')).toEqual([350, 2, 1349]);
});

// Negative security test: markup inside a cell must appear as text, never run
test('query results show markup in cells as text', async ({ page }) => {
  const view = await uploadFile(page, { name: 'notes.csv', type: 'csv', prefix: 'NOTES',
    text: 'Id,Note\n1,<img src=x onerror="window.__dlvTest=1">\n' });
  await runQuery(page, `SELECT * FROM [${view}]`);
  const wrap = page.locator('#preview-table-wrap');
  await expect(wrap).toContainText('<img src=x');
  await expect(wrap.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__dlvTest)).toBeUndefined();
});
