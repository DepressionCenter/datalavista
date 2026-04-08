/* ============================================================
This file is part of DataLaVista™
10-constants.js: Constants, state object, and core DataLaVista objects.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-05
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

  ALASQL_KEYWORDS: [
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
  'COMMIT', 'ROLLBACK', 'TRANSACTION', 'SAVEPOINT', 'RELEASE',
  'DLV_ARRAY_MATCH', 'DLV_ARRAY_EMPTY', 'DLV_INCLUDES', 'DLV_JOIN', 'DLV_KEYS',
  'DLV_DROP', 'DLV_DISPLAY', 'DLV_IDS', 
  'DLV_EMAIL','DLV_EMAILS', 'DLV_PICTURE_URL','DLV_NORMALIZE_DATE',
  'DLV_TAX_LABELS','DLV_TAX_IDS','DLV_PARSE_BOOL', 'DLV_PARSE_DATE'
],

// Base Aggregation Options for Query Builder (used in field picker dropdowns and design-level aggregates)
QB_AGGS: [
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
],

// Base Filter Conditions
QB_OPS: [
{ val: '=', label: '= equals' },
{ val: '!=', label: '≠ not equals' },
{ val: '>', label: '> greater than' },
{ val: '<', label: '< less than' },
{ val: '>=', label: '≥ greater or equal' },
{ val: '<=', label: '≤ less or equal' },
{ val: 'LIKE', label: '~ contains' },
{ val: 'NULL', label: '∅ is blank' },
{ val: 'NOTNULL', label: '✓ is not blank' },
],

// Additional filter options, applicable only to date data types
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

  // Work around for Set lookup since DATE_MACRO_OPS is an array of objects
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
  ]),

// Fields to skip when auto-detecting field types and relationships in SharePoint lists/libraries and JSON,
// as they are typically non-informative for visualization and can cause noise in type/relationship
// inference due to their special formats and values.
SKIP_FIELDS: new Set([
  "_ColorTag",
  "_ComplianceFlags",
  "_ComplianceTag",
  "_ComplianceTagUserId",
  "_ComplianceTagWrittenTime",
  "_IsRecord",
  "_LabelAppliedBy",
  "_LabelSetting",
  "_Level",
  "_ModerationComments",
  "_ModerationStatus",
  "_SysFlow",
  "_SysProfile",
  "_SysVersion",
  "_UIVersionString",
  "AccessPolicy",
  "AppAuthor",
  "AppEditor",
  "Author@odata.navigationLinkUrl",
  "CheckedOutUser",
  "CheckedOutUserId",
  "CheckoutUser",
  "CheckoutUserId",
  "ColorTag",
  "ComplianceAssetId",
  "ContentType",
  "ContentVersion",
  "Created_x0020_Date",
  "DocIcon",
  "Edit",
  "Editor@odata.navigationLinkUrl",
  "FSObjType",
  "FolderChildCount",
  "GUID",
  "HTML_x0020_File_x0020_Type",
  "ImageTags",
  "InstanceID",
  "IsCheckedoutToLocal",
  "IsCurrentVersion",
  "ItemChildCount",
  "Last_x0020_Modified",
  "MediaServiceImageTags",
  "MediaServiceLocation",
  "MetaInfo",
  "NoExecute",
  "OData__SysFlow",
  "OData__SysProfile",
  "OData__SysVersion",
  "Order",
  "OriginatorId",
  "ParentLeafName",
  "ParentUniqueId",
  "ParentVersionString",
  "ProgId",
  "ScopeId",
  "SortBehavior",
  "SourceNameConvertedDocument",
  "SourceNameConvertedDocumentId",
  "Source Version (Converted Document)",
  "SyncClientId",
  "TemplateUrl",
  "UIVersionString",
  "UniqueId",
  "WorkflowInstanceID",
  "WorkflowVersion",
  "odata.editLink",
  "odata.etag",
  "odata.id",
  "odata.link",
  "odata.navigationLinkUrl",
  "odata.type",
  "xd_ProgID",
  "xd_Signature"
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
    showDashboardTitle: true,   // whether the title bar is visible in preview/report mode
    dashboardTitleTooltip: '',  // optional HTML tooltip (sanitized) shown via info icon next to title
    widgets: [],     // widget objects
    filters: []      // { field, label, position }  — preview filter bar chips
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
  drillFilters: {},  // cross-widget click filters: { fieldName: value } — rebuilt on every chart/table click
  _initialized: false
}; // End dlvRawState

/** Returns the TABLE_SOURCE_ICONS entry for a table object from DataLaVistaState.tables. */
function getTableIcon(t) {
  if (t.sourceType === 'sharepoint') {
    return DataLaVistaCore.TABLE_SOURCE_ICONS.sharepoint[t.isDocLib ? 'library' : 'list'];
  }
  return DataLaVistaCore.TABLE_SOURCE_ICONS[t.sourceType] || DataLaVistaCore.TABLE_SOURCE_ICONS.default;
}

