/* ============================================================
This file is part of DataLaVista
27-cyberdyne-views.js: View management for CyberdynePipeline
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-28
Last Modified: 2026-03-31
Summary: AlaSQL view creation and management — maps raw tables to user-friendly aliases
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
   VIEW MANAGEMENT — Continuation of CyberdynePipeline
   Views sit between raw AlaSQL tables and the user interface.
   Users see/rename views; the underlying raw table key never changes.
============================================================ */
Object.assign(CyberdynePipeline, {

  /* ===== VIEW STORAGE ===== */
  views: {},           // viewName → { rawTable, columnMappings, fields, createdAt }
  viewToRawTable: {},  // viewName → rawTableName
  rawTableToView: {},  // rawTableName → viewName

  /* ============================================================
     VIEW CREATION
  ============================================================ */

  /**
   * Create (or replace) an AlaSQL view for a raw table.
   * Returns the final viewName (may differ if there was a collision).
   */
  createView(rawTableName, viewName, fields) {
    // Deduplicate: if this viewName already belongs to a DIFFERENT raw table, suffix it
    if (this.views[viewName] && this.views[viewName].rawTable !== rawTableName) {
      let counter = 2;
      while (this.views[viewName + counter]) counter++;
      viewName = viewName + counter;
    }

    // Build column mappings: alias → internalName
    const columnMappings = {};
    for (const field of (fields || [])) {
      if (field.alias && field.internalName) {
        columnMappings[field.alias] = field.internalName;
      }
    }

    this.views[viewName] = { rawTable: rawTableName, columnMappings, fields: fields || [], createdAt: new Date().toISOString() };
    this.viewToRawTable[viewName] = rawTableName;
    this.rawTableToView[rawTableName] = viewName;

    // Create the AlaSQL view SQL (best-effort — raw table may not exist yet for lazy SP lists)
    try { this._applyViewSQL(viewName); } catch (e) { console.warn('[CyberdynePipeline] View SQL deferred (table not yet loaded):', viewName, e.message); }

    return viewName;
  },

  /** Build and execute the AlaSQL CREATE VIEW statement for a view */
  _applyViewSQL(viewName) {
    const view = this.views[viewName];
    if (!view) return;
    const cols = [];
    for (const [alias, internalName] of Object.entries(view.columnMappings)) {
      cols.push(alias === internalName ? `[${internalName}]` : `[${internalName}] AS [${alias}]`);
    }
    if (cols.length === 0) return; // Nothing to select yet (lazy SP list)
    try { alasql(`DROP VIEW [${viewName}]`); } catch (_) {} // May not exist on first creation
    alasql(`CREATE VIEW [${viewName}] AS SELECT ${cols.join(', ')} FROM [_raw_${view.rawTable}]`);
  },

  /** Recreate the AlaSQL view with current column mappings (call after alias changes) */
  updateViewSQL(viewName) {
    try {
      alasql(`DROP VIEW IF EXISTS [${viewName}]`);
    } catch (_) {}
    this._applyViewSQL(viewName);
  },

  /* ============================================================
     VIEW RENAME
  ============================================================ */

  /** Rename a view (and update all mappings). Returns the new name. */
  renameView(oldName, newName) {
    if (!this.views[oldName]) throw new Error(`View "${oldName}" not found`);
    if (this.views[newName] && newName !== oldName) throw new Error(`View "${newName}" already exists`);
    const view = this.views[oldName];
    try { alasql(`DROP VIEW IF EXISTS [${oldName}]`); } catch (_) {}
    delete this.views[oldName];
    delete this.viewToRawTable[oldName];
    this.views[newName] = view;
    this.viewToRawTable[newName] = view.rawTable;
    this.rawTableToView[view.rawTable] = newName;
    try { this._applyViewSQL(newName); } catch (e) { console.warn('[CyberdynePipeline] renameView SQL failed:', e.message); }
    return newName;
  },

  /* ============================================================
     COLUMN ALIAS MANAGEMENT
  ============================================================ */

  /** Update a single column's alias in a view */
  updateColumnAlias(viewName, internalName, newAlias) {
    const view = this.views[viewName];
    if (!view) throw new Error(`View "${viewName}" not found`);
    // Remove old alias for this internal name
    for (const [alias, iName] of Object.entries(view.columnMappings)) {
      if (iName === internalName) { delete view.columnMappings[alias]; break; }
    }
    view.columnMappings[newAlias] = internalName;
    // Update the field's alias in the view's fields array
    const field = view.fields.find(f => f.internalName === internalName);
    if (field) field.alias = newAlias;
    this.updateViewSQL(viewName);
  },

  /** Add a new field's column mapping to an existing view */
  addColumnToView(viewName, field) {
    const view = this.views[viewName];
    if (!view) return;
    view.columnMappings[field.alias] = field.internalName;
    if (!view.fields.find(f => f.internalName === field.internalName)) {
      view.fields.push(field);
    }
    this.updateViewSQL(viewName);
  },

  /* ============================================================
     VIEW DELETION
  ============================================================ */

  /** Drop a view (AlaSQL + internal state). Does NOT drop the underlying raw table. */
  deleteView(viewName) {
    const view = this.views[viewName];
    if (!view) return;
    try { alasql(`DROP VIEW IF EXISTS [${viewName}]`); } catch (_) {}
    delete this.rawTableToView[view.rawTable];
    delete this.viewToRawTable[viewName];
    delete this.views[viewName];
  },

  /* ============================================================
     VIEW LOOKUPS
  ============================================================ */

  getViewForTable(rawTableName)  { return this.rawTableToView[rawTableName] || null; },
  getRawTableForView(viewName)   { return this.viewToRawTable[viewName] || null; },
  getViewColumns(viewName)       { return this.views[viewName] ? Object.keys(this.views[viewName].columnMappings) : []; },
  getViewField(viewName, alias)  { return this.views[viewName] ? (this.views[viewName].fields.find(f => f.alias === alias) || null) : null; },

  /* ============================================================
     DATA SOURCE REGISTRATION
  ============================================================ */

  /**
   * Register a fully-loaded data source (non-SP) into DataLaVistaState + AlaSQL + views.
   * @param {string} dsName - data source internal name
   * @param {object} dsMetadata - { type, fileName, url, isFileUpload }
   * @param {Array}  tables - array of { tableName, data, fields, metadata }
   * @param {Array}  [foreignKeys] - optional SQLite FK array [{ fromTable, fromCol, toTable, toCol }]
   */
  registerDataSource(dsName, dsMetadata, tables, foreignKeys) {
    // Create or update the data source entry
    if (!DataLaVistaState.dataSources[dsName]) {
      DataLaVistaState.dataSources[dsName] = {
        alias: dsName, auth: null, description: '', internalName: dsName,
        type: dsMetadata.type || 'unknown', tables: [],
        fileName: dsMetadata.fileName || '',
        isFileUpload: dsMetadata.isFileUpload || false,
        keepRawData: dsMetadata.isFileUpload || false,
        url: dsMetadata.url || null,
        siteUrl: null, token: ''
      };
    }
    const ds = DataLaVistaState.dataSources[dsName];

    for (const table of tables) {
      const rawTableName = table.tableName;
      // View name = DS-prefixed raw table name (e.g. "Depres_Consultations").
      // Table alias = short user-facing name without DS prefix (e.g. "Consultations").
      // Raw AlaSQL table uses _raw_ prefix to avoid conflict with the view name.
      const viewName = rawTableName;
      const tableAlias = toPascalCase(rawTableName.replace(new RegExp('^' + normalizeDataSourceName(dsName) + '_?'), '')) || rawTableName;

      // Register data in AlaSQL
      this._registerRawTable(rawTableName, table.data);

      // Store table metadata in state
      DataLaVistaState.tables[rawTableName] = {
        internalName: rawTableName,
        displayName: table.metadata.fileName || rawTableName,
        alias: tableAlias,
        dsAlias: dsName,
        dataSource: dsName,
        fields: table.fields,
        data: table.data,
        loaded: true,
        sourceType: table.metadata.sourceType || dsMetadata.type,
        isFileUpload: table.metadata.isFileUpload || false,
        keepRawData: table.metadata.isFileUpload || false,
        fileName: table.metadata.fileName || '',
        url: table.metadata.url || null,
        siteUrl: null,
        itemCount: table.data.length,
        internalTableName: table.metadata.internalTableName || rawTableName
      };

      // Register in data source table list
      if (!ds.tables.includes(rawTableName)) ds.tables.push(rawTableName);

      // Create view
      const finalViewName = this.createView(rawTableName, viewName, table.fields);
      DataLaVistaState.tables[rawTableName].viewName = finalViewName;
    }

    // Register SQLite foreign key relationships if provided
    if (foreignKeys && foreignKeys.length > 0) {
      this.registerSqliteFkRelationships(dsName, foreignKeys);
    }
  },

  /* ============================================================
     DATA SOURCE REFRESH (re-upload / remote refresh)
  ============================================================ */

  /**
   * Full-replace a registered data source with new table data.
   * Preserves existing field aliases for tables/fields that survive; drops removed tables; adds new ones.
   * @param {string} dsName - data source internal name
   * @param {object} dsMetadata - { type, fileName, url, isFileUpload }
   * @param {Array}  tables - array of { tableName, data, fields, metadata }
   */
  refreshDataSourceTables(dsName, dsMetadata, tables) {
    const ds = DataLaVistaState.dataSources[dsName];
    if (!ds) {
      // Not yet registered — fall through to normal registration
      this.registerDataSource(dsName, dsMetadata, tables);
      return;
    }

    // Update DS-level metadata
    ds.type = dsMetadata.type || ds.type;
    ds.fileName = dsMetadata.fileName || ds.fileName;
    ds.url = dsMetadata.url || ds.url;
    ds.isFileUpload = dsMetadata.isFileUpload != null ? dsMetadata.isFileUpload : ds.isFileUpload;
    ds.keepRawData = ds.isFileUpload || false;

    const newTableInternalNames = new Set(tables.map(t => t.metadata?.internalTableName || t.tableName));
    const oldTableKeys = [...ds.tables];

    // --- Drop tables that are no longer in the new file ---
    for (const oldKey of oldTableKeys) {
      const oldTable = DataLaVistaState.tables[oldKey];
      const oldInternalName = oldTable?.internalTableName || oldKey;
      if (!newTableInternalNames.has(oldInternalName)) {
        const viewName = this.rawTableToView[oldKey];
        if (viewName) this.deleteView(viewName);
        try { alasql(`DROP TABLE IF EXISTS [${oldKey}]`); } catch (_) {}
        delete DataLaVistaState.tables[oldKey];
        ds.tables = ds.tables.filter(k => k !== oldKey);
      }
    }

    // --- Update matching tables, add new ones ---
    for (const table of tables) {
      const internalTableName = table.metadata?.internalTableName || table.tableName;
      const rawTableName = table.tableName;

      // Find existing table entry by internalTableName
      const existingKey = oldTableKeys.find(k => {
        const t = DataLaVistaState.tables[k];
        return t && (t.internalTableName === internalTableName || k === rawTableName);
      });

      if (existingKey && DataLaVistaState.tables[existingKey]) {
        // --- Update existing table: preserve field aliases ---
        const existingTable = DataLaVistaState.tables[existingKey];
        const existingFieldMap = {}; // internalName → existing alias
        for (const ef of (existingTable.fields || [])) {
          existingFieldMap[ef.internalName] = ef.alias;
        }

        // Merge field aliases into new fields
        const mergedFields = table.fields.map(f => ({
          ...f,
          alias: existingFieldMap[f.internalName] || f.alias
        }));

        // Update state
        existingTable.fields = mergedFields;
        existingTable.data = table.data;
        existingTable.loaded = true;
        existingTable.itemCount = table.data.length;

        // Re-register raw data in AlaSQL
        this._registerRawTable(existingKey, table.data);

        // Rebuild view with updated (alias-preserving) field list
        const viewName = this.rawTableToView[existingKey];
        if (viewName && this.views[viewName]) {
          this.views[viewName].fields = mergedFields;
          this.views[viewName].columnMappings = {};
          for (const f of mergedFields) {
            if (f.alias && f.internalName) this.views[viewName].columnMappings[f.alias] = f.internalName;
          }
          try { this.updateViewSQL(viewName); } catch (e) { console.warn('[refreshDataSourceTables] updateViewSQL:', e.message); }
        }

      } else {
        // --- New table: register fresh ---
        const defaultViewName = rawTableName; // DS-prefixed view name
        const defaultAlias = toPascalCase(rawTableName.replace(new RegExp('^' + normalizeDataSourceName(dsName) + '_?'), '')) || rawTableName;
        this._registerRawTable(rawTableName, table.data);
        DataLaVistaState.tables[rawTableName] = {
          internalName: rawTableName,
          displayName: table.metadata?.fileName || rawTableName,
          alias: defaultAlias,
          dsAlias: dsName,
          dataSource: dsName,
          fields: table.fields,
          data: table.data,
          loaded: true,
          sourceType: table.metadata?.sourceType || dsMetadata.type,
          isFileUpload: table.metadata?.isFileUpload || false,
          keepRawData: table.metadata?.isFileUpload || false,
          fileName: table.metadata?.fileName || '',
          url: table.metadata?.url || null,
          siteUrl: null,
          itemCount: table.data.length,
          internalTableName: internalTableName
        };
        if (!ds.tables.includes(rawTableName)) ds.tables.push(rawTableName);
        const finalViewName = this.createView(rawTableName, defaultViewName, table.fields);
        DataLaVistaState.tables[rawTableName].viewName = finalViewName;
        DataLaVistaState.tables[rawTableName].alias = defaultAlias; // preserve short alias if createView suffixed viewName
      }
    }
  },

  /* ============================================================
     RELATIONSHIP REGISTRY
  ============================================================ */

  /** Generate a unique relationship ID */
  _nextRelId() {
    return 'rel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  },

  /**
   * Register SQLite foreign key relationships for a data source.
   * @param {string} dsName
   * @param {Array} foreignKeys - [{ fromTable, fromCol, toTable, toCol }]
   */
  registerSqliteFkRelationships(dsName, foreignKeys) {
    if (!foreignKeys || foreignKeys.length === 0) return;
    const prefix = normalizeDataSourceName(dsName) + '_';
    for (const fk of foreignKeys) {
      const childTableKey = prefix + fk.fromTable;
      const parentTableKey = prefix + fk.toTable;
      // Only register if both tables are known
      if (!DataLaVistaState.tables[childTableKey] || !DataLaVistaState.tables[parentTableKey]) continue;
      // Avoid duplicates
      const exists = DataLaVistaState.relationships.some(r =>
        r.childTableKey === childTableKey && r.childField === fk.fromCol &&
        r.parentTableKey === parentTableKey && r.parentField === fk.toCol
      );
      if (!exists) {
        DataLaVistaState.relationships.push({
          id: this._nextRelId(),
          source: 'sqlite-fk',
          childTableKey,
          childField: fk.fromCol,
          parentTableKey,
          parentField: fk.toCol,
          joinType: 'LEFT',
          spLookupField: null
        });
      }
    }
  },

  /**
   * Register SharePoint lookup field relationships for a data source.
   * Matches LookupList GUID against known table GUIDs.
   * Call after all SP lists for the DS have been registered.
   * @param {string} dsName
   */
  registerSpLookupRelationships(dsName) {
    const ds = DataLaVistaState.dataSources[dsName];
    if (!ds) return;

    // Build a map from normalized GUID → tableKey for all known SP tables
    const guidToTableKey = {};
    for (const [tableKey, table] of Object.entries(DataLaVistaState.tables)) {
      if (table.guid) {
        const normalizedGuid = table.guid.replace(/[{}]/g, '').toLowerCase();
        guidToTableKey[normalizedGuid] = tableKey;
      }
    }

    for (const childTableKey of ds.tables) {
      const childTable = DataLaVistaState.tables[childTableKey];
      if (!childTable) continue;
      for (const field of (childTable.fields || [])) {
        if (!field.lookupList) continue;
        const normalizedGuid = field.lookupList.replace(/[{}]/g, '').toLowerCase();
        const parentTableKey = guidToTableKey[normalizedGuid];
        if (!parentTableKey || parentTableKey === childTableKey) continue;

        // Use the synthetic Data field for INCLUDES joins
        const childDataField = field.internalName + 'Data';
        const exists = DataLaVistaState.relationships.some(r =>
          r.childTableKey === childTableKey && r.spLookupField === field.internalName &&
          r.parentTableKey === parentTableKey
        );
        if (!exists) {
          DataLaVistaState.relationships.push({
            id: this._nextRelId(),
            source: 'sharepoint-lookup',
            childTableKey,
            childField: childDataField,
            parentTableKey,
            parentField: 'ID',
            joinType: 'LEFT',
            spLookupField: field.internalName
          });
        }
      }
    }
  },

  /* ============================================================
     SHAREPOINT LIST REGISTRATION (lazy-loading compatible)
  ============================================================ */

  /**
   * Register a SharePoint list placeholder (data loads later).
   * Creates an empty view that will be updated when data loads.
   */
  registerSharePointList(dsName, tableKey, listTitle, fields) {
    // View name = DS prefix + PascalCase of display name (e.g. "Depres_Consultations").
    // Raw table (tableKey) uses entity type name (e.g. "Depres_EngagementHistory").
    // Table alias = view name minus DS prefix (e.g. "Consultations").
    const dsPrefix = normalizeDataSourceName(dsName) + '_';
    const displayPart = toPascalCase(listTitle) || tableKey.replace(new RegExp('^' + dsPrefix), '');
    const viewName = dsPrefix + displayPart;
    const tableAlias = displayPart;
    this.views[viewName] = { rawTable: tableKey, columnMappings: {}, fields: [], createdAt: new Date().toISOString() };
    this.viewToRawTable[viewName] = tableKey;
    this.rawTableToView[tableKey] = viewName;
    if (DataLaVistaState.tables[tableKey]) {
      DataLaVistaState.tables[tableKey].viewName = viewName;
      DataLaVistaState.tables[tableKey].alias = tableAlias;
    }
    if (fields && fields.length > 0) {
      this.views[viewName].fields = fields;
      for (const f of fields) this.views[viewName].columnMappings[f.alias] = f.internalName;
      try { this._applyViewSQL(viewName); } catch (_) {}
    }
    return viewName;
  },

  /**
   * Update a SharePoint list's view after data has been loaded into AlaSQL.
   * Called by fetchTableData() after a successful SP fetch.
   */
  updateSharePointListView(rawTableName, fields) {
    const viewName = this.rawTableToView[rawTableName];
    if (!viewName || !this.views[viewName]) return;
    const view = this.views[viewName];
    view.fields = fields;
    view.columnMappings = {};
    for (const f of fields) view.columnMappings[f.alias] = f.internalName;
    try { this.updateViewSQL(viewName); } catch (e) { console.warn('[CyberdynePipeline] updateSharePointListView SQL failed:', e.message); }
  },

  /* ============================================================
     CONFIG SERIALIZATION
  ============================================================ */

  /** Build view definitions for config export */
  buildViewsForConfig() {
    const viewDefs = {};
    for (const [viewName, view] of Object.entries(this.views)) {
      viewDefs[viewName] = { rawTable: view.rawTable, columnMappings: view.columnMappings, fields: view.fields };
    }
    return viewDefs;
  },

  /** Restore views from a saved config */
  restoreViewsFromConfig(viewDefs) {
    if (!viewDefs) return;
    for (const [viewName, viewDef] of Object.entries(viewDefs)) {
      this.views[viewName] = { ...viewDef, createdAt: new Date().toISOString() };
      this.viewToRawTable[viewName] = viewDef.rawTable;
      this.rawTableToView[viewDef.rawTable] = viewName;
      try { this._applyViewSQL(viewName); } catch (e) { console.warn('[CyberdynePipeline] restoreViews failed for', viewName, e.message); }
    }
  },

  /** Clear all views (used when resetting state for loadConfig) */
  clearAllViews() {
    for (const viewName of Object.keys(this.views)) {
      try { alasql(`DROP VIEW IF EXISTS [${viewName}]`); } catch (_) {}
    }
    this.views = {};
    this.viewToRawTable = {};
    this.rawTableToView = {};
  }

}); // End CyberdynePipeline view management
