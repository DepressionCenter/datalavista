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
        console.log('DEBUG: ' + Date.now() + ': Entered runQuery()');
        const sql = window._cmEditor ? window._cmEditor.getValue() : DataLaVistaState.sql;
        if (!sql.trim() && DataLaVistaState.reportMode !== 'view') { toast('Please enter a SQL query', 'error'); return; }
        DataLaVistaState.sql = sql;

        if (DataLaVistaState.reportMode === 'view') setStatus('Running query...', 'loading');

        // Clear previous results before running
        const previewWrap = document.getElementById('preview-table-wrap');
        const previewCount = document.getElementById('preview-row-count');
        if (previewWrap) previewWrap.innerHTML = '';
        if (previewCount) previewCount.textContent = '';
        hideUseInDesign();

        try {
          console.log('DEBUG: ' + Date.now() + ': Awaiting _executeQuery()...');
          const results = await _executeQuery(sql);
          console.log('DEBUG: ' + Date.now() + ': _executeQuery() completed with # results:', results.length);
          // Evict autosuggest cache for dlv_results/dlv_active — columns may have changed
          console.log('DEBUG: ' + Date.now() + ': Calling _dlvAcEvict("|") to clear autosuggest cache for dlv_results/dlv_active');
          _dlvAcEvict('|');
          console.log('DEBUG: ' + Date.now() + ': Calling showQueryPreview()...');
          showQueryPreview(results);
          console.log('DEBUG: ' + Date.now() + ': Calling renderDesignFieldsPanel()...');
          renderDesignFieldsPanel();
          if (DataLaVistaState.reportMode !== 'view') showUseInDesign();
          setStatus(`Query returned ${results.length} rows`, 'success');
          toast(`Query returned ${results.length} rows`, 'success');
        } catch (err) {
          console.log('DEBUG: ' + Date.now() + ': Error occurred while executing query:', err);
          console.error(err);
          toast('Query error: ' + err.message, 'error');
          setStatus('Query error: ' + err.message, 'error');
          hideUseInDesign();
        }
      }

      // Shared query execution core used by runQuery() and refreshDashboardPreview().
      // Loads table data, registers AlaSQL tables/views, runs the SQL, and materializes
      // results into [dlv_results] / [dlv_active]. Returns the result rows array.
      async function _executeQuery(sql) {
        console.log('DEBUG: ' + new Date().toLocaleString() + ': Entered _executeQuery()');
        const referencedTables = findReferencedTables(sql);
        console.log('DEBUG: ' + new Date().toLocaleString() + ': findReferencedTables() found referenced tables:', referencedTables);

        for (const tname of referencedTables) {
          console.log('DEBUG: ' + new Date().toLocaleString() + ': Ensuring data for referenced table:', tname);
          await ensureTableData(tname, true);
        }

        for (const tname of referencedTables) {
          const t = DataLaVistaState.tables[tname];
          if (!t || !t.data || !t.data.length) continue;

          console.log('DEBUG: ' + new Date().toLocaleString() + ': Registering table in AlaSQL:', tname);
          registerTableInAlaSQL(tname);

          const viewName = t.viewName || CyberdynePipeline.getViewForTable(tname);
          if (viewName) {
            // Only call updateViewSQL if the AlaSQL view object is missing — avoids errors
            // after loadConfig() which resets the metadata registry but not AlaSQL view objects.
            const alasqlViewExists = !!(alasql.tables?.[viewName]?.view);
            console.log('DEBUG: ' + new Date().toLocaleString() + ': Checking if AlaSQL view exists for', viewName, ':', alasqlViewExists);
            if (!alasqlViewExists) {
              try { CyberdynePipeline.updateViewSQL(viewName); }
              catch (e) {
                console.warn(`[_executeQuery] updateViewSQL failed for ${viewName}:`, e.message);
                if (!CyberdynePipeline.views[viewName]) {
                  CyberdynePipeline.createView(tname, viewName, t.fields || []);
                }
              }
            }
          }
        }

        // Ensure .select is compiled on all views before running JOINs.
        // New AlaSQL lazily compiles .select only when a view is used as primary FROM target;
        // JOIN targets need it pre-compiled or the query fails.
        for (const tname of referencedTables) {
          const t = DataLaVistaState.tables[tname];
          if (!t) continue;
          const viewName = t.viewName || CyberdynePipeline.getViewForTable(tname);
          if (viewName && alasql.tables?.[viewName]?.view) {
            if (typeof alasql.tables[viewName].select !== 'function') {
              try { alasql(`SELECT * FROM [${viewName}] LIMIT 0`); } catch(e) {
                console.warn(`[_executeQuery] Failed to pre-compile .select for view ${viewName}:`, e.message);
              }
            }
          }
        }

        console.log('DEBUG: Preprocessing SQL...');
        const processedSQL = preprocessSQL(sql);
        console.log('DEBUG: ' + new Date().toLocaleString() + ': Processed SQL ready for execution:', processedSQL);

        console.log('DEBUG: *** Executing SQL in AlaSQL... ***');
        const results = alasql(processedSQL);
        console.log('DEBUG: ' + new Date().toLocaleString() + ': ***AlaSQL execution completed.*** # results:', results.length);
        if (!Array.isArray(results)) throw new Error('Query returned no results');

        console.log('DEBUG: Materializing results into [dlv_results] and [dlv_active]...');
        // TODO: Instead of dropping/recreating tables/views on every query, could we ALTER TABLE? ALTER VIEW is not supported by alasql.
        alasql('DROP VIEW  IF EXISTS [dlv_active]');
        alasql('DROP TABLE IF EXISTS [dlv_results]');
        alasql('SELECT * INTO [dlv_results] FROM ?', [results]);
        alasql('CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results]');

        DataLaVistaState.queryResultsReady = true;
        DataLaVistaState.design.previewFilteredData = null;
        DataLaVistaState.queryColumns = results.length ? Object.keys(results[0]) : DataLaVistaState.queryColumns;

        return results;
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

        // Extract last LIMIT clause value from the current SQL (digits only — safe for attribute injection)
        const sql = DataLaVistaState.sql || '';
        const limitMatches = [...sql.matchAll(/\bLIMIT\s+(\d+)/gi)];
        const limitVal = limitMatches.length ? limitMatches[limitMatches.length - 1][1] : null;

        const previewTip = 'This preview displays a maximum of 20 rows.';
        const limitTip   = 'The number of results is currently limited to this number. Before publishing your dashboard, you may want to remove the row limit in the query builder properties.';
        const rowsSpan   = '<span data-dlv-tip="' + previewTip + '">' + results.length + ' rows (showing top 20)</span>';
        const limitSpan  = limitVal
          ? ' <span style="color:red;font-size:smaller" data-dlv-tip="' + limitTip + '">Results limited to: ' + limitVal + '</span>'
          : '';
        count.innerHTML = rowsSpan + limitSpan;

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