/* ============================================================
This file is part of DataLaVista™
30-config.js: Widget SQL generation, configuration save/load, and fields panel rendering.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
Summary: Widget SQL generation, configuration save/load, and fields panel rendering.
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
// ============================================================
// PER-WIDGET SQL GENERATOR
// ============================================================
function generateWidgetSQL(w, tableRef = '_results') {
  const q = `[${tableRef}]`;
  if (w.type === 'text' || w.type === 'placeholder' || w.type === 'container') return null;

  const whereParts = [];
  if (w.filters && w.filters.length) {
    for (const f of w.filters) {
      if (f.value !== undefined && f.value !== '' && f.value !== '(All)') {
        const col = `[${f.field}]`;
        const op = f.operator || '=';
        const val = typeof f.value === 'number' ? f.value : `'${String(f.value).replace(/'/g, "''")}'`;
        if (op === 'contains') {
          whereParts.push(`${col} LIKE '%${String(f.value).replace(/'/g, "''")}%'`);
        } else {
          whereParts.push(`${col} ${op} ${val}`);
        }
      }
    }
  }
  const where = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

  if (w.type === 'kpi') {
    const field = (w.fields && w.fields[0]) || '*';
    const agg = (w.aggregation || 'SUM').toUpperCase();
    if (agg === 'COUNT' || field === '*') return `SELECT COUNT(*) AS _value FROM ${q}${where}`;
    if (['FIRST', 'LAST'].includes(agg)) return `SELECT ${agg}([${field}]) AS _value FROM ${q}${where}`;
    return `SELECT ${agg}([${field}]) AS _value FROM ${q}${where}`;
  }

  if (w.type === 'table') {
    const cols = (w.fields && w.fields.length)
      ? w.fields.map(f => `[${f}]`).join(', ')
      : '*';
    return `SELECT ${cols} FROM ${q}${where}`;
  }

  if (isEChartsWidget(w.type) && w.type !== 'scatter') {
  const xField = w.xField;
  const yFields = (Array.isArray(w.yFields) && w.yFields.length) ? w.yFields : (w.yField ? [w.yField] : []);
  if (!xField) return `SELECT * FROM ${q}${where}`;
  if (!yFields.length) return `SELECT [${xField}] FROM ${q}${where}`;
  const agg = (w.aggregation || '').toUpperCase();
  if (!agg || agg === 'NONE') {
    var _ywrapNoAgg = yFields.map(function(f) { return '[' + f + ']'; }).join(', ');
    return 'SELECT [' + xField + '], ' + _ywrapNoAgg + ' FROM ' + q + where;
  }
  const yExprs = yFields.map(f =>
    agg === 'COUNT' ? 'COUNT(*) AS [' + f + ']' : agg + '([' + f + ']) AS [' + f + ']'
  ).join(', ');
  return `SELECT [${xField}], ${yExprs} FROM ${q}${where} GROUP BY [${xField}]`;
}

  if (w.type === 'scatter') {
    const xField = w.xField;
    const yField = w.yField;
    if (!xField || !yField) return `SELECT * FROM ${q}${where}`;
    return `SELECT [${xField}], [${yField}] FROM ${q}${where}`;
  }

  return `SELECT * FROM ${q}${where}`;
}


async function saveConfig() {
  const config = buildConfig();
  const json = JSON.stringify(config, null, 2);

  if (DataLaVistaState.lastPublishedUrl && DataLaVistaState.reportUrl && DataLaVistaState.isSpSite) {
    const reportUrl = DataLaVistaState.reportUrl;
    const siteUrl = DataLaVistaState.spSiteUrl;
    try {
      if (reportUrl.includes('/Lists/')) {
        await _saveConfigToSpList(json, reportUrl, siteUrl);
      } else {
        await _saveConfigToSpFile(json, reportUrl, siteUrl);
      }
      toast('Saved to SharePoint!', 'success');
      setStatus('Report saved to SharePoint.', 'success');
    } catch (err) {
      toast((err && err.message) || 'Save to SharePoint failed.', 'error');
      setStatus('Save to SharePoint failed. See console for details.', 'error');
      console.error('Save to SharePoint failed:', err);
    }
    return;
  }

  downloadText(json, (DataLaVistaState.design.title ? DataLaVistaState.design.title : 'DataLaVista-config') + '.json', 'application/json');
}

async function _saveConfigToSpFile(json, reportUrl, siteUrl) {
  const origin = new URL(siteUrl).origin;
  const serverRelUrl = reportUrl.startsWith(origin) ? reportUrl.slice(origin.length) : reportUrl;
  const lastSlash = serverRelUrl.lastIndexOf('/');
  const folderRelUrl = serverRelUrl.substring(0, lastSlash);
  const filename = decodeURIComponent(serverRelUrl.substring(lastSlash + 1));
  const enc = encodeURIComponent(folderRelUrl);
  const res = await spFetchWrite(
    `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${enc}')/Files/add(url='${encodeURIComponent(filename)}',overwrite=true)`,
    { method: 'POST', headers: { 'Accept': 'application/json' }, body: json },
    siteUrl
  );
  if (!res.ok) { const t = await res.text(); throw new Error(`Save failed (${res.status}): ${t}`); }
}

async function _saveConfigToSpList(json, reportUrl, siteUrl) {
  const listsMatch = reportUrl.match(/\/Lists\/([^/]+)\/Attachments\/(\d+)\/([^/]+)/);
  if (!listsMatch) throw new Error('Unable to parse SharePoint list URL for save.');
  const [, listTitle, itemId, filenameEnc] = listsMatch;
  const filename = decodeURIComponent(filenameEnc);
  const enc = encodeURIComponent(listTitle);
  try {
    await spFetchWrite(
      `${siteUrl}/_api/web/lists/getbytitle('${enc}')/items(${itemId})/AttachmentFiles/getbyfilename('${encodeURIComponent(filename)}')`,
      { method: 'POST', headers: { 'X-HTTP-Method': 'DELETE' } },
      siteUrl
    );
  } catch(e) {}
  const ar = await spFetchWrite(
    `${siteUrl}/_api/web/lists/getbytitle('${enc}')/items(${itemId})/AttachmentFiles/add(FileName='${encodeURIComponent(filename)}')`,
    { method: 'POST', headers: { 'Accept': 'application/json' }, body: json },
    siteUrl
  );
  if (!ar.ok) { const t = await ar.text(); throw new Error(`Save failed (${ar.status}): ${t}`); }
}

// Build a clean, minimal config object from the current state, suitable for saving or sharing
function buildConfig() {
  // TODO: DEBUG: Confirm that relationships and advancedQB are  being included in the config.
  const cleanFields = (arr) => (arr || []).filter(f => !f.isSynthetic && !f.isAutoId).map(f => ({
    internalName:  f.internalName || f.InternalName || '',
    displayName:   f.displayName  || f.Title        || '',
    description:   f.description  || '',
    alias:         f.alias        || '',
    userAlias:     f.userAlias    || f.alias         || '',
    rawType:       f.rawType      || f.TypeAsString  || '',
    rawTypeSource: f.rawTypeSource || (f.TypeAsString ? 'sharepoint' : 'unknown'),
    type:          f.type         || '',
    dataType:      f.dataType     || 'text',
    displayType:   f.displayType  || 'text',
    calculatedType: f.calculatedType || f.calculatedFieldType || null,
    displayFormat: f.displayFormat || null,
    required:      !!f.required,
    maxLength:     f.maxLength     || null,
    isAutoId:      !!f.isAutoId,
    choices:       (Array.isArray(f.choices) && f.choices.length <= 50) ? f.choices : null,
    lookupList:    f.lookupList    || null,
    lookupField:   f.lookupField   || null
  }));
 
 
  // Save dataSources
  let dataSourcesMeta = {};
  let uploadedFilesDsNames = [];
  for (const [dsName, ds] of Object.entries(DataLaVistaState.dataSources)) {
    dataSourcesMeta[dsName] = {
      alias: ds.alias || dsName,
      auth: ds.auth || 'current',
      description: ds.description || '',
      fileName: ds.fileName || '',
      internalName: ds.internalName || dsName,
      siteTitle: ds.siteTitle || '',
      tables: ds.tables || [],
      token: ds.token || '',
      type: ds.type || 'sharepoint',
      url: ds.url || '',
      siteUrl: ds.siteUrl || '',
      isFileUpload: ds.isFileUpload || false,
      keepRawData: ds.keepRawData || false
    };
    if(ds.type!=='sharepoint' && ds.keepRawData) {
      uploadedFilesDsNames.push(dsName);
    }
  }
 
  // Save tables (and row data if the files were uploaded)
  const tablesMeta = {};
  for (const [name, t] of Object.entries(DataLaVistaState.tables)) {
    const ds = t.dataSource ? DataLaVistaState.dataSources[t.dataSource] : null;
    tablesMeta[name] = {
      alias: t.alias || name,
      baseFields: cleanFields(t.originalFields || t.fields),  // base (non-synthetic) fields for FieldExpander on reload
      dataSource: t.dataSource || '',
      description: t.description || '',
      displayName: t.displayName || name,
      dsAlias: t.dsAlias || '',
      fields: cleanFields(t.fields),
      guid: t.guid || '',
      internalName: t.internalName || name,
      itemCount: t.itemCount || 0,
      loaded: false,
      isFileUpload: t.isFileUpload || false,
      keepRawData: t.keepRawData || false,
      originalFields: cleanFields(t.originalFields || t.fields),
      siteUrl: t.siteUrl || '',
      sourceType: t.sourceType || 'sharepoint',
      url: ds ? (ds.url || '') : ''
    };
 
    // Only include row data for tables that were explicitly uploaded from a local file
    try {
      const shouldKeepData = t.isFileUpload === true && t.keepRawData === true;
      if (shouldKeepData && Array.isArray(t.data) && t.data.length > 0) {
        tablesMeta[name].data = t.data;
        tablesMeta[name].loaded = true;
      } else {
        tablesMeta[name].data = [];
        tablesMeta[name].loaded = false;
      }
    } catch(e) {
      console.warn(`Error including data for uploaded file, table ${name}, in config:`, e);
      tablesMeta[name].data = [];
      tablesMeta[name].loaded = false;
    }
  }
 
  const cleanWidgets = (DataLaVistaState.design.widgets || []).map(/** @param {any} w */ w => ({
    id: w.id,
    type: w.type,
    title: w.title || '',
    showTitle: w.showTitle !== false,
    widthPct: w.widthPct || 48,
    heightVh: w.heightVh || 33,
    // Unified dimension model — dimensions[0] is the primary axis (replaces xField)
    dimensions: Array.isArray(w.dimensions) && w.dimensions.length ? [...w.dimensions] : (w.xField ? [w.xField] : []),
    // Keep xField/yFields for backward compat with older tooling reading the JSON
    xField: (Array.isArray(w.dimensions) && w.dimensions[0]) || w.xField || '',
    yFields: Array.isArray(w.yFields) ? [...w.yFields] : [],
    fields: Array.isArray(w.fields) ? [...w.fields] : [],
    aggregation: w.aggregation || '',
    fillColor: w.fillColor || '#0078d4',
    borderColor: w.borderColor || '#edebe9',
    borderSize: w.borderSize != null ? w.borderSize : 1,
    widgetBackgroundColor: w.widgetBackgroundColor ?? '#fefefe',
    chartBackgroundColor: w.chartBackgroundColor || '#fefefe',
    titleBackgroundColor: w.titleBackgroundColor || '#fefefe',
    titleFontSize: w.titleFontSize || 14,
    titleFontColor: w.titleFontColor || '#323130',
    fontSize: w.fontSize || 13,
    fontColor: w.fontColor || '#323130',
    stacked: !!w.stacked,
    showTrendLine: !!w.showTrendLine,
    // Per-widget interaction override — undefined means inherit report-level setting
    ...(w.interactionMode ? { interactionMode: w.interactionMode } : {}),
    // typeConfig: namespaces type-specific props cleanly
    typeConfig: Object.assign(
      {},
      w.typeConfig || {},
      w.type === 'kpi'     ? { kpiMetricFontSize: (w.typeConfig && w.typeConfig.kpiMetricFontSize) || w.kpiMetricFontSize || 36,
                               kpiLabelFontSize:  (w.typeConfig && w.typeConfig.kpiLabelFontSize)  || w.kpiLabelFontSize  || 13,
                               kpiLabelOverride:  (w.typeConfig && w.typeConfig.kpiLabelOverride)  || w.kpiLabelOverride  || '' } : {},
      w.type === 'scatter' ? { bubbleSizeField:  (w.typeConfig && w.typeConfig.bubbleSizeField)  || w.bubbleSizeField  || '',
                               bubbleColorField: (w.typeConfig && w.typeConfig.bubbleColorField) || w.bubbleColorField || '' } : {},
      w.type === 'text'    ? { textContent: (w.typeConfig && w.typeConfig.textContent) || w.textContent || '',
                               imageUrl:    (w.typeConfig && w.typeConfig.imageUrl)    || w.imageUrl    || '' } : {},
      w.type === 'table'   ? { showHeaders:            (w.typeConfig && w.typeConfig.showHeaders)            ?? (w.showHeaders            !== false),
                               headersBackgroundColor: (w.typeConfig && w.typeConfig.headersBackgroundColor) || w.headersBackgroundColor || '#f3f2f1',
                               headersFontSize:        (w.typeConfig && w.typeConfig.headersFontSize)        || w.headersFontSize        || 12,
                               headersFontColor:       (w.typeConfig && w.typeConfig.headersFontColor)       || w.headersFontColor       || '#323130' } : {}
    ),
    seriesProps: (Array.isArray(w.seriesProps) ? w.seriesProps : []).map(sp => ({
      field:      sp.field      || '',
      agg:        sp.agg        || '',
      label:      sp.label      || '',
      color:      sp.color      || '',
      seriesType: sp.seriesType || '',
      ...(sp.lineWidth  != null ? { lineWidth:  sp.lineWidth  } : {}),
      ...(sp.opacity    != null ? { opacity:    sp.opacity    } : {}),
      ...(sp.smooth     != null ? { smooth:     sp.smooth     } : {}),
      axisSide:   sp.axisSide   || '',
      conditions: (sp.conditions || []).map(c => {
        const out = {
          conj:  c.conj  || 'AND',
          field: c.field || '',
          op:    c.op    || '=',
          value: c.value != null ? c.value : ''
        };
        if (c.value2     != null) out.value2     = c.value2;
        if (c.elementKey        ) out.elementKey = c.elementKey;
        return out;
      })
    })),
    fieldAggs: Object.assign({}, w.fieldAggs || {}),
    conditions: (w.conditions || []).map(c => ({
      conj:       c.conj       || 'AND',
      field:      c.field      || '',
      op:         c.op         || '=',
      value:      c.value      != null ? c.value : '',
      value2:     c.value2     != null ? c.value2 : undefined,
      elementKey: c.elementKey || undefined
    })).map(c => {
      // Remove undefined keys to keep JSON clean
      if (c.value2     === undefined) delete c.value2;
      if (c.elementKey === undefined) delete c.elementKey;
      return c;
    }),
    sorts: (w.sorts || []).map(s => ({ field: s.field || '', dir: s.dir || 'ASC' })),
    filters: (w.filters || []).map(f => ({
      field: f.field || '',
      operator: f.operator || '=',
      value: f.value !== undefined ? f.value : '',
      position: f.position || 'widget'
    })),
    widgetSql: (() => { try { return buildWidgetSQL(w)?.sql || null; } catch(_) { return null; } })(),
    parentContainerId: w.parentContainerId || null,
    minHeightVh: w.minHeightVh != null ? w.minHeightVh : 30,
    containerGap: w.containerGap != null ? w.containerGap : 8,
    containerPadding: w.containerPadding != null ? w.containerPadding : 8,
    containerAlign: w.containerAlign || 'top'
  }));
 
  const cleanDesign = {
    title: DataLaVistaState.design.title || '',
    showDashboardTitle: DataLaVistaState.design.showDashboardTitle !== false,
    dashboardTitleTooltip: DataLaVistaState.design.dashboardTitleTooltip || '',
    interactionMode: DataLaVistaState.design.interactionMode || 'cross-filter',
    theme: {
      palette:         (DataLaVistaState.design.theme && DataLaVistaState.design.theme.palette)         || [],
      fontFamily:      (DataLaVistaState.design.theme && DataLaVistaState.design.theme.fontFamily)      || '',
      fontSize:        (DataLaVistaState.design.theme && DataLaVistaState.design.theme.fontSize)        || null,
      backgroundColor: (DataLaVistaState.design.theme && DataLaVistaState.design.theme.backgroundColor) || ''
    },
    widgets: cleanWidgets,
    filters: (DataLaVistaState.design.filters || []).map(/** @param {any} f */ f => ({
      field: f.field || '',
      label: f.label || f.field || '',
      position: f.position || 'bar'
    })),
  };
 
  // ── Smart export: only include tables referenced in the SQL (or uploaded files) ──
  // Collect all SQL text: main query + every widget's generated SQL
  // TODO: DEBUG: This probably shoulnd't take widget SQL into account since it always uses the materialized view. Only state.sql should be used.
  const _allSqlParts = [DataLaVistaState.sql || ''];
  for (const w of /** @type {any[]} */ (DataLaVistaState.design.widgets || [])) {
    const wsql = generateWidgetSQL(w, '_results');
    if (wsql) _allSqlParts.push(wsql);
  }
  const _combinedSql = _allSqlParts.join('\n');
 
  const _referencedKeys = new Set();
  if (_combinedSql.trim()) {
    for (const tkey of Object.keys(tablesMeta)) {
      const t = DataLaVistaState.tables[tkey];
      // Uploaded files are always included regardless of SQL
      if (t && t.isFileUpload) { _referencedKeys.add(tkey); continue; }
      // Match raw table key in SQL
      const _escKey = tkey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\[${_escKey}\\]|\\b${_escKey}\\b`, 'i').test(_combinedSql)) {
        _referencedKeys.add(tkey); continue;
      }
      // Match view name in SQL (users write SQL against view names)
      const _viewName = CyberdynePipeline.rawTableToView[tkey];
      if (_viewName) {
        const _escView = _viewName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\[${_escView}\\]|\\b${_escView}\\b`, 'i').test(_combinedSql)) {
          _referencedKeys.add(tkey);
        }
      }
    }
  } else {
    // No SQL written yet — include everything (preserve all connections)
    for (const tkey of Object.keys(tablesMeta)) _referencedKeys.add(tkey);
  }
 
  // Filter tablesMeta and update DS tables arrays to match
  const filteredTablesMeta = {};
  for (const [tkey, tmeta] of Object.entries(tablesMeta)) {
    if (_referencedKeys.has(tkey)) filteredTablesMeta[tkey] = tmeta;
  }
  for (const dsName of Object.keys(dataSourcesMeta)) {
    dataSourcesMeta[dsName].tables = (dataSourcesMeta[dsName].tables || []).filter(/** @param {string} t */ t => _referencedKeys.has(t));
  }
 
  return {
    _license: 'This file is part of DataLaVista™. This is a configuration script for a report designed in DataLaVista™. Copyright © 2026 The Regents of the University of Michigan. This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses.',
    _min_version: 0.5,
    activeTab: (DataLaVistaState.reportMode === 'view') ? 'dashboardPreview' : 'design',
    advancedQB: DataLaVistaState.advancedQB || {},
    currentWidgetId: DataLaVistaState.currentWidgetId || null,
    dataSources: dataSourcesMeta,
    design: cleanDesign,
    previewFilters: DataLaVistaState.previewFilters || {},
    qbCollapsed: DataLaVistaState.qbCollapsed || false,
    qbSectionHeight: DataLaVistaState.qbSectionHeight || 60,
    qmTab: DataLaVistaState.qmTab || 'dataPreview',
    queryColumns: Array.isArray(DataLaVistaState.queryColumns) ? [...DataLaVistaState.queryColumns] : [],
    relationships: (DataLaVistaState.relationships || []).filter(r =>
      _referencedKeys.has(r.childTableKey) || _referencedKeys.has(r.parentTableKey)
    ),
    sql: DataLaVistaState.sql || '',
    sqlLocked: DataLaVistaState.sqlLocked || false,
    tables: filteredTablesMeta,
    views: (() => {
      // Only export views whose underlying raw table made it into the filtered set
      const _allViews = CyberdynePipeline.buildViewsForConfig();
      const _filteredViews = {};
      for (const [vName, vDef] of Object.entries(_allViews)) {
        if (_referencedKeys.has(vDef.rawTable)) _filteredViews[vName] = vDef;
      }
      return _filteredViews;
    })()
  };
}

