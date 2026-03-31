/* ============================================================
This file is part of DataLaVista
10-constants.js: Constants, state object, and core DataLaVista objects.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-31
Summary: Constants, state object, and core DataLaVista objects.
Notes: See README file for documentation and full license information.
Website: https://github.com/DepressionCenter/datalavista

Copyright (c) 2026 The Regents of the University of Michigan

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

/* ============================================================
    Data La Vista Core
    [I'll be backbone...]
  =============================================================== */
const DataLaVistaCore = {
  /* ===== CONSTANTS ===== */
  // Field type icons for display in field lists, query builder, etc.
  FIELD_TYPE_ICONS: {
    'text': { icon: '📝', cls: 'type-text' },
    'number': { icon: '#️⃣', cls: 'type-number' },
    'integer': { icon: '#️⃣', cls: 'type-number' },
    'decimal': { icon: '#️⃣', cls: 'type-number' },
    'currency': { icon: '#️⃣', cls: 'type-number' },
    'date': { icon: '📅', cls: 'type-date' },
    'bool': { icon: '✅', cls: 'type-bool' },
    'boolean': { icon: '✅', cls: 'type-bool' },
    'lookup': { icon: '🔍', cls: 'type-lookup' },
    'array': { icon: '🍱', cls: 'type-array' },
    'default': { icon: '🔡', cls: 'type-text' }
  },

  // Table/source type icons — SharePoint has sub-keys (list vs library); others are flat.
  // TODO: Add file extension arrays to use in file picker
  TABLE_SOURCE_ICONS: {
    sharepoint: {
      list:    { icon: '📋', title: 'SharePoint List' },
      library: { icon: '📁', title: 'Document Library' }
    },
    json:    { icon: '📚', title: 'JSON' },
    csv:     { icon: '📄', title: 'CSV Spreadsheet' },
    excel:   { icon: '📗', title: 'Excel Spreadsheet' },
    default: { icon: '⏹️', title: 'Table' }
  },

  DATE_MACRO_OPS: [
    { val: 'TODAY', label: '= ☀️ Today', hasInput: false },
    { val: 'THIS_WEEK', label: '= 📆 This Week', hasInput: false },
    { val: 'LAST_WEEK', label: '= 📆 Last Week', hasInput: false },
    { val: 'THIS_BIZ_WEEK', label: '= 👩🏾‍💼 This Business Week', hasInput: false },
    { val: 'LAST_BIZ_WEEK', label: '= 👨🏻‍💼 Last Businss Week', hasInput: false },
    { val: 'THIS_MONTH', label: '= 📅 This Month', hasInput: false },
    { val: 'LAST_MONTH', label: '= 📅 Last Month', hasInput: false },
    { val: 'THIS_YEAR', label: '= 🎂 This Year', hasInput: false },
    { val: 'LAST_YEAR', label: '= 🎂 Last Year', hasInput: false },
    { val: 'THIS_FISCAL', label: '= 📒 This Fiscal Year', hasInput: false },
    { val: 'LAST_FISCAL', label: '= 📒 Last Fiscal Year', hasInput: false },
    { val: 'THIS_ACADEMIC', label: '= 🎓 This Academic Year', hasInput: false },
    { val: 'LAST_ACADEMIC', label: '= 🎓 Last Academic Year', hasInput: false },
    { val: 'PAST_X_DAYS', label: '= ⏳☀️ Past X Days', hasInput: true },
    { val: 'PAST_X_MONTHS', label: '= ⏳📅 Past X Months', hasInput: true },
    { val: 'PAST_X_YEARS', label: '= ⏳🎂 Past X Years', hasInput: true },
    { val: 'PAST_X_FISCAL', label: '= ⏳📒 Past X Fiscal years', hasInput: true }
  ],

  DATE_MACRO_VALS: new Set([
    'TODAY',
    'THIS_WEEK',
    'LAST_WEEK',
    'THIS_BIZ_WEEK',
    'LAST_BIZ_WEEK',
    'THIS_MONTH',
    'LAST_MONTH',
    'THIS_YEAR',
    'LAST_YEAR',
    'THIS_FISCAL',
    'LAST_FISCAL',
    'THIS_ACADEMIC',
    'LAST_ACADEMIC',
    'PAST_X_DAYS',
    'PAST_X_MONTHS',
    'PAST_X_YEARS',
    'PAST_X_FISCAL'
  ])
  
} // End DataLaVistaCore


