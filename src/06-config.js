/* ============================================================
This file is part of DataLaVista
06-config.js: Widget SQL generation, configuration save/load, and fields panel rendering.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
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
  if (w.type === 'text' || w.type === 'placeholder') return null;

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

  if (['bar', 'line', 'pie'].includes(w.type)) {
    const xField = w.xField;
    const yField = w.yField;
    if (!xField) return `SELECT * FROM ${q}${where}`;
    const agg = (w.aggregation || '').toUpperCase();
    if (!yField || !agg || agg === 'NONE') {
      return `SELECT [${xField}] FROM ${q}${where}`;
    }
    const yExpr = agg === 'COUNT'
      ? `COUNT(*) AS [${yField}]`
      : `${agg}([${yField}]) AS [${yField}]`;
    return `SELECT [${xField}], ${yExpr} FROM ${q}${where} GROUP BY [${xField}]`;
  }

  if (w.type === 'scatter') {
    const xField = w.xField;
    const yField = w.yField;
    if (!xField || !yField) return `SELECT * FROM ${q}${where}`;
    return `SELECT [${xField}], [${yField}] FROM ${q}${where}`;
  }

  return `SELECT * FROM ${q}${where}`;
}


function saveConfig() {
  const config = buildConfig();
  const json = JSON.stringify(config, null, 2);
  downloadText(json, 'DataLaVista-config.json', 'application/json');
}

// Build a clean, minimal config object from the current state, suitable for saving or sharing
function buildConfig() {
  const cleanFields = (arr) => (arr || []).map(f => ({
    InternalName: f.InternalName || f.internalName || '',
    internalName: f.internalName || f.InternalName || '',
    Title: f.Title || f.displayName || '',
    displayName: f.displayName || f.Title || '',
    TypeAsString: f.TypeAsString || '',
    type: f.type || '',
    alias: f.alias || '',
    displayType: f.displayType || 'text',
    required: !!f.required,
    maxLength: f.maxLength || null,
    isAutoId: !!f.isAutoId,
    choices: (Array.isArray(f.choices) && f.choices.length <= 50) ? f.choices : null
  }));


  // Save dataSources
  let dataSourcesMeta = {};
  let uploadedFilesDsNames = [];
  for (const [dsName, ds] of Object.entries(DataLaVistaState.dataSources)) {
    dataSourcesMeta[dsName] = {
      alias: ds.alias || dsName,
      auth: ds.auth || 'current',
      fileName: ds.fileName || '',
      internalName: ds.internalName || dsName,
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

  // Bring over preview/flat table data if the source contains an uploaded file
  let previewResults = [];
  // TODO: Do we need to load preview data, or just re-run SQL when report loads?
//  if(uploadedFilesDsNames && uploadedFilesDsNames.length>0 && DataLaVistaState.previewResults && DataLaVistaState.previewResults.length>0) {
    //previewResults = DataLaVistaState.previewResults || []; // Since we found files that were uploaded, we preserve the flat table data
//  }

  // Save tables (and row data if the files were uploaded)
  const tablesMeta = {};
  for (const [name, t] of Object.entries(DataLaVistaState.tables)) {
    const ds = t.dataSource ? DataLaVistaState.dataSources[t.dataSource] : null;
    tablesMeta[name] = {
      alias: t.alias || name,
      dataSource: t.dataSource || '',
      description: t.description || '',
      displayName: t.displayName || name,
      dsAlias: t.dsAlias || '',
      fields: cleanFields(t.fields),
      guid: t.guid || '',
      internalName: t.internalName || name,
      itemCount: t.itemCount || 0,   // for SharePoint lists?
      loaded: false,
      isFileUpload: t.isFileUpload || false,
      keepRawData: t.keepRawData || false,
      originalFields: cleanFields(t.originalFields || t.fields),
      siteUrl: t.siteUrl || '', // for SharePoint lists
      sourceType: t.sourceType || 'sharepoint',
      url: ds ? (ds.url || '') : ''  // for CSV/JSON standalone fetching
    };

    // Only include row data for tables that were loaded from uploaded files, to keep config lightweight and avoid sharing sensitive data from connected sources
    try{
      if(t.loaded && t.keepRawData && t.data && t.data.length>0) {
        tablesMeta[name].data = t.data; // Only include row data for tables that were loaded from uploaded files
        tablesMeta[name].loaded = true; // Mark as loaded since we have the data in the config
      } else {
        tablesMeta[name].data = []; // For other tables, we don't include row data in the config to keep it lightweight
        tablesMeta.loaded = false;
      }
    } catch(e) {
      console.warn(`Error including data for uploaded file, table ${name}, in config:`, e);
      tablesMeta[name].data = []; // On error, don't include data
    }
  }

  const cleanWidgets = (DataLaVistaState.design.widgets || []).map(w => ({
    id: w.id,
    type: w.type,
    title: w.title || '',
    widthPct: w.widthPct || 45,
    heightVh: w.heightVh || 30,
    fields: Array.isArray(w.fields) ? [...w.fields] : [],
    xField: w.xField || '',
    yField: w.yField || '',
    aggregation: w.aggregation || '',
    fillColor: w.fillColor || '#0078d4',
    borderColor: w.borderColor || '#edebe9',
    borderSize: w.borderSize != null ? w.borderSize : 1,
    fontSize: w.fontSize || 13,
    fontColor: w.fontColor || '#323130',
    textContent: w.textContent || '',
    imageUrl: w.imageUrl || '',
    filters: (w.filters || []).map(f => ({
      field: f.field || '',
      operator: f.operator || '=',
      value: f.value !== undefined ? f.value : '',
      position: f.position || 'widget'
    })),
    widgetSql: generateWidgetSQL(w, '_results')
  }));

  const cleanDesign = {
    title: DataLaVistaState.design.title || '',
    widgets: cleanWidgets,
    filters: (DataLaVistaState.design.filters || []).map(f => ({
      field: f.field || '',
      label: f.label || f.field || '',
      position: f.position || 'bar'
    })),
    conditions: (DataLaVistaState.design.conditions || []).map(c => ({ conj: c.conj || 'AND', field: c.field || '', op: c.op || '=', value: c.value || '' })),
    sorts: (DataLaVistaState.design.sorts || []).map(s => ({ field: s.field || '', dir: s.dir || 'ASC' })),
    groupBy: (DataLaVistaState.design.groupBy || []).filter(g => g),
    fieldAggs: Object.assign({}, DataLaVistaState.design.fieldAggs || {})
  };

  return {
    _license: 'This file is part of DataLaVista. This is a configuration script for a report designed in DataLaVista. Copyright © 2026 The Regents of the University of Michigan. This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses.',
    activeTab: (DataLaVistaState.reportMode === 'view') ? 'dashboardPreview' : 'design',
    advancedQB: DataLaVistaState.advancedQB || {},
    basicQB: DataLaVistaState.basicQB || {},
    charts: DataLaVistaState.charts || {},
    currentWidgetId: DataLaVistaState.currentWidgetId || null,
    dataSources: dataSourcesMeta,
    design: cleanDesign,
    previewFilters: DataLaVistaState.previewFilters || {},
    previewResults: Array.isArray(previewResults) ? [...previewResults] : [],
    qbCollapsed: DataLaVistaState.qbCollapsed || false,
    qbSectionHeight: DataLaVistaState.qbSectionHeight || 60,
    qmTab: DataLaVistaState.qmTab || 'dataPreview',
    queryColumns: Array.isArray(DataLaVistaState.queryColumns) ? [...DataLaVistaState.queryColumns] : [],    
    queryMode: (DataLaVistaState.queryMode && DataLaVistaState.queryMode != null && DataLaVistaState.queryMode != undefined && DataLaVistaState.queryMode != '') ? DataLaVistaState.queryMode : 'sql',
    queryResults: Array.isArray(DataLaVistaState.queryResults) ? [...DataLaVistaState.queryResults] : [],
    queryResultsReady: DataLaVistaState.queryResultsReady || false,
    sql: DataLaVistaState.sql || '',
    sqlLocked: DataLaVistaState.sqlLocked || false,
    tables: tablesMeta
  };
}

async function loadConfig(cfg) {
  console.log("+++++++ Entred loadConfig at: " + new Date().toISOString());
  if (!cfg._license) throw new Error('Invalid report config — missing _license key');
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

  console.log("DEBUG: Config object validated, proceeding to load DataLaVistaState.");
  // Basic validation passed — now clear the existing state and load the config values
  //{ ...cfg.dataSource } || { type: 'sharepoint', url: '', auth: 'current' };
  DataLaVistaState.activeTab = (DataLaVistaState.reportMode==='view')?'dataPreview':'design';
  DataLaVistaState.advancedQB = cfg.advancedQB || {};
  DataLaVistaState.basicQB = cfg.basicQB || {};
  DataLaVistaState.charts = cfg.charts || {};
  DataLaVistaState.currentWidgetId = null;
  DataLaVistaState.dataSources = cfg.dataSources || {};
  const loadedDesign = cfg.design || {};
  DataLaVistaState.design = {
    title: loadedDesign.title || 'DataLaVista Report',
    widgets: loadedDesign.widgets || [],
    filters: loadedDesign.filters || [],
    conditions: loadedDesign.conditions || [],
    sorts: loadedDesign.sorts || [],
    groupBy: loadedDesign.groupBy || [],
    fieldAggs: loadedDesign.fieldAggs || {},
    transformedResults: null
  };
  DataLaVistaState.previewFilters = cfg.previewFilters || {};
  DataLaVistaState.previewResults = Array.isArray(cfg.previewResults) ? [...cfg.previewResults] : [];
  DataLaVistaState.qmTab = cfg.qmTab || 'previewData';
  DataLaVistaState.queryColumns = Array.isArray(cfg.queryColumns) ? [...cfg.queryColumns] : [];
  DataLaVistaState.queryMode = (cfg.queryMode && cfg.queryMode != null && cfg.queryMode != undefined && cfg.queryMode != '') ? cfg.queryMode : 'sql';
  DataLaVistaState.queryResults = Array.isArray(cfg.queryResults) ? [...cfg.queryResults] : [];
  DataLaVistaState.queryResultsReady = cfg.queryResultsReady || false;
  // Don't load reportMode or reportUrl from config - it's handled by init()
  DataLaVistaState.sql = cfg.sql || '';
  DataLaVistaState.sqlLocked = cfg.sqlLocked || false;
  DataLaVistaState.tables = cfg.tables || {};

  // Background fetch for referenced tables
  if (DataLaVistaState.sql) {
    const referencedTables = findReferencedTables(DataLaVistaState.sql);
    console.log('==== loadConfig->referencedTables ====');
    for (const tname of referencedTables) {
      console.log('>>>>>>>   loadConfig->referencedTables->loop->ensureTAbleData. Table: ', tname);
      await ensureTableData(tname, true)
    }
  }
  
  if (DataLaVistaState.sql && window._cmEditor) {
    window._cmEditor.setValue(DataLaVistaState.sql);
  }

  updateConnectButton();
  document.getElementById('btn-save-config').disabled = false;

  console.log('DEBUG: loadConfig -> renderFilterBar');
  renderFilterBar();
  if(DataLaVistaState.reportMode !== 'view') {
    const titleInput = document.getElementById('title-input');
    if (titleInput) titleInput.value = DataLaVistaState.design.title || '';
    renderDesignCanvas();
    renderFieldsPanel();
    setStatus('✅ Config loaded');
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
            showCtxMenu(e, { level: 'ds', dsName, isFileUpload: ds.type === 'csv' });
          });

          dsGroup.appendChild(dsHeader);

          // Tables container
          const tablesWrap = document.createElement('div');
          tablesWrap.className = 'ds-group-tables';
          tablesWrap.id = 'ds-tables-' + CSS.escape(dsName);

          for (const tkey of tableKeys) {
            const t = DataLaVistaState.tables[tkey];
            // Strip the DS prefix for display (users already see it in the group header)
            const tAlias = t.alias || t.displayName || tkey;
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
              showCtxMenu(e, { level: 'table', tableKey: tkey, dsName, isFileUpload: ds.type === 'csv' });
            });

            // Build fields list, sorted alphabetically
            const flist = node.querySelector('.fields-list');
            const sortedFields = [...t.fields]
              .sort((a, b) => (a.alias || a.displayName || '').localeCompare(b.alias || b.displayName || ''));
              //TODO: removed this from above .sort:  .filter(f => !f.isAutoId)

            for (const f of sortedFields) {
              const ti = DataLaVistaCore.FIELD_TYPE_ICONS[f.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
              const fitem = document.createElement('div');
              fitem.className = 'field-item';
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
              // Right-click on field: only "Rename"
              fitem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showCtxMenu(e, { level: 'field', tableKey: tkey, fieldAlias: f.alias });
              });
              flist.appendChild(fitem);
            }

            // Auto-expand tables by default
            flist.classList.remove('hidden');
            const arrow = node.querySelector('.toggle-arrow');
            if (arrow) arrow.classList.add('open');

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
        Object.keys(DataLaVistaState.tables).forEach(t => {
          document.getElementById('fields-' + CSS.escape(t))?.classList.remove('hidden');
          document.getElementById('arrow-' + CSS.escape(t))?.classList.add('open');
        });
        Object.keys(DataLaVistaState.dataSources).forEach(ds => {
          const wrap = document.getElementById('ds-tables-' + CSS.escape(ds));
          const toggle = document.getElementById('ds-toggle-' + CSS.escape(ds));
          if (wrap) wrap.style.display = '';
          if (toggle) toggle.classList.add('open');
        });
      }
      function collapseAllTables() {
        Object.keys(DataLaVistaState.tables).forEach(t => {
          document.getElementById('fields-' + CSS.escape(t))?.classList.add('hidden');
          document.getElementById('arrow-' + CSS.escape(t))?.classList.remove('open');
        });
      }