// Load a config file (saved report) into the current state. This is called on initial load if a config URL or file param is detected, and can also be used to load a local config file via the "Load Config" button in the UI.
async function loadConfig(cfg) {
  if (!cfg.dataSources || typeof cfg.dataSources != 'object'|| !cfg.tables || typeof cfg.tables != 'object') throw new Error('Invalid report config — missing data sources or tables.');
  // If the config provided is a string, try parsing it safely as JSON
  if (cfg && typeof cfg == 'string')
    {
      let cfgString = cfg.trim();
      if(cfgString.startsWith('{') && cfgString.endsWith('}')) {
        try{
          cfg = safeJSONParse(cfgString, 'Config');
        } catch (e) {
          throw new Error('Invalid report config — the report JSON is invalid.');
        }
      } else {
        throw new Error('Invalid report config — the report JSON is invalid.');
      }
    }
  // At this point, cfg should be an object. If it's not, throw an error.
  if (cfg && typeof cfg !== 'object') throw new Error('Invalid report config — no report JSON detected.');

  if (!cfg._license) throw new Error('Invalid report config — missing _license key');
  // TODO: Check the new key, _min_version, and display a warning saying this report maybe incompatible with this version of DataLaVista, if the key doesn't exist or if it is <0.5.
  // Basic validation passed — now clear the existing state and load the config values
  CyberdynePipeline.clearAllViews(); // drop any existing AlaSQL views before reloading
  //DataLaVistaState.activeTab = (DataLaVistaState.reportMode==='view')?'dataPreview':'design';
  DataLaVistaState.advancedQB = cfg.advancedQB || {};
  DataLaVistaState.advancedQB.nodeAliases ??= {};
  // Restore or default primaryNodeId — preserves saved value; falls back to first node
  DataLaVistaState.advancedQB.primaryNodeId ??= null;
  if (!DataLaVistaState.advancedQB.primaryNodeId) {
    const firstKey = Object.keys(DataLaVistaState.advancedQB.nodes || {})[0];
    if (firstKey) DataLaVistaState.advancedQB.primaryNodeId = firstKey;
  }
  // [REMOVE AFTER: backward compat — read old basicQB only when basic QB was active, migrate to advanced QB]
  // If the saved config had basic QB as the active query mode, copy its state into advanced QB so the
  // canvas shows the right content. Otherwise, ignore basicQB entirely so stale data doesn't pollute.
  if (cfg.queryMode === 'basic' && cfg.basicQB) {
    DataLaVistaState.basicQB = cfg.basicQB;
    _migrateBasicToAdvancedQB();
    DataLaVistaState.basicQB = {};  // clear after migration — not needed in new state
  }
  // [END REMOVE AFTER]
  DataLaVistaState.currentWidgetId = null;
  DataLaVistaState.dataSources = cfg.dataSources || {};
  // Background-refresh SP site title/description for all SP data sources (fire-and-forget)
  for (const [_dsName, _ds] of Object.entries(DataLaVistaState.dataSources)) {
    const _dsCast = /** @type {any} */ (_ds);
    if (_dsCast.type === 'sharepoint' && (_dsCast.siteUrl || _dsCast.url)) {
      _fetchSPSiteMeta(_dsCast.siteUrl || _dsCast.url, _dsName);
    }
  }
  const loadedDesign = cfg.design || {};
  DataLaVistaState.design = {
    title: loadedDesign.title || '',
    showDashboardTitle: loadedDesign.showDashboardTitle !== false,
    dashboardTitleTooltip: loadedDesign.dashboardTitleTooltip || '',
    interactionMode: loadedDesign.interactionMode || 'cross-filter',
    theme: {
      palette:         (loadedDesign.theme && loadedDesign.theme.palette)         || [],
      fontFamily:      (loadedDesign.theme && loadedDesign.theme.fontFamily)      || '',
      fontSize:        (loadedDesign.theme && loadedDesign.theme.fontSize)        || null,
      backgroundColor: (loadedDesign.theme && loadedDesign.theme.backgroundColor) || ''
    },
    widgets: loadedDesign.widgets || [],
    filters: loadedDesign.filters || []
  };
  // Migrate and backfill widget schema fields
  for (const w of /** @type {any[]} */ (DataLaVistaState.design.widgets)) {
    // dimensions[] — new multi-dim array; derive from xField for old configs
    if (!Array.isArray(w.dimensions) || !w.dimensions.length) {
      w.dimensions = w.xField ? [w.xField] : [];
    }
    // typeConfig — namespace for type-specific props; read both old top-level and new typeConfig
    if (!w.typeConfig || typeof w.typeConfig !== 'object') w.typeConfig = {};
    if (w.type === 'kpi') {
      w.typeConfig.kpiMetricFontSize = w.typeConfig.kpiMetricFontSize ?? w.kpiMetricFontSize ?? 36;
      w.typeConfig.kpiLabelFontSize  = w.typeConfig.kpiLabelFontSize  ?? w.kpiLabelFontSize  ?? 13;
      w.typeConfig.kpiLabelOverride  = w.typeConfig.kpiLabelOverride  ?? w.kpiLabelOverride  ?? '';
    }
    if (w.type === 'scatter') {
      w.typeConfig.bubbleSizeField  = w.typeConfig.bubbleSizeField  ?? w.bubbleSizeField  ?? '';
      w.typeConfig.bubbleColorField = w.typeConfig.bubbleColorField ?? w.bubbleColorField ?? '';
    }
    if (w.type === 'text') {
      w.typeConfig.textContent = w.typeConfig.textContent ?? w.textContent ?? '';
      w.typeConfig.imageUrl    = w.typeConfig.imageUrl    ?? w.imageUrl    ?? '';
    }
    if (w.type === 'table') {
      w.typeConfig.showHeaders            = w.typeConfig.showHeaders            ?? (w.showHeaders !== false);
      w.typeConfig.headersBackgroundColor = w.typeConfig.headersBackgroundColor ?? w.headersBackgroundColor ?? '#f3f2f1';
      w.typeConfig.headersFontSize        = w.typeConfig.headersFontSize        ?? w.headersFontSize        ?? 12;
      w.typeConfig.headersFontColor       = w.typeConfig.headersFontColor       ?? w.headersFontColor       ?? '#323130';
    }

    if (!Array.isArray(w.yFields))        w.yFields = w.yField ? [w.yField] : [];
    if (w.stacked          == null)       w.stacked = false;
    if (w.showTrendLine    == null)       w.showTrendLine = false;
    // Migrate legacy ySeriesTypes into ySeriesProps (for very old configs)
    if (!w.ySeriesProps) {
      w.ySeriesProps = {};
      if (w.ySeriesTypes && typeof w.ySeriesTypes === 'object') {
        for (const [field, st] of Object.entries(w.ySeriesTypes)) {
          w.ySeriesProps[field] = Object.assign({ seriesType: st }, w.ySeriesProps[field] || {});
        }
      }
    }
    delete w.ySeriesTypes; // no longer needed in runtime state

    // Backfill conditions arrays inside ySeriesProps entries
    if (w.ySeriesProps && typeof w.ySeriesProps === 'object') {
      for (const sp of Object.values(w.ySeriesProps)) {
        if (!Array.isArray(sp.conditions)) sp.conditions = [];
      }
    }

    // Populate seriesProps (unified source of truth).
    // New configs have it saved directly; legacy configs need reconstruction.
    if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) {
      const _isChartW = isEChartsWidget(w.type);
      if (_isChartW) {
        const _yfs = (Array.isArray(w.yFields) && w.yFields.length) ? w.yFields : (w.yField ? [w.yField] : []);
        w.seriesProps = _yfs.map((yf, yi) => {
          const leg = (w.ySeriesProps || {})[String(yi)] || (w.ySeriesProps || {})[yf] || {};
          return { field: yf, agg: leg.agg || (w.fieldAggs || {})[yf] || '', label: leg.label || '', color: leg.color || '', seriesType: leg.seriesType || '', lineWidth: leg.lineWidth ?? null, opacity: leg.opacity ?? null, smooth: leg.smooth ?? null, axisSide: leg.axisSide || '', conditions: (leg.conditions || []).map(c => Object.assign({}, c)) };
        });
      } else {
        const _flds = w.type === 'kpi' ? (w.fields || []).slice(0,1) : (w.fields || []);
        w.seriesProps = _flds.map(f => ({ field: f, agg: (w.fieldAggs || {})[f] || '', label: '', color: '', seriesType: '', lineWidth: null, opacity: null, smooth: null, axisSide: '', conditions: [] }));
      }
    } else {
      // Backfill conditions arrays in loaded seriesProps entries
      for (const sp of w.seriesProps) {
        if (!Array.isArray(sp.conditions)) sp.conditions = [];
      }
    }

    if (w.bubbleSizeField  == null)       w.bubbleSizeField = '';
    if (w.bubbleColorField == null)       w.bubbleColorField = '';
    if (w.showTitle        == null)       w.showTitle = true;
    if (w.showHeaders      == null)       w.showHeaders = true;
    if (w.widgetBackgroundColor == null)  w.widgetBackgroundColor = '#fefefe';
    if (w.chartBackgroundColor  == null)  w.chartBackgroundColor  = '#fefefe';
    if (w.titleBackgroundColor  == null)  w.titleBackgroundColor  = '#fefefe';
    if (w.titleFontSize    == null)       w.titleFontSize = 14;
    if (w.titleFontColor   == null)       w.titleFontColor = '#323130';
    if (w.headersBackgroundColor == null) w.headersBackgroundColor = '#f3f2f1';
    if (w.headersFontSize  == null)       w.headersFontSize = 12;
    if (w.headersFontColor == null)       w.headersFontColor = '#323130';
    if (w.fontSize         == null)       w.fontSize = 13;
    if (w.fontColor        == null)       w.fontColor = '#323130';
    if (w.kpiMetricFontSize == null)      w.kpiMetricFontSize = 36;
    if (w.kpiLabelFontSize == null)       w.kpiLabelFontSize = 13;
    if (w.kpiLabelOverride == null)       w.kpiLabelOverride = '';
    if (w.textContent      == null)       w.textContent = '';
    if (!w.fieldAggs)                     w.fieldAggs = {};
    if (!w.conditions)                    w.conditions = [];
    w.conditions = w.conditions.map(c => ({
      ...c,
      value: c.value != null ? c.value : ''
    }));
    if (!w.sorts)                         w.sorts = [];
    // Container / layout fields
    if (w.parentContainerId === undefined) w.parentContainerId = null;
    if (w.minHeightVh      == null)       w.minHeightVh      = w.heightVh || 30;
    if (w.containerGap     == null)       w.containerGap     = 8;
    if (w.containerPadding == null)       w.containerPadding = 8;
    if (w.containerAlign   == null)       w.containerAlign   = 'top';
    // placeholder and container default showTitle to false
    if (w.showTitle == null) {
      if (w.type === 'placeholder' || w.type === 'container') {
        w.showTitle = false;
      } else {
        w.showTitle = true;
      }
    }
  }
  DataLaVistaState.previewFilters = cfg.previewFilters || {};
  // Normalize legacy tab name ('previewData' was renamed to 'dataPreview')
  DataLaVistaState.qmTab = (cfg.qmTab === 'previewData') ? 'dataPreview' : (cfg.qmTab || 'qb');
  DataLaVistaState.queryColumns = Array.isArray(cfg.queryColumns) ? [...cfg.queryColumns] : [];
  // Don't load reportMode or reportUrl from config - it's handled by init()
  DataLaVistaState.relationships = Array.isArray(cfg.relationships) ? cfg.relationships : [];
  DataLaVistaState.sql = cfg.sql || '';
  DataLaVistaState.sqlLocked = cfg.sqlLocked || false;
  DataLaVistaState.tables = cfg.tables || {};

  // Back-fill new field schema properties for configs saved before the type-system overhaul
  for (const tmeta of Object.values(DataLaVistaState.tables)) {
    for (const fields of [tmeta.fields, tmeta.baseFields, tmeta.originalFields]) {
      if (!Array.isArray(fields)) continue;
      for (const f of fields) {
        if (f.userAlias    == null) f.userAlias    = f.alias        || '';
        if (f.rawType      == null) f.rawType      = f.TypeAsString || f.type || '';
        if (f.rawTypeSource == null) f.rawTypeSource = f.TypeAsString ? 'sharepoint' : 'unknown';
        if (f.dataType     == null) f.dataType     = 'text';
        if (f.displayFormat == null) f.displayFormat = null;
        if (f.derivedColumns == null) f.derivedColumns = null;
        if (f.calculatedType == null) f.calculatedType = f.calculatedFieldType || null;
        // Re-derive displayType for old configs where DateTime was stored as 'date'
        if (f.displayType === 'date' && (f.rawType === 'DateTime' || f.type === 'datetime')) {
          f.displayType = 'datetime';
        }
      }
    }
  }

  // Restore view definitions (gracefully skipped for legacy configs without views)
  if (cfg.views && typeof cfg.views === 'object' && Object.keys(cfg.views).length) {
    CyberdynePipeline.restoreViewsFromConfig(cfg.views);
  } else { }
 
  // Back-fill baseFields from table meta for views that don't have them yet
  // (handles legacy configs where views.baseFields wasn't saved, and new configs
  //  where table.baseFields is more authoritative than the view entry)
  for (const [tkey, tmeta] of Object.entries(DataLaVistaState.tables)) {
    const viewName = CyberdynePipeline.rawTableToView[tkey];
    if (!viewName) continue;
    const view = CyberdynePipeline.views[viewName];
    if (!view) continue;
    const sourceFields = tmeta.baseFields || tmeta.originalFields || null;
    if (sourceFields && sourceFields.length > 0 && (!view.baseFields || view.baseFields.length === 0)) {
      view.baseFields = sourceFields;
    }
  }

  // ── Backward-compat: reconstruct view registry from table metadata
  //    for configs saved before the view-layer refactor (no cfg.views key).
  if (!cfg.views || !Object.keys(cfg.views).length) {
      for (const [tkey, tmeta] of Object.entries(DataLaVistaState.tables)) {
          if (CyberdynePipeline.rawTableToView[tkey]) continue; // already registered
          const fields = tmeta.baseFields || tmeta.originalFields || tmeta.fields || [];
          const viewName = tmeta.alias && tmeta.alias !== tkey ? tmeta.alias : tkey;
          try {
              if (tmeta.sourceType === 'sharepoint') {
                  CyberdynePipeline.registerSharePointList(
                      tmeta.dataSource || tkey, tkey, tmeta.displayName || tkey, fields
                  );
              } else {
                  const finalViewName = CyberdynePipeline.createView(tkey, viewName, fields);
                  DataLaVistaState.tables[tkey].viewName = finalViewName;
              }
          } catch (e) {
              console.warn('[loadConfig] Failed to reconstruct view for', tkey, e.message);
          }
      }
  }

  // Background fetch for referenced tables
  if (DataLaVistaState.sql) {
    const referencedTables = findReferencedTables(DataLaVistaState.sql);
    for (const tname of referencedTables) {
      await ensureTableData(tname, true)
    }
  }

  
  if (DataLaVistaState.sql && window._cmEditor) {
    window._cmEditor.setValue(DataLaVistaState.sql);
  }
 
  updateConnectButton();
  document.getElementById('btn-save-config').disabled = false;
 
  renderFilterBar();
  updateDashboardTitleTooltipIcon(); // apply info icon if tooltip is set

  let querySucceeded = false;
  try{
    if(DataLaVistaState.reportMode === 'view' || DataLaVistaState.activeTab === 'dashboardPreview') {
      setStatus('Refreshing dashboard preview...', 'info');
      await refreshDashboardPreview();
    } else {
      setStatus('Running query...', 'info');
      await runQuery();
    }
    DataLaVistaState.queryResultsReady = true;
    querySucceeded = true;
  } catch(e) {
    console.warn('Error refreshing dashboard preview after config load:', e);
  }

  if(DataLaVistaState.reportMode !== 'view') {
    const titleInput = document.getElementById('title-input');
    if (titleInput) titleInput.value = DataLaVistaState.design.title || '';
    renderDesignCanvas();
    renderFieldsPanel();
    renderAdvancedQB();
    renderAdvOptionsPanel();
    // Rebuild SQL from QB when the QB tab was active (not the manual SQL tab), or when
    // the config was migrated from basic QB (cfg.queryMode === 'basic').
    const _qbWasActive = /** @type {any} */ (DataLaVistaState).qmTab === 'qb' || cfg.queryMode === 'basic';
    if (!DataLaVistaState.sqlLocked && _qbWasActive && Object.keys(DataLaVistaState.advancedQB.nodes || {}).length) {
      rebuildAdvancedSQL();
      renderDesignFieldsPanel();
    }
    // Re-apply the loaded SQL and restore the active sub-tab (qb/sql/dataPreview)
    if (DataLaVistaState.sql && /** @type {any} */ (window)._cmEditor) /** @type {any} */ (window)._cmEditor.setValue(DataLaVistaState.sql);
    switchQMTab(DataLaVistaState.qmTab || 'qb');
    if (querySucceeded) showUseInDesign();
    setStatus('Config loaded', 'success');
    toast('Config loaded successfully', 'success');
  }
   
}

