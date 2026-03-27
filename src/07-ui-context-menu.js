/* ============================================================
This file is part of DataLaVista
07-ui-context-menu.js: Right-click context menus and data source management.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
Summary: Right-click context menus and data source management.
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
      // RIGHT-CLICK CONTEXT MENU
      // ============================================================
      let _ctxTarget = null; // { level, dsName, tableKey, fieldAlias, isFileUpload }

      function showCtxMenu(e, target) {
        _ctxTarget = target;
        const menu = document.getElementById('dlv-ctx-menu');
        const copyUrlItem = document.getElementById('ctx-copy-url');
        const sepUrl = document.getElementById('ctx-sep-url');
        const deleteItem = document.getElementById('ctx-delete');

        // "Copy URL" only for DS/Table that are NOT file uploads
        const showCopyUrl = (target.level === 'ds' || target.level === 'table') && !target.isFileUpload;
        copyUrlItem.style.display = showCopyUrl ? '' : 'none';
        sepUrl.style.display = showCopyUrl ? '' : 'none';

        // "Delete" not available for fields
        deleteItem.style.display = target.level === 'field' ? 'none' : '';

        // Position
        menu.classList.add('visible');
        const mw = menu.offsetWidth || 170, mh = menu.offsetHeight || 90;
        let x = e.clientX, y = e.clientY;
        if (x + mw > window.innerWidth) x = window.innerWidth - mw - 4;
        if (y + mh > window.innerHeight) y = window.innerHeight - mh - 4;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
      }

      document.addEventListener('click', () => {
        document.getElementById('dlv-ctx-menu')?.classList.remove('visible');
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.getElementById('dlv-ctx-menu')?.classList.remove('visible');
      });

      function dlvCtxCopyUrl() {
        document.getElementById('dlv-ctx-menu').classList.remove('visible');
        if (!_ctxTarget) return;
        let url = '';
        if (_ctxTarget.level === 'ds') {
          const ds = DataLaVistaState.dataSources[_ctxTarget.dsName];
          url = ds ? (ds.url || '') : '';
        } else if (_ctxTarget.level === 'table') {
          const t = DataLaVistaState.tables[_ctxTarget.tableKey];
          const ds = t ? DataLaVistaState.dataSources[t.dataSource] : null;
          url = ds ? (ds.url || '') : '';
        }
        if (url) {
          navigator.clipboard.writeText(url).then(() => toast('URL copied to clipboard', 'success'), () => {
            prompt('Copy this URL:', url);
          });
        } else {
          toast('No URL available for this source', 'warning');
        }
      }

      function dlvCtxRename() {
        document.getElementById('dlv-ctx-menu').classList.remove('visible');
        if (!_ctxTarget) return;
        const { level, dsName, tableKey, fieldAlias } = _ctxTarget;

        if (level === 'ds') {
          const labelEl = document.getElementById('ds-label-' + CSS.escape(dsName));
          if (!labelEl) return;
          const currentVal = DataLaVistaState.dataSources[dsName].alias || dsName;
          const inp = document.createElement('input');
          inp.className = 'ds-group-name-input';
          inp.value = currentVal;
          inp.maxLength = 6;
          inp.oninput = () => { inp.value = inp.value.replace(/[^A-Za-z0-9]/g, ''); };
          labelEl.replaceWith(inp);
          inp.focus(); inp.select();
          const commit = () => {
            const newName = inp.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || currentVal;
            renameDatasource(dsName, newName);
          };
          inp.addEventListener('blur', commit);
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { inp.blur(); }
            if (e.key === 'Escape') { inp.value = currentVal; inp.blur(); }
          });

        } else if (level === 'table') {
          const labelEl = document.getElementById('tlabel-' + CSS.escape(tableKey));
          if (!labelEl) return;
          const t = DataLaVistaState.tables[tableKey];
          const currentVal = t.alias || t.displayName || tableKey;
          const inp = document.createElement('input');
          inp.className = 'dlv-rename-input';
          inp.value = currentVal;
          inp.maxLength = 50;
          labelEl.replaceWith(inp);
          inp.focus(); inp.select();
          const commit = () => {
            const newAlias = inp.value.trim() || currentVal;
            renameTable(tableKey, newAlias);
          };
          inp.addEventListener('blur', commit);
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { inp.blur(); }
            if (e.key === 'Escape') { inp.value = currentVal; inp.blur(); }
          });

        } else if (level === 'field') {
          const labelEl = document.getElementById('flabel-' + CSS.escape(tableKey) + '-' + CSS.escape(fieldAlias));
          if (!labelEl) return;
          const t = DataLaVistaState.tables[tableKey];
          const f = t && t.fields.find(x => x.alias === fieldAlias);
          if (!f) return;
          const currentVal = f.alias;
          const inp = document.createElement('input');
          inp.className = 'dlv-rename-input';
          inp.value = currentVal;
          inp.maxLength = 50;
          labelEl.replaceWith(inp);
          inp.focus(); inp.select();
          const commit = () => {
            const newAlias = inp.value.trim() || currentVal;
            renameField(tableKey, fieldAlias, newAlias);
          };
          inp.addEventListener('blur', commit);
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { inp.blur(); }
            if (e.key === 'Escape') { inp.value = currentVal; inp.blur(); }
          });
        }
      }

      function dlvCtxDelete() {
        document.getElementById('dlv-ctx-menu').classList.remove('visible');
        if (!_ctxTarget) return;
        const { level, dsName, tableKey } = _ctxTarget;

        if (level === 'ds') {
          const ds = DataLaVistaState.dataSources[dsName];
          const label = ds ? (ds.alias || dsName) : dsName;
          if (!confirm(`Delete data source "${label}" and all its tables? This cannot be undone.`)) return;
          deleteDatasource(dsName);
        } else if (level === 'table') {
          const t = DataLaVistaState.tables[tableKey];
          const label = t ? (t.alias || t.displayName || tableKey) : tableKey;
          if (!confirm(`Delete table "${label}"? This cannot be undone.`)) return;
          deleteTable(tableKey);
        }
      }

      // ── Rename / Delete helpers ─────────────────────────────────────────────

      /**
       * Replace all occurrences of oldQName with newQName in the SQL editor,
       * using word-boundary matching to avoid partial replacements.
       */
      function updateSQLEditorName(oldQName, newQName) {
        if (!window._cmEditor || !oldQName || oldQName === newQName) return;
        const cur = window._cmEditor.getValue();
        const escaped = oldQName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(\\[)' + escaped + '(\\])|\\b' + escaped + '\\b', 'gi');
        const updated = cur.replace(re, (m, lb, rb) => lb ? '[' + newQName + ']' : newQName);
        if (updated !== cur) window._cmEditor.setValue(updated);
        DataLaVistaState.sql = window._cmEditor.getValue();
      }

      function renameDatasource(dsName, newAlias) {
        newAlias = (newAlias || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
        if (!newAlias) { renderFieldsPanel(); return; }
        const ds = DataLaVistaState.dataSources[dsName];
        if (!ds) return;
        const oldDsAlias = ds.alias;
        if (newAlias === oldDsAlias) { renderFieldsPanel(); return; }

        // For each table: update SQL editor (alias appears in FROM [key] [oldAlias_TableAlias])
        (ds.tables || []).forEach(tableKey => {
          const t = DataLaVistaState.tables[tableKey];
          if (!t) return;
          const oldQName = oldDsAlias + '_' + t.alias;
          const newQName = newAlias + '_' + t.alias;
          updateSQLEditorName(oldQName, newQName);
        });

        // Commit alias change and propagate to child tables
        ds.alias = newAlias;
        (ds.tables || []).forEach(tableKey => {
          const t = DataLaVistaState.tables[tableKey];
          if (t) t.dsAlias = newAlias;
        });

        // Rebuild QB SQL so FROM clauses use the new alias
        if (DataLaVistaState.basicQB.tableName) {
          const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
          if (t && t.dataSource === dsName) rebuildBasicSQL();
        }
        if (Object.keys(DataLaVistaState.advancedQB.nodes || {}).length) {
          const anyFromDs = Object.values(DataLaVistaState.advancedQB.nodes).some(nd => {
            const t = DataLaVistaState.tables[nd.tableName];
            return t && t.dataSource === dsName;
          });
          if (anyFromDs) rebuildAdvancedSQL();
        }

        renderFieldsPanel();
        setupCodeMirror();
        toast(`Data source renamed to "${newAlias}"`, 'success');
      }

      function renameTable(tableKey, newAlias) {
        const t = DataLaVistaState.tables[tableKey];
        if (!t) return;
        const oldQName = getTableQueryName(tableKey);
        t.alias = newAlias;
        const newQName = getTableQueryName(tableKey);

        // Update SQL editor: FROM alias and SELECT alias references
        updateSQLEditorName(oldQName, newQName);

        // Update advanced QB node alias if present
        for (const nd of Object.values(DataLaVistaState.advancedQB.nodes || {})) {
          if (nd.tableName === tableKey) { nd.alias = newAlias; }
        }

        // Rebuild QB SQL to use new alias in FROM clause
        if (DataLaVistaState.basicQB.tableName === tableKey) rebuildBasicSQL();
        if (Object.keys(DataLaVistaState.advancedQB.nodes || {}).length) rebuildAdvancedSQL();

        renderFieldsPanel();
        setupCodeMirror();
        toast(`Table renamed to "${newAlias}"`, 'success');
      }

      function renameField(tableKey, oldAlias, newAlias) {
        const t = DataLaVistaState.tables[tableKey];
        if (!t) return;
        const f = t.fields.find(x => x.alias === oldAlias);
        if (!f) return;
        f.alias = newAlias;
        // NOTE: data rows are keyed by internalName, not alias — no row migration needed.
        // The AS alias in generated SQL is what produces the output column name.

        // Update basicQB selectedFields (which track aliases)
        const sfIdx = DataLaVistaState.basicQB.selectedFields.indexOf(oldAlias);
        if (sfIdx !== -1) { DataLaVistaState.basicQB.selectedFields[sfIdx] = newAlias; rebuildBasicSQL(); }

        // Update advanced QB selectedFields in nodes
        for (const nd of Object.values(DataLaVistaState.advancedQB.nodes || {})) {
          if (nd.tableName === tableKey) {
            const fi = nd.selectedFields.indexOf(oldAlias);
            if (fi !== -1) nd.selectedFields[fi] = newAlias;
          }
        }
        if (Object.keys(DataLaVistaState.advancedQB.nodes || {}).length) rebuildAdvancedSQL();

        // Update design widgets
        (DataLaVistaState.design.widgets || []).forEach(w => {
          if (Array.isArray(w.fields)) {
            const fi = w.fields.indexOf(oldAlias);
            if (fi !== -1) w.fields[fi] = newAlias;
          }
          if (w.xField === oldAlias) w.xField = newAlias;
          if (w.yField === oldAlias) w.yField = newAlias;
          (w.filters || []).forEach(wf => { if (wf.field === oldAlias) wf.field = newAlias; });
        });

        renderFieldsPanel();
        setupCodeMirror();
        toast(`Field renamed to "${newAlias}"`, 'success');
      }

      function deleteDatasource(dsName) {
        const ds = DataLaVistaState.dataSources[dsName];
        if (!ds) return;
        // Remove all tables
        (ds.tables || []).forEach(tk => deleteTable(tk, true));
        delete DataLaVistaState.dataSources[dsName];
        renderFieldsPanel();
        setupCodeMirror();
        updateConnectButton();
        toast(`Data source "${dsName}" deleted.`, 'success');
      }

      function deleteTable(tableKey, silent = false) {
        const t = DataLaVistaState.tables[tableKey];
        if (!t) return;

        // Remove from data source table list
        const ds = t.dataSource ? DataLaVistaState.dataSources[t.dataSource] : null;
        if (ds && ds.tables) {
          ds.tables = ds.tables.filter(k => k !== tableKey);
        }
        // Drop from AlaSQL by table key
        dropTableFromAlaSQL(tableKey);
        // Remove from basicQB if active
        if (DataLaVistaState.basicQB.tableName === tableKey) {
          DataLaVistaState.basicQB = { tableName: null, selectedFields: [], fieldAggs: {}, conditions: [], sorts: [], groupBy: [], rowLimit: 500 };
          renderBasicQB();
        }
        // Remove from advanced QB nodes
        for (const [id, nd] of Object.entries(DataLaVistaState.advancedQB.nodes || {})) {
          if (nd.tableName === tableKey) {
            delete DataLaVistaState.advancedQB.nodes[id];
          }
        }
        DataLaVistaState.advancedQB.joins = (DataLaVistaState.advancedQB.joins || []).filter(j => {
          const fromNd = DataLaVistaState.advancedQB.nodes[j.from];
          const toNd = DataLaVistaState.advancedQB.nodes[j.to];
          return fromNd && toNd;
        });
        // Remove from design widgets
        DataLaVistaState.design.widgets = (DataLaVistaState.design.widgets || []).filter(w => {
          if (w.sqlTable === tableKey) return false;
          return true;
        });
        // Remove from design filters
        DataLaVistaState.design.filters = (DataLaVistaState.design.filters || []);

        delete DataLaVistaState.tables[tableKey];

        if (!silent) {
          renderFieldsPanel();
          setupCodeMirror();
          renderDesignCanvas();
        }
      }


      function setupCodeMirror() {
        const sqlEditorTextArea = document.getElementById('sql-editor');
        if (window._cmEditor) {
          window._cmEditor.refresh();
          updateCMHints();
          return;
        }

        
          const cm = CodeMirror.fromTextArea(sqlEditorTextArea, {
            mode: 'text/x-sql',
            theme: 'default',
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            dragDrop: false,
            extraKeys: {
              'Ctrl-Space': 'autocomplete',
              'Ctrl-Enter': runQuery
            },
            hintOptions: { completeSingle: false, hint: dlvSQLHint }
          });

          // Attach directly to CodeMirror's actual DOM element
          const cmWrapper = cm.getWrapperElement();
          cmWrapper.addEventListener('dragover', (e) => e.preventDefault());
          cmWrapper.addEventListener('drop', onDropToSQLEditor, true); // capture drop

          cm.on('change', (inst) => {
            DataLaVistaState.sql = inst.getValue();
            hideUseInDesign();
          });
          window._cmEditor = cm;
          updateCMHints();

          // Trigger hints on keyup
          cm.on('keyup', (inst, evt) => {
            if (!evt.ctrlKey && !evt.altKey && evt.key.length === 1) {
              CodeMirror.commands.autocomplete(inst, dlvSQLHint, { completeSingle: false });
            }
          });
        
      }

      
      function dlvSQLHint(cm) {
        const cursor = cm.getCursor();
        const lineUpToCursor = cm.getLine(cursor.line).slice(0, cursor.ch);

        // ── Dot-context: detect "SP_PeopleList." or "SP_Contacts." ──────────────
        const dotMatch = lineUpToCursor.match(/\[?([\w]+)\]?\.(\w*)$/);
        if (dotMatch) {
          const tableRef    = dotMatch[1];
          const fieldPrefix = dotMatch[2];
          const completions = [];

          for (const [tkey, t] of Object.entries(DataLaVistaState.tables)) {
            const qname = getTableQueryName(tkey);
            // Match against either the tableKey or the live alias form
            if (tkey.toUpperCase() === tableRef.toUpperCase() ||
                qname.toUpperCase() === tableRef.toUpperCase()) {
              // Suggest internalName.field (that's what SQL column refs use)
              for (const f of t.fields) {
                if ((f.internalName || '').toUpperCase().startsWith(fieldPrefix.toUpperCase())) {
                  completions.push(tableRef + '.' + f.internalName);
                }
              }
              break;
            }
          }

          const replaceFrom = dotMatch.index;
          return {
            list: [...new Set(completions)].sort(),
            from: CodeMirror.Pos(cursor.line, replaceFrom),
            to:   CodeMirror.Pos(cursor.line, cursor.ch)
          };
        }

        // ── Normal (non-dot) completion ──────────────────────────────────────
        const token = cm.getTokenAt(cursor);
        const start = token.start;
        const end   = cursor.ch;
        const word  = token.string.trim().toUpperCase();

        const allKeywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS',
          'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM',
          'AVG', 'MIN', 'MAX', 'MEDIAN', 'STDEV', 'VAR', 'FIRST', 'LAST',
          'UNION', 'INTERSECT', 'EXCEPT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
          'TABLE', 'VIEW', 'INDEX', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN',
          'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'NULLIF', 'IIF',
          ...ALASQL_KEYWORDS
        ];

        // Add table keys (immutable, always queryable) and their fully-qualified field names.
        // Also add the live alias-based name so the user sees what the QB generates.
        for (const [tkey, t] of Object.entries(DataLaVistaState.tables)) {
          const qname = getTableQueryName(tkey);   // DSAlias_TableAlias (used in FROM clause)
          // Primary suggestion: the tableKey (what goes in FROM [tableKey])
          allKeywords.push(tkey);
          // Also suggest the SQL alias form for awareness (what QB puts after FROM [key])
          if (qname !== tkey) allKeywords.push(qname);
          // Include ALL fields by internalName for SQL column references
          for (const f of t.fields) {
            allKeywords.push(tkey + '.' + f.internalName);
            allKeywords.push(qname + '.' + f.internalName);
          }
        }

        const seen = new Set();
        const completions = [];
        for (const kw of allKeywords) {
          if (kw.toUpperCase().startsWith(word) && !seen.has(kw)) {
            seen.add(kw);
            completions.push(kw);
          }
        }

        return {
          list: completions.sort(),
          from: CodeMirror.Pos(cursor.line, start),
          to:   CodeMirror.Pos(cursor.line, end)
        };
      }


      // Call this to refresh hints when tables/fields change, e.g. after loading new data or switching query builder modes
      function updateCMHints() {
        // Just trigger a no-op — hints auto-update from DataLaVistaState.tables
      }

      function unlockSQL() {
        DataLaVistaState.sqlLocked = false;
        document.getElementById('btn-sql-locked').style.display = 'none';
        toast('SQL editor unlocked — query builder changes will update SQL', 'success');
      }

      function formatSQL() {
        if (!window._cmEditor) return;
        let sql = window._cmEditor.getValue();
        // Simple formatter: uppercase keywords, indent
        const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ON|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION|AND|OR)\b/gi;
        sql = sql.replace(keywords, m => '\n' + m.toUpperCase() + ' ');
        sql = sql.replace(/\n\s*\n/g, '\n').trim();
        window._cmEditor.setValue(sql);
      }


      // Strip HTML tags and decode common entities
      function stripHtml(rawHtml) {
          if (!rawHtml || typeof rawHtml !== 'string') return '';
          
          // 1. Strip all HTML tags
          let text = rawHtml.replace(/<[^>]*>?/gm, '');
          
          // 2. Convert common HTML entities back to normal characters
          text = text.replace(/&nbsp;|&#160;/gi, ' ')
                    .replace(/&amp;/gi, '&')
                    .replace(/&lt;/gi, '<')
                    .replace(/&gt;/gi, '>')
                    .replace(/&quot;/gi, '"')
                    .replace(/&#39;/g, "'");
          
          return text;
      }



