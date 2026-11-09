/* ============================================================
This file is part of DataLaVista™
data.test.cjs: Unit tests for column names and chart queries.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Checks the column renaming that keeps tables queryable and the SQL built for conditioned chart series.
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

// Column names that contain ] or ' stop AlaSQL from querying the table, so they are renamed on load
test('columns named with brackets or apostrophes are renamed, and other columns keep their names', () => {
  const result = loadSource()('CyberdynePipeline').makeColumnNamesQueryable({
    tableName: 'Weights',
    fields: [
      { internalName: 'Weight [kg]', alias: 'WeightKg' },
      { internalName: "Participant's Group", alias: 'ParticipantsGroup' },
      { internalName: 'constructor', alias: 'Constructor' },
    ],
    data: [{ 'Weight [kg]': 70, "Participant's Group": 'G1', constructor: 'c1' }],
  });
  assert.deepEqual(plain(result.fields.map(f => f.internalName)), ['Weight (kg)', 'Participant_s Group', 'constructor']);
  assert.deepEqual(plain(result.data), [{ 'Weight (kg)': 70, 'Participant_s Group': 'G1', constructor: 'c1' }]);
});

test('a renamed column never replaces a column that appears only in later rows', () => {
  const result = loadSource()('CyberdynePipeline').makeColumnNamesQueryable({
    tableName: 'Weights',
    fields: [{ internalName: 'Weight [kg]', alias: 'WeightKg' }],
    data: [{ 'Weight [kg]': 10 }, { 'Weight [kg]': 20, 'Weight (kg)': 999 }],
  });
  assert.deepEqual(plain(result.data), [{ 'Weight (kg)_2': 10 }, { 'Weight (kg)_2': 20, 'Weight (kg)': 999 }]);
});

test('foreign keys follow renamed columns', () => {
  const result = loadSource()('CyberdynePipeline').makeColumnNamesQueryable({
    tables: [
      { tableName: 'Visits', metadata: { internalTableName: 'Visits' }, fields: [{ internalName: "Owner's Id", alias: 'OwnersId' }], data: [{ "Owner's Id": 1 }] },
      { tableName: 'Owners', metadata: { internalTableName: 'Owners' }, fields: [{ internalName: 'id', alias: 'Id' }], data: [{ id: 1 }] },
    ],
    foreignKeys: [{ fromTable: 'Visits', fromCol: "Owner's Id", toTable: 'Owners', toCol: 'id' }],
  });
  assert.deepEqual(plain(result.foreignKeys), [{ fromTable: 'Visits', fromCol: 'Owner_s Id', toTable: 'Owners', toCol: 'id' }]);
});

// A SUM series with conditions adds up the field over matching rows; the Count field counts them
test('conditioned SUM and Count series build the right SQL', () => {
  // Stands in for the query results the chart reads from
  const alasql = () => [{ Grp: 'x', Status: 'Active', Budget: 100 }];
  alasql.tables = { dlv_results: {} };
  const active = [{ field: 'Status', op: '=', value: 'Active' }];
  const { sql } = loadSource({ alasql })('buildWidgetSQL')({
    id: 'w1', type: 'bar', dimensions: ['Grp'], seriesProps: [
      { field: 'Budget', agg: 'SUM', conditions: active },
      { field: '__dlv_count__', agg: '', conditions: active },
      { field: 'Budget', agg: 'SUM', conditions: [] },
    ],
  });
  assert.match(sql, /SUM\(CASE WHEN \[Status\] = 'Active' THEN \[Budget\] ELSE 0 END\)/);
  assert.match(sql, /SUM\(CASE WHEN \[Status\] = 'Active' THEN 1 ELSE 0 END\)/);
  assert.match(sql, /SUM\(\[Budget\]\)/);
  assert.match(sql, /FROM \[dlv_results\] GROUP BY \[Grp\]/);
});

test('a two-sheet upload keeps its Excel type in the saved report', async () => {
  const XLSX = require('../src/lib/xlsx.full.min.js');
  const book = XLSX.utils.book_new();
  for (const name of ['Visits', 'Sites']) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['id'], [1]]), name);
  }
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const app = loadSource({ XLSX, FileReader: class {
    readAsArrayBuffer() { this.onload({ target: { result: bytes } }); }
  } });
  app('renderFieldsPanel = setupCodeMirror = toast = setStatus = () => {}');
  const pipeline = app('CyberdynePipeline');
  pipeline._registerRawTable = () => {};
  pipeline.createView = (_, viewName) => viewName;
  app('ConnectQueue').addUploadedFile({ name: 'sample.xlsx' }, 'xlsx', 'Sample');
  await app('processConnectQueue')('upload');
  const ds = app('DataLaVistaState').dataSources.Sample;
  assert.deepEqual(Array.from(ds.tables), ['Sample_Visits', 'Sample_Sites']);
  assert.equal(ds.type, 'xlsx');
  const saved = JSON.parse(JSON.stringify(app('buildConfig')()));
  const reopened = loadSource();
  reopened("document.getElementById = id => id === 'btn-save-config' ? {} : null");
  reopened('DataLaVistaState.reportMode = "view"');
  reopened('refreshDashboardPreview = renderFilterBar = updateConnectButton = updateDashboardTitleTooltipIcon = setStatus = () => {}');
  await reopened('loadConfig')(saved);
  assert.equal(reopened('DataLaVistaState').dataSources.Sample.type, 'xlsx');
});

test('refreshing a remote workbook uses the Excel loader again', async () => {
  const app = loadSource();
  app('renderFieldsPanel = setupCodeMirror = toast = setStatus = showLoadingPopup = hideLoadingPopup = () => {}');
  const pipeline = app('CyberdynePipeline');
  const types = [];
  pipeline.loadRemoteFile = async (url, dsName, type) => {
    types.push(type);
    return { tables: ['Visits', 'Sites'].map(name => ({
      tableName: name, metadata: { sourceType: type, url }, fields: [], data: [],
    })) };
  };
  pipeline._registerRawTable = pipeline.createView = pipeline.refreshDataSourceTables = () => {};
  app('ConnectQueue').addRemoteUrl('https://example.org/sample.xlsx', 'xlsx', 'Sample');
  await app('processConnectQueue')('remote');
  await app('refreshDataSource')('Sample');
  assert.deepEqual(types, ['xlsx', 'xlsx']);
});

test('a .db upload retains its SQLite type and foreign keys', async () => {
  const app = loadSource();
  app('renderFieldsPanel = setupCodeMirror = toast = setStatus = () => {}');
  const pipeline = app('CyberdynePipeline');
  const foreignKeys = [{ fromTable: 'Visits', fromCol: 'SiteId', toTable: 'Sites', toCol: 'Id' }];
  pipeline.loadUploadedFile = async () => ({ tables: [], foreignKeys });
  let registeredKeys;
  pipeline.registerSqliteFkRelationships = (_, keys) => { registeredKeys = keys; };
  app('ConnectQueue').addUploadedFile({ name: 'sample.db' }, 'db', 'Sample');
  await app('processConnectQueue')('upload');
  assert.equal(app('DataLaVistaState').dataSources.Sample.type, 'sqlite');
  assert.deepEqual(registeredKeys, foreignKeys);
});