/**
 * Return the appropriate operator list for a given field display type.
 * @param {string} displayType - 'text','number','boolean','date','array', or subtype
 * @param {object} [options]
 * @param {boolean} [options.forArrayElement] - true for 2.6.1 element ops:
 *   excludes BETWEEN, date macros, and text string-match ops (contains/starts/ends).
 */
function getFilterOps(displayType = 'text', options = {}) {
  const { forArrayElement = false } = options;
  const dt = (displayType || 'text').toLowerCase();

  if (dt === 'boolean') {
    return [
      { val: '=',       label: '= equals' },
      { val: '!=',      label: '≠ not equals' },
      { val: 'NULL',    label: '∅ is blank' },
      { val: 'NOTNULL', label: '✓ is not blank' },
    ];
  }

  if (dt === 'number') {
    const ops = [
      { val: '=',   label: '= equals' },
      { val: '!=',  label: '≠ not equals' },
      { val: '>',   label: '> greater than' },
      { val: '>=',  label: '≥ greater or equal' },
      { val: '<',   label: '< less than' },
      { val: '<=',  label: '≤ less or equal' },
    ];
    if (!forArrayElement) ops.push({ val: 'BETWEEN', label: '⟷ is between' });
    ops.push(
      { val: 'NULL',    label: '∅ is blank' },
      { val: 'NOTNULL', label: '✓ is not blank' },
    );
    return ops;
  }

  if (dt === 'date') {
    const ops = [
      { val: '=',   label: '= equals' },
      { val: '!=',  label: '≠ not equals' },
      { val: '>',   label: '> after' },
      { val: '>=',  label: '≥ on or after' },
      { val: '<',   label: '< before' },
      { val: '<=',  label: '≤ on or before' },
    ];
    if (!forArrayElement) ops.push({ val: 'BETWEEN', label: '⟷ is between' });
    ops.push(
      { val: 'NULL',    label: '∅ is blank' },
      { val: 'NOTNULL', label: '✓ is not blank' },
    );
    if (!forArrayElement) ops.push(...DataLaVistaCore.DATE_MACRO_OPS);
    return ops;
  }

  // Generic array — # of elements + is empty / is not empty (2.6.3)
  if (dt === 'array') {
    return [
      { val: 'ARR_LEN_EQ',    label: '# of elements equal to' },
      { val: 'ARR_LEN_NE',    label: '# of elements not equals' },
      { val: 'ARR_LEN_GT',    label: '# of elements greater than' },
      { val: 'ARR_LEN_GTE',   label: '# of elements greater or equal' },
      { val: 'ARR_LEN_LT',    label: '# of elements less than' },
      { val: 'ARR_LEN_LTE',   label: '# of elements less or equal' },
      { val: 'ARR_EMPTY',     label: 'is empty',     noInput: true },
      { val: 'ARR_NOT_EMPTY', label: 'is not empty', noInput: true },
    ];
  }

  // Text (default) — full string-match ops unless forArrayElement
  const ops = [
    { val: '=',   label: '= equals' },
    { val: '!=',  label: '≠ not equals' },
  ];
  if (!forArrayElement) {
    ops.push(
      { val: 'STARTS_WITH',     label: '↦ starts with' },
      { val: 'NOT_STARTS_WITH', label: '↦ does not start with' },
      { val: 'ENDS_WITH',       label: '⇥ ends with' },
      { val: 'NOT_ENDS_WITH',   label: '⇥ does not end with' },
      { val: 'CONTAINS',        label: '~ contains' },
      { val: 'NOT_CONTAINS',    label: '≁ does not contain' },
    );
  }
  ops.push(
    { val: 'NULL',    label: '∅ is blank' },
    { val: 'NOTNULL', label: '✓ is not blank' },
  );
  return ops;
}

