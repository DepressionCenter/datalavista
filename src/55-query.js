/* ============================================================
This file is part of DataLaVista™
55-query.js: Query execution, result type detection, and query preview.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-04
Summary: Query execution, result type detection, and query preview.
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
      // RUN QUERY
      // ============================================================
      async function runQuery() {
        const sql = window._cmEditor ? window._cmEditor.getValue() : DataLaVistaState.sql;
        if (!sql.trim()) { toast('Please enter a SQL query', 'error'); return; }
        DataLaVistaState.sql = sql;

        setStatus('Running query...', 'loading');

        try {
          // Find referenced tables
          const referencedTables = findReferencedTables(sql);

          // Load data for all referenced tables
          for (const tname of referencedTables) {
            await ensureTableData(tname,true);
          }

          // Register each referenced table in AlaSQL under its raw table name (_raw_<tableKey>)
          // AND create/update the view that maps aliases to internal names
          for (const tname of referencedTables) {
            const t = DataLaVistaState.tables[tname];
            if (!t || !t.data) continue;
            
            // Register the raw table: _raw_SP_PeopleList
            registerTableInAlaSQL(tname);
            
            // Create/update the view: SP_Contacts -> SELECT [alias] AS [internalName] FROM [_raw_SP_PeopleList]
            // This ensures the view exists and is up-to-date with the latest field mappings
            const viewName = t.viewName || CyberdynePipeline.getViewForTable(tname);
            if (viewName) {
              try {
                CyberdynePipeline.updateViewSQL(viewName);
              } catch (e) {
                console.warn(`[runQuery] Failed to update view ${viewName}:`, e.message);
                // If view doesn't exist yet, create it
                if (!CyberdynePipeline.views[viewName]) {
                  CyberdynePipeline.createView(tname, viewName, t.fields || []);
                }
              }
            }
          }

          // Execute SQL once, then store results in a named AlaSQL table so
          // per-widget queries scan a materialized dataset instead of re-running joins.
          const processedSQL = preprocessSQL(sql);
          const sampleRows = alasql(processedSQL);
          if (!Array.isArray(sampleRows)) throw new Error('Query returned no results');

          alasql('DROP TABLE IF EXISTS [dlv_results]');
          alasql('DROP VIEW  IF EXISTS [dlv_active]');
          alasql('CREATE TABLE [dlv_results]');
          alasql.tables['dlv_results'].data = sampleRows;   // O(1) reference assignment
          alasql('CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results]');
          DataLaVistaState.previewFilters = {};
          DataLaVistaState.design.previewFilteredData = null;
          DataLaVistaState.queryColumns = sampleRows.length ? Object.keys(sampleRows[0]) : [];

          // Show QB preview table
          showQueryPreview(sampleRows);
          // Reset design transforms when a new view arrives
          DataLaVistaState.design.transformedResults = null;
          applyDesignTransforms();
          renderDesignFieldsPanel();
          setStatus(`Query returned ${sampleRows.length} rows`, 'success');
          toast(`Query returned ${sampleRows.length} rows`, 'success');
        } catch (err) {
          console.error(err);
          toast('Query error: ' + err.message, 'error');
          setStatus('Query error: ' + err.message, 'error');
          hideUseInDesign();
        }
      }

      // Find all tables referenced in the SQL query by matching against both raw table keys and view names
      function findReferencedTables(sql) {
        // Users write SQL against view names only (e.g. SP_People, Depres_Consultations).
        // Map every view name → its raw table key, then scan the SQL once.
        const nameToKey = {};
        for (const [viewName, tkey] of Object.entries(CyberdynePipeline.viewToRawTable))
            nameToKey[viewName] = tkey;

        // Fallback: if no views registered yet, try matching raw table keys directly
        // (works for SP where viewName === tableKey, handles remaining legacy configs)
        if (!Object.keys(nameToKey).length) {
            for (const tkey of Object.keys(DataLaVistaState.tables))
                nameToKey[tkey] = tkey;
        }
        if (!Object.keys(nameToKey).length) return [];
 
        const esc = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = Object.keys(nameToKey).map(n => `\\[${esc(n)}\\]|\\b${esc(n)}\\b`).join('|');
        const seen = new Set();
        for (const m of (sql.match(new RegExp(pattern, 'gi')) || []))
          seen.add(nameToKey[m.replace(/^\[|\]$/g, '')]);
        seen.delete(undefined);
        return [...seen];
      }

      // Show query results preview in the Query Builder tab, and enable "Use in Design" if there are results
      function showQueryPreview(results) {
        const wrap  = document.getElementById('preview-table-wrap');
        const count = document.getElementById('preview-row-count');
        count.textContent = `${results.length} rows (showing top 20)`;

        if (!results.length) {
          wrap.innerHTML = '<div class="text-muted text-sm" style="padding:12px">No results</div>';
          hideUseInDesign();
          return;
        }

        const cols  = Object.keys(results[0]);
        const top20 = results.slice(0, 20);
        let html = '<table><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        for (const row of top20) {
          html += '<tr>' + cols.map(c => `<td title="${row[c] ?? ''}">${row[c] ?? ''}</td>`).join('') + '</tr>';
        }
        html += '</tbody></table>';
        wrap.innerHTML = html;
        showUseInDesign();
      }

      function showUseInDesign() {
        const btn = document.getElementById('btn-use-in-design');
        if (btn) btn.style.display = '';
        DataLaVistaState.queryResultsReady = true;
        setDesignTabsEnabled(true);
      }
      function hideUseInDesign() {
        const btn = document.getElementById('btn-use-in-design');
        if (btn) btn.style.display = 'none';
        DataLaVistaState.queryResultsReady = false;
        setDesignTabsEnabled(false, 'Run a query first to use Design, Preview, and Generate');
      }

      function toggleAdvOptionsPanel() {
        const panel = document.getElementById('adv-options-panel');
        const btn   = document.getElementById('adv-opts-toggle');
        const collapsed = panel.classList.toggle('collapsed');
        btn.textContent = collapsed ? '▶' : '◀';
        btn.title       = collapsed ? 'Expand panel' : 'Collapse panel';
      }

      function useResultsInDesign() {
        switchTab('design');
        toast('Switched to Design tab — drag widgets onto the canvas', 'success');
      }


  // Build alias→displayType map from all loaded tables
  // TODO: Need to keep track of source ds/table/internal field ID/data type
  // This will probably break if two tables have the a field with the same alias but different types
  function sniffType(col) {
    const typeMap = {};
    for (const t of Object.values(DataLaVistaState.tables)) {
      for (const f of (t.fields || [])) {
        if (f.alias && f.displayType) typeMap[f.alias] = f.displayType;
      }
    }
    if (typeMap[col]) return typeMap[col];
    // Fallback: sniff type from first row of the materialized results table
    const firstRow = (() => {
      if (alasql.tables && alasql.tables['dlv_results']) {
        try { return alasql('SELECT * FROM [dlv_results] WHERE ' + col + ' IS NOT NULL')[0] || null; } catch (_) { return null; }
      }
      return null;
    })();

    if (!firstRow) return 'default';
    const v = firstRow[col];
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean' ||
      (typeof v === 'string' &&
        (v.toLowerCase() === 'true' || v.toLowerCase() === 'false' || v === 'yes' || v === 'no')
      )
    ) return 'boolean';
    if (typeof v === 'object') return 'object';
    if (typeof v === 'date' || 
      (typeof v === 'string' && ISO_DATE_RE.test(v))
    ) return 'date';
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(v)) return 'number';
    return 'text';
  }