/* ===== STATE ===== */
//const dlvRawState = {
const DataLaVistaState = {
  dataSources: {},   // dsName -> { type, url, auth, token, fileName, alias, tables: [internalTableKeys] },											  
  tables: {},        // internalName -> { displayName, alias, fields: [], data: [], loaded: false }
  queryMode: 'basic',
  basicQB: { // Basic Query Builder
    tableName: null,
    selectedFields: [],
    fieldAggs: {},
    conditions: [],
    sorts: [],
    groupBy: [],
    rowLimit: 500
  },
  advancedQB: { // Advanced Query Builder
    nodes: {},
    joins: [],
    activeJoinIdx: -1,
    rowLimit: 500
  },
  sql: '',
  sqlLocked: false,
  queryColumns: [],
  design: {
    title: '',
    widgets: [],     // widget objects
    filters: [],     // { field, label, position }  — preview filter bar chips
    conditions: [],  // { conj, field, op, value }  — design-level data filter
    sorts: [],       // { field, dir }              — design-level sort
    groupBy: [],     // string[]                    — design-level group by
    fieldAggs: {},   // { [col]: aggVal }           — design-level aggregates
    transformedResults: null  // cached result of applyDesignTransforms()
  },
  currentWidgetId: null,
  previewFilters: {},  // field -> value
  activeTab: 'query',
  qbCollapsed: false,
  qbSectionHeight: 60,  // percent
  charts: {},   // widgetId -> echarts instance
  isSpSite: false, // true if we detect we're running inside a SharePoint site (based on URL and/or presence of SharePoint JS objects)
  spSiteUrl: null, // if isSpSite=true, this holds the detected SharePoint site URL; otherwise null
  spPageMode: null,  // 'view' or 'edit' (only relevant if isSpSite=true)
  reportMode: 'view', // 'view' or 'edit' (can be set via ?reportMode=<val> param; defaults to 'view')
  reportUrl: null, // if ?report=<url> param is provided, this holds the URL of the report being edited
  relationships: [], // auto-detected and manual relationships: [{ id, source, childTableKey, childField, parentTableKey, parentField, joinType, spLookupField }]
  _initialized: false
}; // End dlvRawState





// ============================================================
// CONSTANTS
// ============================================================
const ALASQL_KEYWORDS = [
  'ATTACH', 'DETACH', 'SHOW', 'TABLES', 'DATABASES', 'FROM', 'SELECT', 'WHERE',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'FULL', 'CROSS', 'ON', 'AS', 'DISTINCT', 'ALL', 'UNION',
  'INTERSECT', 'EXCEPT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'VIEW', 'IF',
  'EXISTS', 'NOT', 'AND', 'OR', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'CONVERT', 'TOP', 'WITH', 'ROLLUP',
  'CUBE', 'GROUPING', 'SETS', 'PIVOT', 'UNPIVOT', 'OVER', 'PARTITION', 'ROWS',
  'RANGE', 'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'ROW', 'FILTER',
  'WITHIN', 'RECURSIVE', 'LATERAL', 'APPLY', 'TABLESAMPLE', 'PERCENT',
  'TIES', 'FETCH', 'FIRST', 'NEXT', 'ONLY', 'ROWS', 'ONLY', 'SKIP', 'ARRAY',
  'MATRIX', 'OF', 'STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'OBJECT', 'SEARCH',
  'REPLACE', 'REMOVE', 'RENAME', 'MODIFY', 'REINDEX', 'TRUNCATE', 'BEGIN',
  'COMMIT', 'ROLLBACK', 'TRANSACTION', 'SAVEPOINT', 'RELEASE', 'INCLUDES'
];

const AGG_OPTIONS = ['', 'COUNT', 'COUNT(DISTINCT)', 'SUM', 'AVG', 'MEDIAN', 'MIN', 'MAX', 'FIRST', 'LAST', 'STDEV', 'VAR'];