/**
 * Returns grouped ops for array-of-scalar fields (2.6.2).
 * Options include optgroup-aware group property for renderOpsOptions().
 * @param {'text'|'number'|'date'|'boolean'} scalarType
 */
function getArrayScalarOps(scalarType) {
  const st = (scalarType || 'text').toLowerCase();
  const group1 = [];
  if (st === 'number' || st === 'date') {
    group1.push(
      { val: 'ARR_ANY_EQ',  label: 'any element equals',           group: 'By element value' },
      { val: 'ARR_ANY_NE',  label: 'any element not equals',       group: 'By element value' },
      { val: 'ARR_ANY_GT',  label: 'any element greater than',     group: 'By element value' },
      { val: 'ARR_ANY_GTE', label: 'any element greater or equal', group: 'By element value' },
      { val: 'ARR_ANY_LT',  label: 'any element less than',        group: 'By element value' },
      { val: 'ARR_ANY_LTE', label: 'any element less or equal',    group: 'By element value' },
    );
  } else {
    group1.push(
      { val: 'ARR_ANY_EQ', label: 'any element equals',     group: 'By element value' },
      { val: 'ARR_ANY_NE', label: 'any element not equals', group: 'By element value' },
    );
  }
  return [
    ...group1,
    { val: 'ARR_LEN_EQ',    label: '# of elements equal to',         group: 'By # of elements' },
    { val: 'ARR_LEN_NE',    label: '# of elements not equals',       group: 'By # of elements' },
    { val: 'ARR_LEN_GT',    label: '# of elements greater than',     group: 'By # of elements' },
    { val: 'ARR_LEN_GTE',   label: '# of elements greater or equal', group: 'By # of elements' },
    { val: 'ARR_LEN_LT',    label: '# of elements less than',        group: 'By # of elements' },
    { val: 'ARR_LEN_LTE',   label: '# of elements less or equal',    group: 'By # of elements' },
    { val: 'ARR_EMPTY',     label: 'is empty',     noInput: true, group: 'Array' },
    { val: 'ARR_NOT_EMPTY', label: 'is not empty', noInput: true, group: 'Array' },
  ];
}

/**
 * Render <option> / <optgroup> HTML for an ops array.
 * Ops with a .group property are wrapped in <optgroup> elements.
 */
function renderOpsOptions(ops, selectedVal) {
  let html = '';
  let currentGroup = null;
  for (const o of ops) {
    const grp = o.group || null;
    if (grp !== currentGroup) {
      if (currentGroup !== null) html += '</optgroup>';
      if (grp !== null) html += `<optgroup label="${grp}">`;
      currentGroup = grp;
    }
    html += `<option value="${o.val}" ${o.val === selectedVal ? 'selected' : ''}>${o.label}</option>`;
  }
  if (currentGroup !== null) html += '</optgroup>';
  return html;
}

/**
 * Build the value-input HTML for a filter condition row.
 * @param {string}  displayType   'boolean','date','number','text',…
 * @param {boolean} isMacro       c.op is a date-macro operator
 * @param {object}  macroMeta     DATE_MACRO_OPS entry (may be undefined)
 * @param {string}  value         Current condition value
 * @param {string}  handlerJS     JS for oninput/onchange (uses this.value)
 * @param {object}  [options]
 * @param {string}  [options.op]            Current op (needed for BETWEEN)
 * @param {string}  [options.value2]        Second value for BETWEEN
 * @param {string}  [options.val2HandlerJS] JS handler for second BETWEEN input
 * @param {string}  [options.tableKey]      For autosuggestions on text inputs
 * @param {string}  [options.fieldAlias]    For autosuggestions
 * @param {string}  [options.elementKey]    For autosuggestions on array element keys
 */