// ============================================================
// FIELDS PANEL RENDERING — grouped by data source
// ============================================================
function renderFieldsPanel() {
  const body = document.getElementById('fields-panel-body');
  body.innerHTML = '';
  const dsNames = Object.keys(DataLaVistaState.dataSources).sort((a, b) => a.localeCompare(b));
  if (!dsNames.length) {
    body.innerHTML = '<div class="text-muted text-sm" style="padding:12px 10px">No tables loaded</div>';
    renderDesignFieldsPanel();
    return;
  }

  for (const dsName of dsNames) {
    const ds = DataLaVistaState.dataSources[dsName];
    const dsAlias = ds.alias || dsName;

    // Determine tooltip for DS header
    let dsTitle = (ds.isFileUpload) ? (ds.fileName || ds.url || dsName) : (ds.url || dsName);

    // Sort tables alphabetically
    const tableKeys = (ds.tables || [])
      .filter(k => DataLaVistaState.tables[k])
      .sort((a, b) => {
        const da = DataLaVistaState.tables[a].alias || DataLaVistaState.tables[a].displayName || a;
        const db = DataLaVistaState.tables[b].alias || DataLaVistaState.tables[b].displayName || b;
        return da.localeCompare(db);
      });

    const dsGroup = document.createElement('div');
    dsGroup.className = 'ds-group';
    dsGroup.dataset.dsName = dsName;

    // DS header row
    const dsHeader = document.createElement('div');
    dsHeader.className = 'ds-group-header';
    dsHeader.title = dsTitle;
    dsHeader.innerHTML = `
      <span class="ds-group-toggle open" id="ds-toggle-${CSS.escape(dsName)}">▶</span>
      <span class="ds-group-name" id="ds-label-${CSS.escape(dsName)}">${dsAlias}</span>
      <span style="font-size:10px;color:var(--text-disabled);margin-left:2px">${tableKeys.length}</span>
    `;
    // Click toggle
    dsHeader.querySelector('.ds-group-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDsGroupExpand(dsName);
    });
    // Right-click
    dsHeader.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showCtxMenu(e, { level: 'ds', dsName, isFileUpload: ds.isFileUpload || false});
    });

    dsGroup.appendChild(dsHeader);

    // Tables container (DS groups expanded, table fields collapsed by default)
    const tablesWrap = document.createElement('div');
    tablesWrap.className = 'ds-group-tables';
    tablesWrap.id = 'ds-tables-' + CSS.escape(dsName);

    for (const tkey of tableKeys) {
      const t = DataLaVistaState.tables[tkey];
      // Show the short alias (view name minus DS prefix); fall back to full view name
      const viewName = CyberdynePipeline.rawTableToView[tkey];
      const tAlias   = t.alias || viewName || t.displayName || tkey;
      const tIcon = getTableIcon(t);

      const node = document.createElement('div');
      node.className = 'table-node';

      node.innerHTML = `
        <div class="table-node-header" draggable="true" data-table="${tkey}" style="padding-left:6px">
          <span class="toggle-arrow" id="arrow-${CSS.escape(tkey)}">▶</span>
          <span class="table-icon" title="${tIcon.title}" style="font-size:12px">${tIcon.icon}</span>
          <span class="table-name" id="tlabel-${CSS.escape(tkey)}" title="${tkey}" style="font-size:11px;font-weight:700">${tAlias}</span>
          <span class="table-count">${t.itemCount || (t.data && t.data.length) || 0}</span>
        </div>
        <div class="fields-list hidden" id="fields-${CSS.escape(tkey)}"></div>
      `;

      const header = node.querySelector('.table-node-header');
      header.addEventListener('click', () => toggleTableExpand(tkey));
      header.addEventListener('dragstart', e => {
        safeDragSet(e, { type: 'table', table: tkey });
      });
      // Right-click on table header
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showCtxMenu(e, { level: 'table', tableKey: tkey, dsName, isFileUpload: ds.isFileUpload || false });
      });

      // Build fields list: base fields sorted alphabetically, synthetic children nested under parent
      const flist = node.querySelector('.fields-list');
      const baseFields = [...t.fields]
        .filter(f => !f.isSynthetic)
        .sort((a, b) => (a.alias || a.displayName || '').localeCompare(b.alias || b.displayName || ''));
      const syntheticByParent = {};
      for (const f of t.fields) {
        if (f.isSynthetic && f.parentField) {
          if (!syntheticByParent[f.parentField]) syntheticByParent[f.parentField] = [];
          syntheticByParent[f.parentField].push(f);
        }
      }

      const makeFieldItem = (f, extraClass) => {
        const ti = DataLaVistaCore.FIELD_TYPE_ICONS[f.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
        const fitem = document.createElement('div');
        fitem.className = 'field-item' + (extraClass ? ' ' + extraClass : '');
        fitem.draggable = true;
        fitem.style.paddingLeft = '14px';
        fitem.innerHTML = `
          <span class="field-type-icon ${ti.cls}" title="${f.displayName || f.alias}">${ti.icon}</span>
          <span class="field-label" id="flabel-${CSS.escape(tkey)}-${CSS.escape(f.alias)}" title="${f.displayName || f.alias}">${f.alias}</span>
        `;
        fitem.addEventListener('dragstart', e => {
          safeDragSet(e, { type: 'field', table: tkey, field: f.alias, internalName: f.internalName });
          e.stopPropagation();
        });
        fitem.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showCtxMenu(e, { level: 'field', tableKey: tkey, fieldAlias: f.alias });
        });
        return fitem;
      };

      for (const f of baseFields) {
        const children = syntheticByParent[f.alias] || [];
        if (!children.length) {
          flist.appendChild(makeFieldItem(f, ''));
        } else {
          // Parent item with expand toggle
          const ti = DataLaVistaCore.FIELD_TYPE_ICONS[f.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const fitem = document.createElement('div');
          fitem.className = 'field-item';
          fitem.draggable = true;
          fitem.style.paddingLeft = '14px';
          fitem.innerHTML = `
            <span class="field-item-parent-toggle" title="Show/hide sub-fields">▶</span>
            <span class="field-type-icon ${ti.cls}" title="${f.displayName || f.alias}">${ti.icon}</span>
            <span class="field-label" id="flabel-${CSS.escape(tkey)}-${CSS.escape(f.alias)}" title="${f.displayName || f.alias}">${f.alias}</span>
          `;
          fitem.addEventListener('dragstart', e => {
            safeDragSet(e, { type: 'field', table: tkey, field: f.alias, internalName: f.internalName });
            e.stopPropagation();
          });
          fitem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showCtxMenu(e, { level: 'field', tableKey: tkey, fieldAlias: f.alias });
          });
          flist.appendChild(fitem);

          // Synthetic children container, collapsed by default
          const childList = document.createElement('div');
          childList.className = 'field-item-synthetic-list hidden';
          for (const sf of children) {
            childList.appendChild(makeFieldItem(sf, 'field-item-synthetic'));
          }
          flist.appendChild(childList);

          // Wire toggle
          const toggleArrow = fitem.querySelector('.field-item-parent-toggle');
          toggleArrow.addEventListener('click', e => {
            e.stopPropagation();
            const open = childList.classList.toggle('hidden');
            toggleArrow.classList.toggle('open', !open);
          });
        }
      }

      // Tables start collapsed by default

      tablesWrap.appendChild(node);
    }

    dsGroup.appendChild(tablesWrap);
    body.appendChild(dsGroup);
  }

  renderDesignFieldsPanel();
}