/** Returns the TABLE_SOURCE_ICONS entry for a table object from DataLaVistaState.tables. */
function getTableIcon(t) {
  if (t.sourceType === 'sharepoint') {
    return DataLaVistaCore.TABLE_SOURCE_ICONS.sharepoint[t.isDocLib ? 'library' : 'list'];
  }
  return DataLaVistaCore.TABLE_SOURCE_ICONS[t.sourceType] || DataLaVistaCore.TABLE_SOURCE_ICONS.default;
}



const SKIP_FIELDS = new Set([
  'ItemChildCount', 'FolderChildCount', 'Attachments', 'MetaInfo', 'DocIcon',
  'AppAuthor', 'AppEditor', 'Edit', 'ContentType', 'TemplateUrl', 'xd_ProgID',
  'xd_Signature', 'HTML_x0020_File_x0020_Type', '_ModerationStatus',
  '_ModerationComments', 'InstanceID', 'Order', 'GUID', 'WorkflowVersion',
  'WorkflowInstanceID', 'ParentVersionString', 'ParentLeafName',
  'CheckedOutUserId', 'IsCheckedoutToLocal', 'UniqueId', 'SyncClientId',
  'ProgId', 'ScopeId', 'FileRef', 'FileDirRef', 'Last_x0020_Modified',
  'Created_x0020_Date', 'FSObjType', 'SortBehavior', 'FileLeafRef',
  'OriginatorId', 'NoExecute', 'ContentVersion', 'UIVersionString',
  'AccessPolicy', '_UIVersionString', 'ParentUniqueId', '_Level',
  'IsCurrentVersion', 'ItemChildCount', 'FolderChildCount',
  'ColorTag', '_ColorTag', '_IsRecord', '_LabelAppliedBy', '_LabelSetting',
  'ComplianceAssetId', '_ComplianceFlags', '_ComplianceTag', '_ComplianceTagWrittenTime',
  '_ComplianceTagUserId', '_IsRecord', '_SysVersion', 'OData__SysVersion'
]);

const QB_AGGS = [
  { val: '', label: '— none —', types: 'all' },
  { val: 'COUNT', label: 'COUNT', types: 'all' },
  { val: 'COUNT_DISTINCT', label: 'COUNT DISTINCT', types: 'all' },
  { val: 'FIRST', label: 'FIRST', types: 'all' },
  { val: 'LAST', label: 'LAST', types: 'all' },
  { val: 'MAX', label: 'MAX  (Maximum)', types: 'ordered' },
  { val: 'MIN', label: 'MIN  (Minimum)', types: 'ordered' },
  { val: 'SUM', label: 'SUM  (Sum)', types: 'numeric' },
  { val: 'AVG', label: 'AVG  (Average)', types: 'numeric' },
  { val: 'MEDIAN', label: 'MEDIAN', types: 'numeric' },
  { val: 'VAR', label: 'VAR  (Variance)', types: 'numeric' },
  { val: 'STDEV', label: 'STDEV  (Std Dev)', types: 'numeric' }
];

// ============================================================
// SAFE JSON HELPERS
// ============================================================
/**
 * Safely parse drag-and-drop dataTransfer payload.
 * Returns null (never throws) if the data is missing, empty,
 * "[object Object]", or otherwise not valid JSON.
 */
function safeDragParse(event) {
  try {
    const raw = event && event.dataTransfer
      ? (event.dataTransfer.getData('application/x-datalavista') ||
        event.dataTransfer.getData('text/plain') || '')
      : '';
    if (!raw || raw === '[object Object]' || raw.trim()[0] !== '{') return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Safely set drag data on both our custom MIME type and text/plain.
 * Always call this instead of raw setData so safeDragParse works.
 */
function safeDragSet(event, obj) {
  const json = JSON.stringify(obj);
  try { event.dataTransfer.setData('application/x-datalavista', json); } catch (e) { }
  try { event.dataTransfer.setData('text/plain', json); } catch (e) { }
}

/**
 * Parse a JSON string from user input — shows a friendly error instead of throwing.
 */
function safeJSONParse(str, label) {
  try {
    if (!str || typeof str !== 'string' || !str.trim()) throw new Error('Empty input');
    return JSON.parse(str);
  } catch (e) {
    toast((label || 'JSON') + ' parse error: ' + e.message, 'error');
    return null;
  }
}