function buildFilterValueInput(displayType, isMacro, macroMeta, value, handlerJS, options = {}) {
  const { op = '', value2 = '', val2HandlerJS = '', tableKey = '', fieldAlias = '', elementKey = '' } = options;
  const safeVal  = (value  != null ? String(value)  : '').replace(/"/g, '&quot;');
  const safeVal2 = (value2 != null ? String(value2) : '').replace(/"/g, '&quot;');
  const sep = `<span class="qb-between-sep" style="font-size:11px;color:var(--text-secondary);white-space:nowrap;padding:0 2px">and</span>`;

  // Boolean — true/false only, default true
  if (displayType === 'boolean') {
    return `<select class="form-input qb-val-input" onchange="${handlerJS}">
      <option value="true"  ${(!value || value === 'true')  ? 'selected' : ''}>True</option>
      <option value="false" ${value === 'false' ? 'selected' : ''}>False</option>
    </select>`;
  }

  // Date-macro with numeric input
  if (isMacro) {
    return macroMeta?.hasInput
      ? `<input type="number" class="form-input qb-val-input" placeholder="e.g. 3" min="1" value="${safeVal}" oninput="${handlerJS}"/>`
      : `<span class="qb-val-blank"></span>`;
  }

  // Date
  if (displayType === 'date') {
    if (op === 'BETWEEN') {
      return `<input type="date" class="form-input qb-val-input qb-between-input" value="${safeVal}" onchange="${handlerJS}"/>`
           + sep
           + `<input type="date" class="form-input qb-val-input qb-between-input" value="${safeVal2}" onchange="${val2HandlerJS}"/>`;
    }
    return `<input type="date" class="form-input qb-val-input" value="${safeVal}" onchange="${handlerJS}"/>`;
  }

  // Number
  if (displayType === 'number') {
    if (op === 'BETWEEN') {
      return `<input type="number" class="form-input qb-val-input qb-between-input" step="any" value="${safeVal}" oninput="${handlerJS}"/>`
           + sep
           + `<input type="number" class="form-input qb-val-input qb-between-input" step="any" value="${safeVal2}" oninput="${val2HandlerJS}"/>`;
    }
    return `<input type="number" class="form-input qb-val-input" step="any" value="${safeVal}" oninput="${handlerJS}"/>`;
  }

  // Array-length ops — integer only
  if (op && op.startsWith('ARR_LEN_')) {
    return `<input type="number" class="form-input qb-val-input" min="0" step="1" value="${safeVal}" oninput="${handlerJS}"/>`;
  }

  // Array any-element ops — numeric/date input for number or date scalar
  if (op && op.startsWith('ARR_ANY_')) {
    if (displayType === 'number') {
      return `<input type="number" class="form-input qb-val-input" step="any" value="${safeVal}" oninput="${handlerJS}"/>`;
    }
    if (displayType === 'date') {
      return `<input type="date" class="form-input qb-val-input" value="${safeVal}" onchange="${handlerJS}"/>`;
    }
  }

  // Text — with optional autosuggestions via <datalist>
  if (tableKey && fieldAlias) {
    const safeId = (tableKey + '__' + fieldAlias + (elementKey ? '__' + elementKey : '')).replace(/[^a-zA-Z0-9_-]/g, '_');
    const listId = 'dlv-sug-' + safeId;
    const tkSafe = tableKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const faSafe = fieldAlias.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const ekSafe = elementKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const onFocus = `loadFilterSuggestions(this,'${tkSafe}','${faSafe}','${ekSafe}',1000)`;
    return `<input type="text" class="form-input qb-val-input" placeholder="value" value="${safeVal}"`
         + ` list="${listId}" onfocus="${onFocus}" oninput="${handlerJS}"/>`
         + `<datalist id="${listId}"></datalist>`;
  }

  return `<input type="text" class="form-input qb-val-input" placeholder="value" value="${safeVal}" oninput="${handlerJS}"/>`;
}

// ============================================================
// FILTER HELPER FUNCTIONS
// ============================================================

/**
 * Sniff the element type of a JavaScript array.
 * Returns: 'object-array' | 'number' | 'date' | 'boolean' | 'string' | 'array-array' | 'unknown'
 */
function sniffArrayType(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'unknown';
  const samples = arr.filter(v => v != null).slice(0, 20);
  if (!samples.length) return 'unknown';
  if (samples.some(v => Array.isArray(v))) return 'array-array';
  if (samples.some(v => typeof v === 'object' && !Array.isArray(v))) return 'object-array';
  const isoRe = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
  if (samples.every(v => typeof v === 'boolean' || (typeof v === 'string' && (v.toLowerCase() === 'true' || v.toLowerCase() === 'false')))) return 'boolean';
  if (samples.every(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(+v) && !isoRe.test(v)))) return 'number';
  if (samples.every(v => typeof v === 'string' && isoRe.test(v))) return 'date';
  if (samples.every(v => typeof v === 'string')) return 'string';
  return 'unknown';
}

/**
 * Get a sample array value from a table's raw data for a given internal field name.
 * Returns null if data is not loaded or no array values are found.
 */
function getArraySampleForField(tableKey, fieldInternalName) {
  const t = DataLaVistaState.tables[tableKey];
  if (!t || !t.data || !t.data.length) return null;
  for (const row of t.data) {
    const val = row[fieldInternalName];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return null;
}

/**
 * Extract sorted object-key metadata from a sample array of objects.
 * Returns [{key, type}] excluding keys whose values are objects or arrays.
 */
function getObjectKeysFromSample(arr) {
  const sample = Array.isArray(arr)
    ? arr.find(v => v != null && typeof v === 'object' && !Array.isArray(v))
    : (arr && typeof arr === 'object' && !Array.isArray(arr) ? arr : null);
  if (!sample) return [];
  return Object.keys(sample)
    .filter(k => { const v = sample[k]; return v == null || (typeof v !== 'object' && !Array.isArray(v)); })
    .sort()
    .map(k => {
      if (k.toLowerCase() === 'id') return { key: k, type: 'number' };
      const v = sample[k];
      return { key: k, type: typeof v === 'number' ? 'number' : (typeof v === 'boolean' ? 'boolean' : 'text') };
    });
}

/**
 * Return sorted [{key, type}] entries for an object or array-of-objects field.
 * Checks SP-specific displayType presets first, then samples raw data.
 * @param {string} tableKey
 * @param {string} fieldAlias   The field's alias (as used in cols/conditions)
 * @param {string} displayType  Field displayType string
 */
function getObjectKeysForField(tableKey, fieldAlias, displayType) {
  const dt = (displayType || '').toLowerCase();
  // SP lookup / person / taxonomy presets
  if (dt === 'lookup' || dt === 'lookup-multi')
    return [{ key: 'Id', type: 'number' }, { key: 'Title', type: 'text' }];
  if (dt === 'person' || dt === 'person-multi')
    return [{ key: 'Id', type: 'number' }, { key: 'Title', type: 'text' }, { key: 'Name', type: 'text' }, { key: 'Email', type: 'text' }];
  if (dt === 'taxonomyfieldtypemulti' || dt === 'taxonomyfieldtype' || dt === 'taxonomyfield' || dt === 'taxonomy' || dt === 'taxkeyword' || dt === 'taxonomy-multi' || dt === 'taxkeyword-multi')
    return [{ key: 'TermGuid', type: 'text' }, { key: 'Label', type: 'text' }];

  if (!tableKey) return [];
  const t = DataLaVistaState.tables[tableKey];
  if (!t || !t.data || !t.data.length) return [];

  // Find internal name for alias
  const fieldMeta = t.fields && t.fields.find(f => f.alias === fieldAlias);
  const internalName = fieldMeta ? fieldMeta.internalName : fieldAlias;

  for (const row of t.data) {
    const val = row[internalName];
    if (val == null) continue;
    // Array of objects
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && !Array.isArray(val[0])) {
      return getObjectKeysFromSample(val[0]);
    }
    // Plain object
    if (typeof val === 'object' && !Array.isArray(val)) {
      return getObjectKeysFromSample(val);
    }
  }
  return [];
}

/**
 * Classify a field's displayType into a structured info object used by
 * renderConditionRows and condToSQL.
 * Always returns a complete object: { baseType, isObject, isArrayObjects, isArrayScalar, scalarType, objectKeys }
 */
function classifyDisplayType(displayType, tableKey, fieldInternalName, fieldAlias) {
  const dt = (displayType || 'text').toLowerCase();
  const _base = (bt, extra) => Object.assign(
    { baseType: bt, isObject: false, isArrayObjects: false, isArrayScalar: false, scalarType: null, objectKeys: null },
    extra
  );
  const _arrObjTypes = ['lookup','lookup-multi','person','person-multi','taxonomy','taxkeyword','taxonomy-multi','taxkeyword-multi'];

  if (dt === 'boolean') return _base('boolean');
  if (dt === 'number')  return _base('number');
  if (dt === 'date')    return _base('date');

  if (_arrObjTypes.includes(dt))
    return _base('array-objects', { isArrayObjects: true, objectKeys: getObjectKeysForField(tableKey, fieldAlias, dt) });

  if (dt === 'object')
    return _base('object', { isObject: true, objectKeys: getObjectKeysForField(tableKey, fieldAlias, 'object') });

  if (dt === 'array-number')  return _base('array-scalar', { isArrayScalar: true, scalarType: 'number' });
  if (dt === 'array-date')    return _base('array-scalar', { isArrayScalar: true, scalarType: 'date' });
  if (dt === 'array-string')  return _base('array-scalar', { isArrayScalar: true, scalarType: 'text' });
  if (dt === 'array-boolean') return _base('array-scalar', { isArrayScalar: true, scalarType: 'boolean' });

  if (dt === 'array') {
    const internalName = (() => {
      if (!tableKey) return fieldInternalName || fieldAlias;
      const t = DataLaVistaState.tables[tableKey];
      const f = t && t.fields && t.fields.find(x => x.alias === fieldAlias);
      return f ? f.internalName : (fieldInternalName || fieldAlias);
    })();
    const sample = getArraySampleForField(tableKey, internalName);
    if (sample) {
      const arrType = sniffArrayType(sample);
      if (arrType === 'object-array') return _base('array-objects', { isArrayObjects: true, objectKeys: getObjectKeysFromSample(sample) });
      if (arrType === 'number')  return _base('array-scalar', { isArrayScalar: true, scalarType: 'number' });
      if (arrType === 'date')    return _base('array-scalar', { isArrayScalar: true, scalarType: 'date' });
      if (arrType === 'string')  return _base('array-scalar', { isArrayScalar: true, scalarType: 'text' });
      if (arrType === 'boolean') return _base('array-scalar', { isArrayScalar: true, scalarType: 'boolean' });
    }
    return _base('array-other');
  }

  // text / default / unknown
  return _base('text');
}

/**
 * Find the table key that contains a field with the given alias.
 * Returns null if not found.
 */
function findTableKeyForAlias(alias) {
  for (const [tkey, t] of Object.entries(DataLaVistaState.tables)) {
    if (t.fields && t.fields.some(f => f.alias === alias)) return tkey;
  }
  return null;
}

/**
 * Build a LIKE pattern from user input.
 * Quoted values use ~-escape for % and _; unquoted values treat * as % and ? as _.
 * @param {string} raw       Raw user input
 * @param {'contains'|'starts'|'ends'} matchType
 * @returns {{ pat: string, esc: boolean }}
 */
function _buildLikePat(raw, matchType) {
  const dblQ = raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2;
  const sglQ = raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2;
  if (dblQ || sglQ) {
    let s = raw.slice(1, -1).replace(/'/g, "''").replace(/%/g, '~%').replace(/_/g, '~_');
    const pat = matchType === 'starts' ? s + '%' : matchType === 'ends' ? '%' + s : '%' + s + '%';
    return { pat, esc: true };
  }
  let s = raw.replace(/'/g, "''").replace(/\*/g, '%').replace(/\?/g, '_');
  const pat = matchType === 'starts' ? s + '%' : matchType === 'ends' ? '%' + s : '%' + s + '%';
  return { pat, esc: false };
}

/** Format a raw string value for safe use in a SQL literal. */
function _fmtSQLVal(raw, displayType) {
  if (raw === 'true' || raw === 'false') return raw;
  if ((displayType === 'number') && raw !== '' && !isNaN(raw)) return raw;
  if (raw !== '' && !isNaN(raw) && displayType !== 'text' && displayType !== 'default') return raw;
  return `'${raw.replace(/'/g, "''")}'`;
}

/**
 * Convert a condition object to a SQL WHERE fragment (no leading conjunction).
 * Centralises clause generation so all four SQL-build sites use identical logic.
 * @param {object} c           - {field, op, value, value2, elementKey}
 * @param {string} colExpr     - SQL column expression e.g. [alias].[FieldName]
 * @param {string} displayType - field's displayType for type-aware SQL generation
 */
function condToSQL(c, colExpr, displayType) {
  const op  = c.op  || '=';
  const raw  = c.value  != null ? String(c.value)  : '';
  const raw2 = c.value2 != null ? String(c.value2) : '';
  const ek   = c.elementKey || '';
  const dt   = (displayType || 'text').toLowerCase();

  // ── no-value ops ──────────────────────────────────────────────────────────
  if (op === 'NULL') {
    if (dt === 'number' || dt === 'boolean' || dt === 'date') {
      return `${colExpr} IS NULL`;
    }
    if (dt === 'text' || dt === 'default' || dt === '') {
      return `TRIM(COALESCE(${colExpr}, '')) IN ('', 'null', 'NULL', '\\N', 'undefined', '#N/A', '#NA', '#VALUE!', '#REF!', 'NaN')`;
    }
    return `${colExpr} IS NULL`;
  }
  if (op === 'NOTNULL') {
    if (dt === 'number' || dt === 'boolean' || dt === 'date') {
      return `${colExpr} IS NOT NULL`;
    }
    if (dt === 'text' || dt === 'default' || dt === '') {
      return `TRIM(COALESCE(${colExpr}, '')) NOT IN ('', 'null', 'NULL', '\\N', 'undefined', '#N/A', '#NA', '#VALUE!', '#REF!', 'NaN')`;
    }
    return `${colExpr} IS NOT NULL`;
  }

  // ── date macros ───────────────────────────────────────────────────────────
  if (DataLaVistaCore.DATE_MACRO_VALS.has(op)) {
    return dateMacroToSQL(op, raw, colExpr) || `${colExpr} IS NOT NULL`;
  }

  // ── BETWEEN ───────────────────────────────────────────────────────────────
  if (op === 'BETWEEN') {
    if (dt === 'date') {
      const v1 = raw  ? `'${raw.replace(/'/g, "''")}'`  : 'NULL';
      const v2 = raw2 ? `'${raw2.replace(/'/g, "''")}'` : 'NULL';
      return `${colExpr} BETWEEN ${v1} AND ${v2}`;
    }
    const v1 = raw  !== '' && !isNaN(raw)  ? raw  : '0';
    const v2 = raw2 !== '' && !isNaN(raw2) ? raw2 : '0';
    return `${colExpr} BETWEEN ${v1} AND ${v2}`;
  }

  // ── text match ops ────────────────────────────────────────────────────────
  if (op === 'CONTAINS' || op === 'NOT_CONTAINS') {
    const not = op === 'NOT_CONTAINS' ? 'NOT ' : '';
    const { pat, esc } = _buildLikePat(raw, 'contains');
    return esc ? `${colExpr} ${not}LIKE '${pat}' ESCAPE '~'` : `${colExpr} ${not}LIKE '${pat}'`;
  }
  if (op === 'STARTS_WITH' || op === 'NOT_STARTS_WITH') {
    const not = op === 'NOT_STARTS_WITH' ? 'NOT ' : '';
    const { pat, esc } = _buildLikePat(raw, 'starts');
    return esc ? `${colExpr} ${not}LIKE '${pat}' ESCAPE '~'` : `${colExpr} ${not}LIKE '${pat}'`;
  }
  if (op === 'ENDS_WITH' || op === 'NOT_ENDS_WITH') {
    const not = op === 'NOT_ENDS_WITH' ? 'NOT ' : '';
    const { pat, esc } = _buildLikePat(raw, 'ends');
    return esc ? `${colExpr} ${not}LIKE '${pat}' ESCAPE '~'` : `${colExpr} ${not}LIKE '${pat}'`;
  }

  // ── legacy LIKE (~ contains) ──────────────────────────────────────────────
  if (op === 'LIKE') {
    return `${colExpr} LIKE '%${raw.replace(/'/g, "''")}%'`;
  }

  // ── array empty/not-empty ─────────────────────────────────────────────────
  if (op === 'ARR_EMPTY')     return `DLV_ARRAY_EMPTY(${colExpr}) = true`;
  if (op === 'ARR_NOT_EMPTY') return `DLV_ARRAY_EMPTY(${colExpr}) = false`;

  // ── array scalar — any-element comparisons ────────────────────────────────
  if (op.startsWith('ARR_ANY_')) {
    const aop = { ARR_ANY_EQ:'=', ARR_ANY_NE:'!=', ARR_ANY_GT:'>', ARR_ANY_GTE:'>=', ARR_ANY_LT:'<', ARR_ANY_LTE:'<=' }[op] || '=';
    const v = _fmtSQLVal(raw, dt);
    return `DLV_ARRAY_MATCH(${colExpr}, '${aop}', ${v})`;
  }

  // ── array scalar — # of elements comparisons ─────────────────────────────
  if (op.startsWith('ARR_LEN_')) {
    const lop = { ARR_LEN_EQ:'=', ARR_LEN_NE:'!=', ARR_LEN_GT:'>', ARR_LEN_GTE:'>=', ARR_LEN_LT:'<', ARR_LEN_LTE:'<=' }[op] || '=';
    const v = raw !== '' && !isNaN(raw) ? raw : '0';
    return `${colExpr}->length ${lop} ${v}`;
  }

  // ── array-of-objects — DLV_INCLUDES ──────────────────────────────────────
  if (ek && ['=','!=','>','>=','<','<='].includes(op)) {
    const v = _fmtSQLVal(raw, dt);
    if (op === '=') return `DLV_INCLUDES(${colExpr}, '${ek}', ${v})`;
    return `DLV_INCLUDES(${colExpr}, '${ek}', ${v}, '${op}')`;
  }

  // ── standard comparison ────────────────────────────────────────────────────
  const val = _fmtSQLVal(raw, dt);
  return `${colExpr} ${op} ${val}`;
}

/**
 * Populate a <datalist> with distinct field values for filter autosuggestions.
 * Called onfocus on text filter inputs. Runs once per datalist (idempotent).
 * @param {HTMLInputElement} inputEl
 * @param {string} tableKey        Raw table key (or empty string for dlv_results)
 * @param {string} fieldAlias      Field alias / column name
 * @param {string} [elementKey]    For array-of-objects: query col->elementKey
 * @param {number} [limit]         Max distinct values (default 1000)
 */
function loadFilterSuggestions(inputEl, tableKey, fieldAlias, elementKey, limit) {
  const listId = inputEl && inputEl.getAttribute('list');
  if (!listId) return;
  const dl = document.getElementById(listId);
  if (!dl || dl.dataset.loaded) return;
  dl.dataset.loaded = '1'; // mark before query to prevent double-fire

  const lim = limit || 1000;
  const fa  = fieldAlias || '';
  const ek  = elementKey || '';

  try {
    // Determine FROM source
    let fromSrc = null;
    if (tableKey) {
      const vname = (typeof CyberdynePipeline !== 'undefined' && CyberdynePipeline.rawTableToView && CyberdynePipeline.rawTableToView[tableKey])
        || tableKey;
      if (alasql.tables && alasql.tables[vname]) fromSrc = `[${vname}]`;
    }
    if (!fromSrc) {
      if (alasql.tables && alasql.tables['dlv_active'])   fromSrc = '[dlv_active]';
      else if (alasql.tables && alasql.tables['dlv_results']) fromSrc = '[dlv_results]';
    }
    if (!fromSrc) return;

    const col    = ek ? `[${fa}]->${ek}` : `[${fa}]`;
    const lenFn  = `LENGTH('' + ${col})`;
    const sql    = `SELECT DISTINCT ${col} AS col FROM ${fromSrc} WHERE ${col} IS NOT NULL AND ${lenFn} < 50 ORDER BY col LIMIT ${lim}`;
    const rows   = alasql(sql);
    const frag   = document.createDocumentFragment();
    for (const r of rows) {
      if (r.col != null && r.col !== '') {
        const opt = document.createElement('option');
        opt.value = String(r.col);
        frag.appendChild(opt);
      }
    }
    dl.appendChild(frag);
  } catch (_) {
    // Silently fail — data may not be loaded yet
  }
}


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

/* Misc. Helpers */

// Compare two values with SQL-like operators, treating null/undefined as SQL NULL (null = null is true, but null < 5 is false).
function sqlCompare(a, op, b) {
    // Null checks
    if (op === '='  || op === '==') return a == null ? b == null : a === b;  // null = null is true
    if (op === '!=' || op === '<>') return a == null ? b != null : a !== b;
    if (a == null || b == null) return false; // < > <= >= against null is always false

    const aNum = parseFloat(a);
    const bNum = parseFloat(b);
    const useNumeric = !isNaN(aNum) && !isNaN(bNum);

    const lhs = useNumeric ? aNum : String(a);
    const rhs = useNumeric ? bNum : String(b);

    switch (op) {
        case '<':  return lhs <  rhs;
        case '<=': return lhs <= rhs;
        case '>':  return lhs >  rhs;
        case '>=': return lhs >= rhs;
        default:   return false;
    }
}