function toggleDsGroupExpand(dsName) {
  const wrap = document.getElementById('ds-tables-' + CSS.escape(dsName));
  const toggle = document.getElementById('ds-toggle-' + CSS.escape(dsName));
  if (!wrap) return;
  const isOpen = toggle && toggle.classList.contains('open');
  if (wrap) wrap.style.display = isOpen ? 'none' : '';
  if (toggle) toggle.classList.toggle('open', !isOpen);
}

function toggleTableExpand(tkey) {
  const flist = document.getElementById('fields-' + CSS.escape(tkey));
  const arrow = document.getElementById('arrow-' + CSS.escape(tkey));
  if (!flist) return;
  const isOpen = !flist.classList.contains('hidden');
  flist.classList.toggle('hidden', isOpen);
  if (arrow) { arrow.classList.toggle('open', !isOpen); }
}

function expandAllTables() {
  // First click: expand DS groups only. Second click (all DS already expanded): also expand table fields.
  const allDsExpanded = Object.keys(DataLaVistaState.dataSources).every(ds => {
    const wrap = document.getElementById('ds-tables-' + CSS.escape(ds));
    return !wrap || wrap.style.display !== 'none';
  });
  if (!allDsExpanded) {
    Object.keys(DataLaVistaState.dataSources).forEach(ds => {
      const wrap = document.getElementById('ds-tables-' + CSS.escape(ds));
      const toggle = document.getElementById('ds-toggle-' + CSS.escape(ds));
      if (wrap) wrap.style.display = '';
      if (toggle) toggle.classList.add('open');
    });
  } else {
    Object.keys(DataLaVistaState.tables).forEach(t => {
      document.getElementById('fields-' + CSS.escape(t))?.classList.remove('hidden');
      document.getElementById('arrow-' + CSS.escape(t))?.classList.add('open');
    });
  }
}
function collapseAllTables() {
  // First click: collapse table fields only. Second click (all fields already collapsed): also collapse DS groups.
  const anyFieldExpanded = Object.keys(DataLaVistaState.tables).some(t => {
    const el = document.getElementById('fields-' + CSS.escape(t));
    return el && !el.classList.contains('hidden');
  });
  if (anyFieldExpanded) {
    Object.keys(DataLaVistaState.tables).forEach(t => {
      document.getElementById('fields-' + CSS.escape(t))?.classList.add('hidden');
      document.getElementById('arrow-' + CSS.escape(t))?.classList.remove('open');
    });
  } else {
    Object.keys(DataLaVistaState.dataSources).forEach(ds => {
      const wrap = document.getElementById('ds-tables-' + CSS.escape(ds));
      const toggle = document.getElementById('ds-toggle-' + CSS.escape(ds));
      if (wrap) wrap.style.display = 'none';
      if (toggle) toggle.classList.remove('open');
    });
  }
}