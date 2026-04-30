/* ============================================================
This file is part of DataLaVista
52-qb-advanced.js: Advanced query builder - visual join graph, nodes, and options panel.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
Summary: Advanced query builder - visual join graph, nodes, and options panel.
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
      // QUERY BUILDER — ADVANCED MODE
      // ============================================================

      // ── Utility functions moved from 50-qb-basic.js ──────────────────────────
      // These were originally in the basic QB file but are shared by advanced QB,
      // the design tab, and the public API. They live here now that basic QB is gone.

      // Maps agg + source displayType → output displayType for queryColumnMeta.
      function _aggOutputDisplayType(agg, inputDT) {
        if (!agg) return inputDT || 'text';
        if (['COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX',
             'MEDIAN', 'STDEV', 'VAR', 'CV', 'MODE'].includes(agg)) return 'number';
        if (['EARLIEST', 'LATEST', 'FIRST_ALPHA', 'LAST_ALPHA'].includes(agg)) return inputDT || 'text';
        if (['LIST', 'GROUP_CONCAT'].includes(agg)) return 'text';
        return inputDT || 'text';
      }

      // Which aggregates are visible for a given field displayType.
      // Used by showAggPopup() in 42-ui-shared.js (shared by advanced QB + design tab).
      /** @param {string} displayType */
      function aggsForType(displayType) {
        const NONE          = { val: '',             label: '— none —' };
        const COUNT         = { val: 'COUNT',        label: 'COUNT' };
        const COUNT_DIST    = { val: 'COUNT_DISTINCT', label: 'COUNT DISTINCT' };
        const LIST          = { val: 'LIST',         label: 'LIST' };
        const SUM           = { val: 'SUM',          label: 'SUM' };
        const AVG           = { val: 'AVG',          label: 'AVG' };
        const MIN           = { val: 'MIN',          label: 'MIN' };
        const MAX           = { val: 'MAX',          label: 'MAX' };
        const MEDIAN        = { val: 'MEDIAN',       label: 'MEDIAN' };
        const MODE          = { val: 'MODE',         label: 'MODE' };
        const STDEV         = { val: 'STDEV',        label: 'STD DEV' };
        const VAR           = { val: 'VAR',          label: 'VARIANCE' };
        const CV            = { val: 'CV',           label: 'CV (Coeff. of Variation)' };
        const EARLIEST      = { val: 'EARLIEST',     label: 'EARLIEST' };
        const LATEST        = { val: 'LATEST',       label: 'LATEST' };
        const FIRST_ALPHA   = { val: 'FIRST_ALPHA',  label: 'FIRST ALPHABETICALLY' };
        const LAST_ALPHA    = { val: 'LAST_ALPHA',   label: 'LAST ALPHABETICALLY' };

        if (displayType === 'number')
          return [NONE, COUNT, COUNT_DIST, SUM, AVG, MIN, MAX, MEDIAN, MODE, STDEV, VAR, CV, LIST];
        if (displayType === 'date' || displayType === 'datetime')
          return [NONE, COUNT, COUNT_DIST, EARLIEST, LATEST, MEDIAN, MODE, LIST];
        if (displayType === 'boolean')
          return [NONE, COUNT, COUNT_DIST];
        if (displayType === 'user' || displayType === 'lookup' || displayType === 'url')
          return [NONE, COUNT, COUNT_DIST, FIRST_ALPHA, LAST_ALPHA, MODE, LIST];
        if (displayType === 'user-multi' || displayType === 'lookup-multi')
          return [NONE, COUNT, COUNT_DIST, LIST];
        if (displayType === 'array')
          return [NONE, COUNT, LIST];
        if (displayType === 'object')
          return [NONE, COUNT];
        // text and default
        return [NONE, COUNT, COUNT_DIST, FIRST_ALPHA, LAST_ALPHA, MODE, LIST];
      }

      // Transpile a stored aggregate val into a SQL fragment.
      // colExpr: bare SQL column reference (e.g. [alias].[field])
      // alias:   desired output alias (omitted → no AS clause)
      /** @param {string} agg @param {string} colExpr @param {string} [alias] */
      function aggToSQL(agg, colExpr, alias) {
        const AS = alias ? ` AS [${alias}]` : '';
        const col = colExpr;
        switch (agg) {
          case 'EARLIEST':
          case 'FIRST_ALPHA':   return `MIN(${col})${AS}`;
          case 'LATEST':
          case 'LAST_ALPHA':    return `MAX(${col})${AS}`;
          case 'LIST':
          case 'GROUP_CONCAT':  return `GROUP_CONCAT(${col} ORDER BY ${col} ASC SEPARATOR ';')${AS}`;
          case 'COUNT_DISTINCT': return `COUNT(DISTINCT ${col})${AS}`;
          case '':
          case undefined:
          case null:            return alias ? `${col} AS [${alias}]` : col;
          default:              return `${agg}(${col})${AS}`;
        }
      }

      // Date macro helpers — converts date filter macros (e.g. 'THIS_MONTH') to SQL range expressions.
      // Used by condToSQL() in 10-constants.js and by advanced QB WHERE clause building.
      /** @param {string} op @param {*} value @param {string} colExpr */
      function dateMacroToSQL(op, value, colExpr) {
        const now = new Date();
        const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
        const fmt = (/** @type {Date} */ d) => `'${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}'`;

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = fmt(today);

        const fyM = (DataLaVistaState.FiscalYearStartMonth || 7) - 1;  // 0-indexed
        function fiscalStart(/** @type {number} */ yr) { return new Date(yr, fyM, 1); }
        function fiscalEnd(/** @type {number} */ yr)   { return new Date(yr + 1, fyM, 0); }  // last day before next FY start
        function academicStart(/** @type {number} */ yr) { return new Date(yr, 7, 1); } // Aug 1

        switch (op) {
          case 'THIS_YEAR': {
            const s = fmt(new Date(today.getFullYear(), 0, 1));
            const e = fmt(new Date(today.getFullYear(), 11, 31));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'LAST_YEAR': {
            const y = today.getFullYear() - 1;
            return `${colExpr} >= '${y}-01-01' AND ${colExpr} <= '${y}-12-31'`;
          }
          case 'THIS_FISCAL': {
            const fy = today.getMonth() >= fyM ? today.getFullYear() : today.getFullYear() - 1;
            const s = fmt(fiscalStart(fy));
            const e = fmt(fiscalEnd(fy));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'LAST_FISCAL': {
            const fy = (today.getMonth() >= fyM ? today.getFullYear() : today.getFullYear() - 1) - 1;
            const s = fmt(fiscalStart(fy));
            const e = fmt(fiscalEnd(fy));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'THIS_ACADEMIC': {
            // Academic year: Aug 1 – July 31
            const ay = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
            const s = fmt(academicStart(ay));
            const e = fmt(new Date(ay + 1, 6, 31));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'LAST_ACADEMIC': {
            const ay = (today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1) - 1;
            const s = fmt(academicStart(ay));
            const e = fmt(new Date(ay + 1, 6, 31));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'THIS_MONTH': {
            const s = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
            const e = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'LAST_MONTH': {
            const s = fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
            const e = fmt(new Date(today.getFullYear(), today.getMonth(), 0));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'THIS_WEEK': {
            const dow = today.getDay();
            const s = new Date(today); s.setDate(today.getDate() - dow);
            const e = new Date(s); e.setDate(s.getDate() + 6);
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${fmt(e)}`;
          }
          case 'LAST_WEEK': {
            const dow = today.getDay();
            const s = new Date(today); s.setDate(today.getDate() - dow - 7);
            const e = new Date(s); e.setDate(s.getDate() + 6);
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${fmt(e)}`;
          }
          case 'THIS_BIZ_WEEK': {
            const dow = today.getDay();
            // Adjust day of week so Monday is 0, Tuesday is 1... Sunday is 6
            const diffToMonday = dow === 0 ? 6 : dow - 1;
            const s = new Date(today); s.setDate(today.getDate() - diffToMonday); // Monday
            const e = new Date(s); e.setDate(s.getDate() + 4); // Friday
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${fmt(e)}`;
          }
          case 'LAST_BIZ_WEEK': {
            const dow = today.getDay();
            const diffToMonday = dow === 0 ? 6 : dow - 1;
            const s = new Date(today); s.setDate(today.getDate() - diffToMonday - 7); // Last Monday
            const e = new Date(s); e.setDate(s.getDate() + 4); // Last Friday
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${fmt(e)}`;
          }
          case 'TODAY': return `${colExpr} >= ${todayStr} AND ${colExpr} < '${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate() + 1)}'`;
          case 'PAST_X_DAYS': {
            const x = parseInt(value) || 1;
            const s = new Date(today); s.setDate(today.getDate() - x + 1);
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${todayStr}`;
          }
          case 'PAST_X_MONTHS': {
            const x = parseInt(value) || 1;
            const s = new Date(today); s.setMonth(today.getMonth() - x + 1); s.setDate(1);
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${todayStr}`;
          }
          case 'PAST_X_YEARS': {
            const x = parseInt(value) || 1;
            const s = new Date(today); s.setFullYear(today.getFullYear() - x + 1); s.setMonth(0); s.setDate(1);
            return `${colExpr} >= ${fmt(s)} AND ${colExpr} <= ${todayStr}`;
          }
          case 'PAST_X_FISCAL': {
            const x = parseInt(value) || 1;
            const fy = (today.getMonth() >= fyM ? today.getFullYear() : today.getFullYear() - 1) - x + 1;
            const s = fmt(fiscalStart(fy));
            const currFy = today.getMonth() >= fyM ? today.getFullYear() : today.getFullYear() - 1;
            const currFyEnd = fmt(fiscalEnd(currFy));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${currFyEnd}`;
          }
          default: return null;
        }
      }

      // ── [REMOVE AFTER: once confirmed no reports use basic QB] ───────────────
      // Copies basic QB state into a new advanced QB node. Called by loadConfig()
      // when loading an old report that had basic QB as the active query mode.
      // Safe to call repeatedly — does nothing if adv QB already has nodes.
      function _migrateBasicToAdvancedQB() {
        const bqb = DataLaVistaState.basicQB;
        if (!bqb || !bqb.tableName) return;                            // nothing to migrate
        const nodes = DataLaVistaState.advancedQB.nodes || {};
        if (Object.keys(nodes).length > 0) return;                    // adv QB already has content — don't clobber
        const t = DataLaVistaState.tables[bqb.tableName];
        const id = /** @type {string} */ ('node_1');
        DataLaVistaState.advancedQB.nodes = {};
        const _nodes = /** @type {any} */ (DataLaVistaState.advancedQB.nodes);
        _nodes[id] = {
          tableName:      bqb.tableName,
          x:              80,
          y:              60,
          selectedFields: bqb.selectedFields.length ? [...bqb.selectedFields] : [],
          alias:          (t && t.alias) || bqb.tableName,
          conditions:     (/** @type {any[]} */ (bqb.conditions || [])).map(c => ({ ...c })),
          sorts:          (/** @type {any[]} */ (bqb.sorts     || [])).map(s => ({ ...s })),
          groupBy:        [...(bqb.groupBy || [])],
          fieldAggs:      Object.assign({}, bqb.fieldAggs || {})
        };
        advNodeCounter = 1;
        DataLaVistaState.advancedQB.rowLimit = bqb.rowLimit || 500;
      }
      // ── END REMOVE AFTER ────────────────────────────────────────────────────

      // ── SQL editor drop handler (moved from 50-qb-basic.js) ─────────────────
      // Handles drag-drop onto the CodeMirror SQL editor wrapper.
      // When the query is empty and a table/field is dropped, adds a node to the
      // advanced QB canvas and switches to the QB tab instead of the old basic QB behavior.
      function onDropToSQLEditor(event) {
        event.preventDefault();
        const data = safeDragParse(event);
        const cm = /** @type {any} */ (window)._cmEditor;
        if (!cm) return;
        const isQueryEmpty = (!cm || cm.getValue().trim().replace('-- Connect to a data source and drag a table into the query builder\n-- or write your SQL here directly\nSELECT \'DataLaVista\'', '').length < 1);
        // Set cursor to drop position
        const pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
        cm.setCursor(pos);
        if (!data) {
          // Prefer plain text for a code editor, fall back to HTML stripped of tags
          let text = event.dataTransfer.getData('text/plain');
          if (!text) {
            const html = event.dataTransfer.getData('text/html');
            if (html) text = stripHtml(html);
          }
          if (text) cm.replaceSelection(text);
        } else if (data.type === 'table') {
          const t = (/** @type {any} */ (DataLaVistaState.tables))[data.table];
          if (!t) return;
          if (isQueryEmpty) {
            addAdvNode(data.table, 80, 60);
            switchQMTab('qb');
          } else {
            if (cm) cm.replaceSelection(`[${data.table}]`);
            ensureTableData(data.table);
          }
        } else if (data.type === 'field') {
          const t = (/** @type {any} */ (DataLaVistaState.tables))[data.table];
          if (!t) return;
          if (isQueryEmpty) {
            addAdvNode(data.table, 80, 60, data.field);  // preselectedField
            switchQMTab('qb');
          } else {
            if (cm) cm.replaceSelection(`[${data.field}]`);
            ensureTableData(data.table);
          }
        }
        // Unknown custom data type — ignore
      }

      let advNodeCounter = 0;
      let draggingNode = null;
      let draggingOffset = { x: 0, y: 0 };
      let drawingJoin = null; // { fromNode, fromSide, startX, startY }
      let selectedNode = null;
      let selectedJoin = null;
      let _advOptsFieldsExpanded = false; // track expand/collapse of fields list in options panel
      let _expandedLookupFields = {};    // { nodeId: Set<fieldAlias> } — which lookup fields are expanded

      function _advShowMoreFields(/** @type {string} */ id) { _advOptsFieldsExpanded = true;  renderAdvOptionsPanel('node', id); }
      function _advShowLessFields(/** @type {string} */ id) { _advOptsFieldsExpanded = false; renderAdvOptionsPanel('node', id); }

      function renderAdvancedQB() {
        const canvas = document.getElementById('qb-canvas');
        // Remove existing nodes (not SVG)
        canvas.querySelectorAll('.qb-table-node').forEach(n => n.remove());
        document.getElementById('qb-svg').innerHTML = '';

        DataLaVistaState.advancedQB.nodeAliases ??= {};

        // Sync counter to prevent ID collisions when new nodes are added after loading from config
        for (const id of Object.keys(DataLaVistaState.advancedQB.nodes)) {
          const num = parseInt(id.replace('node_', ''), 10);
          if (!isNaN(num) && num > advNodeCounter) advNodeCounter = num;
        }

        for (const [id, nd] of Object.entries(DataLaVistaState.advancedQB.nodes)) {
          createAdvNode(id, nd);
        }
        redrawJoins();
        setupClearButtonDrop();

        // Click on empty canvas background → deselect everything
        canvas._dlvClickHandler && canvas.removeEventListener('click', canvas._dlvClickHandler);
        canvas._dlvClickHandler = (e) => {
          if (e.target === canvas || e.target === document.getElementById('qb-svg')) {
            document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
            selectedNode = null;
            DataLaVistaState.advancedQB.activeJoinIdx = -1;
            renderAdvOptionsPanel(null, null);
          }
        };
        canvas.addEventListener('click', canvas._dlvClickHandler);
      }

      // ── Wire the in-canvas trash as drag-drop target for AQB items ──────────
      function setupClearButtonDrop() {
        const trash = document.getElementById('adv-canvas-trash');
        if (!trash || trash._dlvDropReady) return;
        trash._dlvDropReady = true;

        const AQB_DROP_TYPES = new Set(['adv-node-trash','adv-field-pill','adv-join-trash',
                                         'adv-node-cond','adv-node-sort','adv-node-gb']);

        trash.addEventListener('dragover', e => {
          // Browsers block dataTransfer content during dragover — only .types is readable.
          // Accept any drag carrying our MIME type or text/plain (fallback).
          const types = e.dataTransfer && e.dataTransfer.types;
          if (types && (types.includes('application/x-datalavista') || types.includes('text/plain'))) {
            e.preventDefault();
            trash.classList.add('drag-over');
          }
        });
        trash.addEventListener('dragleave', () => trash.classList.remove('drag-over'));
        trash.addEventListener('drop', e => {
          e.preventDefault();
          trash.classList.remove('drag-over');
          const data = safeDragParse(e);
          if (!data) return;

          const trashR = trash.getBoundingClientRect();
          const tx = trashR.left + trashR.width / 2;
          const ty = trashR.top  + trashR.height / 2;

          if (data.type === 'adv-node-trash') {
            const nodeId = data.nodeId;
            const nodeEl = document.getElementById('adv-' + nodeId);
            if (nodeEl) {
              const nr = nodeEl.getBoundingClientRect();
              shootLightning(tx, ty, nr.left + nr.width/2, nr.top + nr.height/2, () => {
                poofAndRemove(nodeEl, () => {
                  delete DataLaVistaState.advancedQB.nodes[nodeId];
                  delete DataLaVistaState.advancedQB.nodeAliases?.[nodeId];
                  delete _expandedLookupFields[nodeId];
                  DataLaVistaState.advancedQB.joins = DataLaVistaState.advancedQB.joins.filter(j => j.fromNode !== nodeId && j.toNode !== nodeId);
                  redrawJoins(); rebuildAdvancedSQL(); renderAdvOptionsPanel(null, null);
                });
              });
            }
          } else if (data.type === 'adv-field-pill') {
            const { nodeId, field } = data;
            const pillEl = document.querySelector(`#adv-pills-${nodeId} [data-field="${field}"]`);
            if (pillEl) {
              const pr = pillEl.getBoundingClientRect();
              shootLightning(tx, ty, pr.left + pr.width/2, pr.top + pr.height/2, () => {
                poofPill(nodeId, field, () => { advNodeToggleField(nodeId, field); });
              });
            } else {
              poofPill(nodeId, field, () => { advNodeToggleField(nodeId, field); });
            }
          } else if (data.type === 'adv-join-trash') {
            const idx = data.idx;
            const doRemoveJoin = () => {
              if (idx != null && idx >= 0 && idx < DataLaVistaState.advancedQB.joins.length) {
                DataLaVistaState.advancedQB.joins.splice(idx, 1);
                if (DataLaVistaState.advancedQB.activeJoinIdx === idx) DataLaVistaState.advancedQB.activeJoinIdx = -1;
                redrawJoins(); rebuildAdvancedSQL(); renderAdvOptionsPanel(null, null);
              }
            };
            const badges = document.querySelectorAll('.join-venn-badge');
            const badgeEl = badges[idx];
            if (badgeEl) {
              const br = badgeEl.getBoundingClientRect();
              shootLightning(tx, ty, br.left + br.width/2, br.top + br.height/2, doRemoveJoin);
            } else {
              doRemoveJoin();
            }
          } else if (data.type === 'adv-node-cond') {
            const nd = DataLaVistaState.advancedQB.nodes[data.nodeId];
            if (nd && nd.conditions) {
              nd.conditions.splice(data.idx, 1);
              rebuildAdvancedSQL();
              if (selectedNode === data.nodeId) renderAdvOptionsPanel('node', data.nodeId);
            }
          } else if (data.type === 'adv-node-sort') {
            const nd = DataLaVistaState.advancedQB.nodes[data.nodeId];
            if (nd && nd.sorts) {
              nd.sorts.splice(data.idx, 1);
              rebuildAdvancedSQL();
              if (selectedNode === data.nodeId) renderAdvOptionsPanel('node', data.nodeId);
            }
          } else if (data.type === 'adv-node-gb') {
            const nd = DataLaVistaState.advancedQB.nodes[data.nodeId];
            if (nd && nd.groupBy) {
              nd.groupBy.splice(data.idx, 1);
              rebuildAdvancedSQL();
              if (selectedNode === data.nodeId) renderAdvOptionsPanel('node', data.nodeId);
            }
          }
        });
      }

      function clearSQLEditor() {
        if (window._cmEditor) window._cmEditor.setValue('');
        DataLaVistaState.sql = '';
        hideUseInDesign();
      }

      function onDropToAdvancedQB(event) {
        event.preventDefault();
        const data = safeDragParse(event);
        if (!data) return;

        const wrap = document.getElementById('qb-canvas-wrap');
        const wrapRect = wrap.getBoundingClientRect();
        const x = event.clientX - wrapRect.left + wrap.scrollLeft - 80;
        const y = event.clientY - wrapRect.top  + wrap.scrollTop  - 40;

        if (data.type === 'table') {
          addAdvNode(data.table, x, y);
          return;
        }

        if (data.type === 'field') {
          // Check if dropped onto an existing node
          const targetNodeEl = event.target?.closest('.qb-table-node');
          if (targetNodeEl) {
            const nodeId = targetNodeEl.id.replace(/^adv-/, '');
            const nd = DataLaVistaState.advancedQB.nodes[nodeId];
            // Only add if field belongs to this exact table
            if (nd && nd.tableName === data.table) {
              if (!nd.selectedFields.includes(data.field)) {
                nd.selectedFields.push(data.field);
                updateAdvNodePills(nodeId);
                rebuildAdvancedSQL();
                if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
              }
            }
            // Different table: do nothing (silent ignore)
            return;
          }
          // Drop on canvas background — add table with this field pre-selected
          addAdvNode(data.table, x, y, data.field);
        }
      }

      function addAdvNode(tableName, x, y, preselectedField, sqlAlias, _skipAutoJoin = false) {
        const id = 'node_' + (++advNodeCounter);
        const t = DataLaVistaState.tables[tableName];
        if (!t) return id;

        let defaultFields = [];
        if (preselectedField) {
          // Caller specified which field to pre-select
          defaultFields = [preselectedField];
        } else {
          // Auto-select Title/Name fields — same logic as basic QB
          for (const f of t.fields) {
            if (f.isAutoId || f.isLookupRaw) continue;
            if (f.internalName === 'Title' ||
                (f.alias || '').toLowerCase() === 'name' ||
                (f.alias || '').toLowerCase().includes('fullname') ||
                (f.alias || '').toLowerCase() === 'uniqname') {
              defaultFields.push(f.alias);
            }
          }
          // Fallback: if nothing matched, select the first non-auto field
          if (!defaultFields.length) {
            const first = t.fields.find(f => !f.isAutoId && !f.isLookupRaw);
            if (first) defaultFields.push(first.alias);
          }
        }

        // If the same table is already on canvas and no explicit sqlAlias was given,
        // generate a uniqueness alias like "People_2", "People_3", etc.
        if (!sqlAlias) {
          const existingCount = Object.values(DataLaVistaState.advancedQB.nodes)
            .filter(n => n.tableName === tableName).length;
          if (existingCount > 0) {
            const base = t.alias || tableName;
            let counter = existingCount + 1;
            const usedAliases = new Set(Object.values(DataLaVistaState.advancedQB.nodeAliases || {}));
            while (usedAliases.has(base + '_' + counter)) counter++;
            sqlAlias = base + '_' + counter;
          }
        }

        DataLaVistaState.advancedQB.nodes[id] = {
          tableName, x, y,
          selectedFields: defaultFields,
          alias: t.alias || tableName,
          conditions: [],
          sorts: [],
          groupBy: [],
          fieldAggs: {},
          lookupAggFields: {}   // { [parentAlias]: [{ field, agg, alias }] }
        };

        // Auto-assign primary table to the first node added
        if (!DataLaVistaState.advancedQB.primaryNodeId)
          DataLaVistaState.advancedQB.primaryNodeId = id;

        if (sqlAlias) {
          DataLaVistaState.advancedQB.nodeAliases ??= {};
          DataLaVistaState.advancedQB.nodeAliases[id] = sqlAlias;
        }

        ensureTableData(tableName);

        // Auto-apply relationships BEFORE rendering so nodeAliases are set when createAdvNode draws the header
        if (!_skipAutoJoin) autoApplySuggestedJoins(id, tableName);

        createAdvNode(id, DataLaVistaState.advancedQB.nodes[id]);

        // Redraw joins AFTER the node is in the DOM so offsetWidth/offsetHeight are correct
        if (!_skipAutoJoin && DataLaVistaState.advancedQB.joins.length > 0) redrawJoins();

        rebuildAdvancedSQL();
        selectAdvNode(id);
        return id;
      }

      /**
       * Auto-apply any registered relationships that connect the newly-added node
       * to an already-present node in the advanced QB.
       * Supports multiple relationships to the same parent table (e.g. 3 lookup fields → People).
       * Each unique relationship gets its own join; extra copies of the parent table are added
       * as needed with derived SQL aliases like "TeamsList_TeamLead".
       */
      function autoApplySuggestedJoins(newNodeId, newTableName) {
        const rels = DataLaVistaState.relationships || [];
        if (!rels.length) return;

        // Build a map of tableKey → [nodeId, ...] for existing nodes (excluding the new one)
        const existingTableToNodes = {};
        for (const [nid, nd] of Object.entries(DataLaVistaState.advancedQB.nodes)) {
          if (nid !== newNodeId) {
            (existingTableToNodes[nd.tableName] ??= []).push(nid);
          }
        }

        // Derive the SQL alias for a node being auto-added for a specific lookup field.
        // Pattern: {childTable.alias}_{lookupFieldAlias} e.g. "TeamsList_TeamLead"
        const deriveSPAlias = (childTableKey, childField) => {
          const childT = DataLaVistaState.tables[childTableKey];
          const childAlias = childT?.alias || childTableKey;
          // childField is the *Data synthetic field; strip 'Data' suffix to get the internalName,
          // then look up the field's alias (view column name) for the display label.
          const fieldInternalName = childField.endsWith('Data') ? childField.slice(0, -4) : childField;
          const fieldObj = (childT?.fields || []).find(f => f.internalName === fieldInternalName);
          const fieldBase = fieldObj?.alias || fieldInternalName;
          return childAlias + '_' + fieldBase;
        };

        // Track how many times we've used the new node as parent/child for a given lookup field,
        // so subsequent rels get a fresh sibling node instead.
        const usedNewNodeForParent = new Set(); // childTableKey already handled via newNodeId as parent
        const usedNewNodeForChild  = new Set(); // childField already handled via newNodeId as child
        let _sibParentCount = 0;
        let _sibChildCount  = 0;

        for (const rel of rels) {
          let fromNodeId, toNodeId, fromKey, toKey, joinType;

          if (rel.parentTableKey === newTableName && existingTableToNodes[rel.childTableKey]) {
            // New node is parent; child already on canvas
            const childT  = DataLaVistaState.tables[rel.childTableKey];
            const parentT = DataLaVistaState.tables[rel.parentTableKey];
            const childFieldAlias  = (childT?.fields || []).find(f => f.internalName === rel.childField)?.alias || rel.childField;
            const parentFieldAlias = (parentT?.fields || []).find(f => f.internalName === rel.parentField)?.alias || rel.parentField;
            joinType = (rel.source === 'sharepoint-lookup' && rel.isMultiSelect) ? 'DLV_LOOKUP' : (rel.joinType || 'LEFT');
            fromKey  = childFieldAlias;
            toKey    = parentFieldAlias;
            fromNodeId = existingTableToNodes[rel.childTableKey][0];

            // Skip self-joins (joining a table to itself).
            if (rel.childTableKey === rel.parentTableKey) continue;

            // Pre-check if this join already exists before creating any sibling node.
            const preAlreadyJoined = DataLaVistaState.advancedQB.joins.some(j => {
              const jFrom = DataLaVistaState.advancedQB.nodes[j.fromNode]?.tableName;
              const jTo   = DataLaVistaState.advancedQB.nodes[j.toNode]?.tableName;
              if (!((jFrom === rel.childTableKey && jTo === rel.parentTableKey) ||
                    (jFrom === rel.parentTableKey && jTo === rel.childTableKey))) return false;
              normalizeJoinKeys(j);
              return j.keys.some(k => k.fromKey === fromKey && k.toKey === toKey);
            });
            if (preAlreadyJoined) continue;

            // Each rel needs a distinct parent node. Use newNodeId for the first rel,
            // then create additional parent nodes (siblings of the new node) for subsequent rels.
            if (!usedNewNodeForParent.has(rel.childTableKey)) {
              toNodeId = newNodeId;
              usedNewNodeForParent.add(rel.childTableKey);
              // Assign derived SP alias to the first-used node too
              if (rel.source === 'sharepoint-lookup') {
                const firstAlias = deriveSPAlias(rel.childTableKey, rel.childField);
                DataLaVistaState.advancedQB.nodeAliases ??= {};
                DataLaVistaState.advancedQB.nodeAliases[newNodeId] = firstAlias;
              }
            } else {
              _sibParentCount++;
              const nd0 = DataLaVistaState.advancedQB.nodes[newNodeId];
              const siblingAlias = deriveSPAlias(rel.childTableKey, rel.childField);
              toNodeId = addAdvNode(newTableName, (nd0?.x ?? 0) + 200 + _sibParentCount * 20, (nd0?.y ?? 0) + _sibParentCount * 100, undefined, siblingAlias, true);
            }
            if (joinType === 'DLV_LOOKUP') {
              const secNd = DataLaVistaState.advancedQB.nodes[toNodeId];
              if (secNd) {
                secNd.fieldAggs = secNd.fieldAggs || {};
                for (const f of secNd.selectedFields || []) {
                  if (!secNd.fieldAggs[f]) secNd.fieldAggs[f] = 'COUNT';
                }
                updateAdvNodePills(toNodeId);
              }
            }
          } else if (rel.childTableKey === newTableName && existingTableToNodes[rel.parentTableKey]) {
            // New node is child; parent already on canvas — mirror the parent-is-new branch
            const childT  = DataLaVistaState.tables[rel.childTableKey];
            const parentT = DataLaVistaState.tables[rel.parentTableKey];
            const childFieldAlias  = (childT?.fields || []).find(f => f.internalName === rel.childField)?.alias || rel.childField;
            const parentFieldAlias = (parentT?.fields || []).find(f => f.internalName === rel.parentField)?.alias || rel.parentField;
            joinType = (rel.source === 'sharepoint-lookup' && rel.isMultiSelect) ? 'DLV_LOOKUP' : (rel.joinType || 'LEFT');
            fromKey  = childFieldAlias;
            toKey    = parentFieldAlias;
            toNodeId = existingTableToNodes[rel.parentTableKey][0];

            if (rel.childTableKey === rel.parentTableKey) continue;

            if (joinType === 'DLV_LOOKUP') {
              // Each lookup column gets its own sibling source node
              if (!usedNewNodeForChild.has(rel.childField)) {
                fromNodeId = newNodeId;
                usedNewNodeForChild.add(rel.childField);
                const firstAlias = deriveSPAlias(rel.childTableKey, rel.childField);
                DataLaVistaState.advancedQB.nodeAliases ??= {};
                DataLaVistaState.advancedQB.nodeAliases[newNodeId] = firstAlias;
              } else {
                const nd0 = DataLaVistaState.advancedQB.nodes[newNodeId];
                const siblingAlias = deriveSPAlias(rel.childTableKey, rel.childField);
                fromNodeId = addAdvNode(newTableName, (nd0?.x ?? 0) + 200, (nd0?.y ?? 0), undefined, siblingAlias, true);
              }
              const secNd = DataLaVistaState.advancedQB.nodes[fromNodeId];
              if (secNd) {
                secNd.fieldAggs = secNd.fieldAggs || {};
                for (const f of secNd.selectedFields || []) {
                  if (!secNd.fieldAggs[f]) secNd.fieldAggs[f] = 'COUNT';
                }
                updateAdvNodePills(fromNodeId);
              }
              const preAlreadyJoined = DataLaVistaState.advancedQB.joins.some(j =>
                j.fromNode === fromNodeId && j.toNode === toNodeId);
              if (preAlreadyJoined) continue;
            } else {
              fromNodeId = newNodeId;
              const preAlreadyJoined = DataLaVistaState.advancedQB.joins.some(j => {
                const jFrom = DataLaVistaState.advancedQB.nodes[j.fromNode]?.tableName;
                const jTo   = DataLaVistaState.advancedQB.nodes[j.toNode]?.tableName;
                if (!((jFrom === rel.childTableKey && jTo === rel.parentTableKey) ||
                      (jFrom === rel.parentTableKey && jTo === rel.childTableKey))) return false;
                normalizeJoinKeys(j);
                return j.keys.some(k => k.fromKey === fromKey && k.toKey === toKey);
              });
              if (preAlreadyJoined) continue;
            }
          } else {
            continue;
          }

          DataLaVistaState.advancedQB.joins.push({
            fromNode: fromNodeId, fromSide: 'right',
            toNode: toNodeId,     toSide: 'left',
            fromKey, toKey,
            type: joinType
          });
        }

      }

      function getAllFieldAliases(tableName, hideSynthetic = false) {
        const t = DataLaVistaState.tables[tableName];
        if (!t) return [];
        return t.fields.filter(f => !hideSynthetic || !f.isAutoId).map(f => f.alias);
      }

      function createAdvNode(id, nd) {
        const t = DataLaVistaState.tables[nd.tableName];
        if (!t) return;
        const canvas = document.getElementById('qb-canvas');

        // Remove any existing element with this id (re-render case)
        document.getElementById('adv-' + id)?.remove();

        const el = document.createElement('div');
        el.className = 'qb-table-node';
        el.id = 'adv-' + id;
        el.style.cssText = `left:${nd.x}px;top:${nd.y}px;min-width:160px;max-width:280px`;

        const descHTML = t.description ? `<div class="qb-node-desc" title="${t.description.replace(/"/g,'&quot;')}">${t.description}</div>` : '';
        const rowCount = (t.itemCount || (t.data && t.data.length) || 0).toLocaleString();

        el.innerHTML = `
    <div class="qb-node-header">
      <span class="qb-node-join-icon" title="Drag to another table to create a join">⚯</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 4px">${nd.alias || nd.tableName}${(DataLaVistaState.advancedQB.nodeAliases?.[id] && DataLaVistaState.advancedQB.nodeAliases[id] !== (nd.alias || nd.tableName)) ? ` <span style="opacity:.6;font-size:11px">(${DataLaVistaState.advancedQB.nodeAliases[id]})</span>` : ''}</span>
      <button style="background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;padding:0 2px;font-size:13px;line-height:1" onclick="removeAdvNode('${id}')">✕</button>
    </div>
    <div class="qb-node-body">
      ${descHTML}
      <div class="qb-node-count" id="adv-count-${id}">${rowCount} rows</div>
      <div class="qb-node-pills" id="adv-pills-${id}"></div>
    </div>
    <div class="qb-node-resize tl"></div>
    <div class="qb-node-resize tr"></div>
    <div class="qb-node-resize bl"></div>
    <div class="qb-node-resize br"></div>
  `;

        canvas.appendChild(el);

        // Mark primary table glow and fill pills now that element is in DOM
        updatePrimaryTableVisual();
        updateAdvNodePills(id);

        // Drag header to move node (ignore join/trash icons and buttons)
        el.querySelector('.qb-node-header').addEventListener('mousedown', e => {
          if (e.target.closest('.qb-node-join-icon') || e.target.closest('button')) return;
          startNodeDrag(e, id, el);
        });

        // Click node to select (ignore action elements)
        el.addEventListener('click', e => {
          if (!e.target.closest('.qb-node-join-icon') &&
              !e.target.closest('button') && !e.target.closest('.qb-node-resize')) {
            selectAdvNode(id);
          }
        });

        // Join icon: mousedown → start drawing join to another node
        el.querySelector('.qb-node-join-icon').addEventListener('mousedown', e => {
          e.stopPropagation(); startJoinDrag(e, id);
        });

        // Corner resize handles
        el.querySelectorAll('.qb-node-resize').forEach(rh => {
          const corner = Array.from(rh.classList).find(c => ['tl','tr','bl','br'].includes(c)) || 'br';
          rh.addEventListener('mousedown', e => { e.stopPropagation(); startNodeResize(e, id, el, corner); });
        });

        expandCanvas();
      }

      // Expand #qb-canvas so it always fits all placed nodes + padding
      function expandCanvas() {
        const canvas = document.getElementById('qb-canvas');
        if (!canvas) return;
        let maxX = 0, maxY = 0;
        for (const nd of Object.values(DataLaVistaState.advancedQB.nodes)) {
          maxX = Math.max(maxX, (nd.x || 0) + (nd.w || 240) + 40);
          maxY = Math.max(maxY, (nd.y || 0) + (nd.h || 200) + 40);
        }
        canvas.style.minWidth  = maxX + 'px';
        canvas.style.minHeight = maxY + 'px';
      }

      function startNodeDrag(e, id, el) {
        e.preventDefault();
        const nd = DataLaVistaState.advancedQB.nodes[id];
        const wrap = document.getElementById('qb-canvas-wrap');
        const trash = document.getElementById('adv-canvas-trash');
        const wrapRect = wrap.getBoundingClientRect();
        const toCanvas = mv => ({
          x: mv.clientX - wrapRect.left + wrap.scrollLeft,
          y: mv.clientY - wrapRect.top  + wrap.scrollTop
        });
        const startPt = toCanvas(e);
        const offX = startPt.x - nd.x;
        const offY = startPt.y - nd.y;

        const isOverTrash = mv => {
          if (!trash) return false;
          const tr = trash.getBoundingClientRect();
          return mv.clientX >= tr.left && mv.clientX <= tr.right &&
                 mv.clientY >= tr.top  && mv.clientY <= tr.bottom;
        };

        const onMove = mv => {
          const pt = toCanvas(mv);
          nd.x = pt.x - offX;
          nd.y = pt.y - offY;
          el.style.left = nd.x + 'px';
          el.style.top = nd.y + 'px';
          expandCanvas();
          redrawJoins();
          if (trash) trash.classList.toggle('drag-over', isOverTrash(mv));
        };
        const onUp = mv => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          if (trash) trash.classList.remove('drag-over');
          if (isOverTrash(mv)) {
            const trashR = trash.getBoundingClientRect();
            const tx = trashR.left + trashR.width / 2;
            const ty = trashR.top  + trashR.height / 2;
            const nr = el.getBoundingClientRect();
            shootLightning(tx, ty, nr.left + nr.width / 2, nr.top + nr.height / 2, () => {
              poofAndRemove(el, () => {
                delete DataLaVistaState.advancedQB.nodes[id];
                delete DataLaVistaState.advancedQB.nodeAliases?.[id];
                delete _expandedLookupFields[id];
                DataLaVistaState.advancedQB.joins =
                  DataLaVistaState.advancedQB.joins.filter(j => j.fromNode !== id && j.toNode !== id);
                // Reassign primary table if the deleted node was primary
                if (DataLaVistaState.advancedQB.primaryNodeId === id) {
                  const rem = Object.keys(DataLaVistaState.advancedQB.nodes);
                  DataLaVistaState.advancedQB.primaryNodeId = rem.length ? rem[0] : null;
                  updatePrimaryTableVisual();
                }
                redrawJoins(); rebuildAdvancedSQL(); renderAdvOptionsPanel(null, null);
              });
            });
          }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      function toggleAdvField(nodeId, field, el) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const idx = nd.selectedFields.indexOf(field);
        if (idx >= 0) { nd.selectedFields.splice(idx, 1); el && el.classList.remove('selected'); }
        else { nd.selectedFields.push(field); el && el.classList.add('selected'); }
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
      }

      // ── Returns a short icon/label for an aggregate function ─────────────────
      function getAggIcon(agg) {
        const m = {
          COUNT:'#', COUNT_DISTINCT:'#*', SUM:'∑', AVG:'x̄', MEDIAN:'med', MODE:'Mo',
          MIN:'↓', MAX:'↑', STDEV:'σ', VAR:'σ²', CV:'CV',
          EARLIEST:'↓', LATEST:'↑', FIRST_ALPHA:'A↓', LAST_ALPHA:'A↑', LIST:'≡',
          // legacy
          FIRST:'⟨', LAST:'⟩', GROUP_CONCAT:'≡'
        };
        return m[agg] || '∑';
      }

      // ── Returns an inline SVG Venn diagram for the given join type ────────────
      let _vennIdCounter = 0;
      function getVennSVG(type, size) {
        size = size || 36;
        const uid = 'vcp' + (++_vennIdCounter);
        const r = size * 0.32, cx1 = size * 0.37, cx2 = size * 0.63, cy = size / 2;
        const cfgs = {
          'INNER':    { l:'none',                       r:'none',                       mid:'rgba(0,120,212,.75)' },
          'LEFT':     { l:'rgba(0,120,212,.45)',         r:'none',                       mid:'rgba(0,120,212,.75)' },
          'RIGHT':    { l:'none',                       r:'rgba(0,120,212,.45)',         mid:'rgba(0,120,212,.75)' },
          'CROSS':    { l:'rgba(0,120,212,.3)',          r:'rgba(0,120,212,.3)',          mid:'rgba(0,120,212,.55)' },
          'UNION':    { l:'rgba(0,120,212,.5)',          r:'rgba(0,120,212,.5)',          mid:'rgba(0,120,212,.25)' },
          'UNION ALL':{ l:'rgba(0,120,212,.5)',          r:'rgba(0,120,212,.5)',          mid:'rgba(0,120,212,.5)' },
          'DLV_LOOKUP':{ l:'rgba(0,120,212,.45)',        r:'none',                       mid:'rgba(0,120,212,.75)' }
        };
        const c = (/** @type {any} */ (cfgs))[type] || cfgs['INNER'];
        return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block">
          <defs><clipPath id="${uid}"><circle cx="${cx2}" cy="${cy}" r="${r}"/></clipPath></defs>
          <circle cx="${cx1}" cy="${cy}" r="${r}" fill="${c.l}" stroke="#0078d4" stroke-width="1.5"/>
          <circle cx="${cx2}" cy="${cy}" r="${r}" fill="${c.r}" stroke="#0078d4" stroke-width="1.5"/>
          <circle cx="${cx1}" cy="${cy}" r="${r}" fill="${c.mid}" clip-path="url(#${uid})" stroke="none"/>
        </svg>`;
      }

      // ── Poof-animate an element then remove it (calls callback after) ─────────
      function poofAndRemove(el, callback) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (!el) { callback && callback(); return; }
        el.classList.add('dlv-poof');
        el.addEventListener('animationend', () => { el.remove(); callback && callback(); }, { once: true });
      }

      // ── Poof a specific pill in a node then deselect that field ──────────────
      function poofPill(nodeId, field, callback) {
        const pillEl = document.querySelector(`#adv-pills-${nodeId} [data-field="${field}"]`);
        if (pillEl) {
          pillEl.classList.add('dlv-poof');
          pillEl.addEventListener('animationend', () => { pillEl.remove(); callback && callback(); }, { once: true });
        } else {
          callback && callback();
        }
      }

      // ── Lightning bolt from trash can to deleted element ─────────────────────
      function shootLightning(x1, y1, x2, y2, callback) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;overflow:visible';
        document.body.appendChild(svg);

        const segments = 10;
        const spread = Math.max(20, Math.hypot(x2-x1, y2-y1) * 0.15);

        const makeBolt = () => {
          let d = `M${x1},${y1}`;
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            d += ` L${x1+(x2-x1)*t+(Math.random()-.5)*spread*2},${y1+(y2-y1)*t+(Math.random()-.5)*spread*2}`;
          }
          return d + ` L${x2},${y2}`;
        };

        const layers = [
          { color:'rgba(60,140,255,0.3)',  width:18 },
          { color:'rgba(140,210,255,0.7)', width:6  },
          { color:'white',                 width:2  },
        ];
        const paths = layers.map(({ color, width }) => {
          const p = document.createElementNS('http://www.w3.org/2000/svg','path');
          p.setAttribute('stroke', color);
          p.setAttribute('stroke-width', width);
          p.setAttribute('fill','none');
          p.setAttribute('stroke-linecap','round');
          svg.appendChild(p);
          return p;
        });

        const mkCircle = (cx, cy, r, fill) => {
          const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
          c.setAttribute('cx', cx); c.setAttribute('cy', cy);
          c.setAttribute('r', r);  c.setAttribute('fill', fill);
          svg.appendChild(c); return c;
        };
        mkCircle(x1, y1, 8, 'rgba(140,210,255,0.8)');
        mkCircle(x2, y2, 8, 'rgba(140,210,255,0.8)');

        let flickers = 0;
        const FLICKER_COUNT = 5;
        const flicker = () => {
          const d = makeBolt();
          paths.forEach(p => p.setAttribute('d', d));
          flickers++;
          if (flickers < FLICKER_COUNT) {
            setTimeout(flicker, 27);
          } else {
            svg.style.transition = 'opacity 90ms ease-out';
            svg.style.opacity = '0';
            setTimeout(() => { svg.remove(); callback && callback(); }, 100);
          }
        };
        flicker();
      }

      const MAX_NODE_PILLS = 10;

      // ── Rebuild the pills display for one node ────────────────────────────────
      function updateAdvNodePills(nodeId) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        const pillsEl = document.getElementById('adv-pills-' + nodeId);
        if (!nd || !pillsEl) return;
        const fieldAggs = nd.fieldAggs || {};

        if (!nd.selectedFields.length) {
          pillsEl.innerHTML = '<span style="font-size:10px;color:var(--text-disabled);font-style:italic">No fields — select in Options</span>';
          return;
        }

        const visible = nd.selectedFields.slice(0, MAX_NODE_PILLS);
        const extra   = nd.selectedFields.length - MAX_NODE_PILLS;

        let html = visible.map(f => {
          const agg = fieldAggs[f];
          const isAgg = agg && agg !== '';
          const label = isAgg ? `${f} (${getAggIcon(agg)})` : f;
          return `<span class="qb-node-pill${isAgg ? ' agg-pill' : ''}" data-field="${f}" draggable="true">${label
            }<span class="pill-x" data-node-id="${nodeId}" data-field="${f}">×</span></span>`;
        }).join('');

        if (extra > 0) {
          html += `<span class="qb-node-pill" style="background:var(--text-disabled);cursor:default"
            title="Do you really need this many fields?">+${extra}</span>`;
        }

        pillsEl.innerHTML = html;

        pillsEl.querySelectorAll('.qb-node-pill[data-field]').forEach(pill => {
          pill.addEventListener('dragstart', e => {
            e.stopPropagation();
            safeDragSet(e, { type: 'adv-field-pill', nodeId, field: pill.dataset.field });
          });
          pill.addEventListener('dragover', /** @param {DragEvent} e */ e => {
            const data = safeDragParse(e);
            if (!data || data.type !== 'adv-field-pill' || data.nodeId === nodeId) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'link';
            pill.classList.add('join-drop-hover');
          });
          pill.addEventListener('dragleave', () => pill.classList.remove('join-drop-hover'));
          pill.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            pill.classList.remove('join-drop-hover');
            const data = safeDragParse(e);
            if (!data || data.type !== 'adv-field-pill' || data.nodeId === nodeId) return;
            addJoinFromPills(data.nodeId, data.field, nodeId, pill.getAttribute('data-field'));
          });
        });
        pillsEl.querySelectorAll('.pill-x').forEach(x => {
          x.addEventListener('click', e => {
            e.stopPropagation();
            advNodeToggleField(x.dataset.nodeId, x.dataset.field);
          });
        });
      }

      // ── Toggle a field's selected state on a node (pill-based) ───────────────
      function advNodeToggleField(nodeId, field) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const idx = nd.selectedFields.indexOf(field);
        if (idx >= 0) {
          nd.selectedFields.splice(idx, 1);
          if (nd.fieldAggs)        delete nd.fieldAggs[field];
          if (nd.lookupAggFields)  delete nd.lookupAggFields[field];
          if (nd.groupBy) { const gbIdx = nd.groupBy.indexOf(field); if (gbIdx >= 0) nd.groupBy.splice(gbIdx, 1); }
        } else {
          nd.selectedFields.push(field);
        }
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
      }

      // ── Set (or clear) an aggregate for a field on a node ────────────────────
      function setAdvNodeFieldAgg(nodeId, field, agg) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        if (!nd.fieldAggs) nd.fieldAggs = {};
        if (!agg) delete nd.fieldAggs[field]; else nd.fieldAggs[field] = agg;
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        if (selectedNode === nodeId) renderAdvOptionsPanel('node', nodeId);
      }

      // ── Show a small aggregate-picker popup near a button ────────────────────
      function showAdvAggPopup(nodeId, field, btn) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = DataLaVistaState.tables[nd.tableName];
        const fm = t ? t.fields.find(f => f.alias === field) : null;
        const displayType = fm ? fm.displayType : 'text';
        const current = (nd.fieldAggs || {})[field] || '';
        showAggPopup(btn, displayType, current, agg => {
          setAdvNodeFieldAgg(nodeId, field, agg);
        });
      }

      // ── Start drawing a join line from a node's join icon ─────────────────────
      function startJoinDrag(e, nodeId) {
        e.preventDefault();
        const canvas = document.getElementById('qb-canvas');
        const crect  = canvas.getBoundingClientRect();
        const el = document.getElementById('adv-' + nodeId);
        if (!el) return;
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        const startX = nd.x + el.offsetWidth / 2;
        const startY = nd.y;
        drawingJoin = { fromNode: nodeId, fromSide: 'top', startX, startY };

        const tmpLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tmpLine.setAttribute('stroke', '#0078d4');
        tmpLine.setAttribute('stroke-width', '2');
        tmpLine.setAttribute('stroke-dasharray', '6 3');
        tmpLine.id = 'tmp-join-line';
        document.getElementById('qb-svg').appendChild(tmpLine);

        const onMove = mv => {
          const x2 = mv.clientX - crect.left, y2 = mv.clientY - crect.top;
          tmpLine.setAttribute('x1', startX); tmpLine.setAttribute('y1', startY);
          tmpLine.setAttribute('x2', x2);     tmpLine.setAttribute('y2', y2);
        };
        const onUp = mv => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          tmpLine.remove();
          const target = document.elementFromPoint(mv.clientX, mv.clientY);

          // Drop on trash → delete the source table with lightning animation
          const trashEl = document.getElementById('adv-canvas-trash');
          if (trashEl && (trashEl === target || trashEl.contains(target))) {
            const tr = trashEl.getBoundingClientRect();
            const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
            const nr = el.getBoundingClientRect();
            shootLightning(tx, ty, nr.left + nr.width / 2, nr.top + nr.height / 2, () => {
              poofAndRemove(el, () => {
                delete DataLaVistaState.advancedQB.nodes[nodeId];
                delete DataLaVistaState.advancedQB.nodeAliases?.[nodeId];
                delete _expandedLookupFields[nodeId];
                DataLaVistaState.advancedQB.joins = DataLaVistaState.advancedQB.joins.filter(j => j.fromNode !== nodeId && j.toNode !== nodeId);
                redrawJoins(); rebuildAdvancedSQL(); renderAdvOptionsPanel(null, null);
              });
            });
            drawingJoin = null;
            return;
          }

          const targetNode = target?.closest('.qb-table-node');
          if (targetNode) {
            const toId = targetNode.id.replace(/^adv-/, '');
            if (toId && toId !== nodeId) {
              addJoin(nodeId, 'right', toId, 'left');
              // Suppress the click that fires on the drop target, which would
              // override the join auto-selection done inside addJoin().
              window.addEventListener('click', e => e.stopPropagation(), { capture: true, once: true });
            }
          }
          drawingJoin = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      // ── Resize a node by dragging a corner handle ─────────────────────────────
      function startNodeResize(e, nodeId, el, corner) {
        e.preventDefault();
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startW = el.offsetWidth;
        const startH = el.offsetHeight;
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        const startNdX = nd.x;
        const startNdY = nd.y;

        const onMove = mv => {
          const dx = mv.clientX - startMouseX;
          const dy = mv.clientY - startMouseY;

          // Width
          let newW;
          if (corner === 'br' || corner === 'tr') {
            newW = Math.max(160, startW + dx);
          } else {
            newW = Math.max(160, startW - dx);
            nd.x = startNdX + (startW - newW);
            el.style.left = nd.x + 'px';
          }
          el.style.width = newW + 'px';
          el.style.minWidth = newW + 'px';
          el.style.maxWidth = newW + 'px';

          // Height
          let newH;
          if (corner === 'br' || corner === 'bl') {
            newH = Math.max(80, startH + dy);
          } else {
            newH = Math.max(80, startH - dy);
            nd.y = startNdY + (startH - newH);
            el.style.top = nd.y + 'px';
          }
          el.style.height = newH + 'px';

          redrawJoins();
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      function removeAdvNode(id) {
        delete DataLaVistaState.advancedQB.nodes[id];
        delete _expandedLookupFields[id];
        DataLaVistaState.advancedQB.joins = DataLaVistaState.advancedQB.joins.filter(j => j.fromNode !== id && j.toNode !== id);
        document.getElementById('adv-' + id)?.remove();
        // Reassign primary table if the deleted node was primary
        if (DataLaVistaState.advancedQB.primaryNodeId === id) {
          const rem = Object.keys(DataLaVistaState.advancedQB.nodes);
          DataLaVistaState.advancedQB.primaryNodeId = rem.length ? rem[0] : null;
          updatePrimaryTableVisual();
        }
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel(null, null);
      }

      function selectAdvNode(id) {
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        const el = document.getElementById('adv-' + id);
        if (el) el.classList.add('selected');
        if (selectedNode !== id) _advOptsFieldsExpanded = false; // reset expand on new node
        selectedNode = id;
        DataLaVistaState.advancedQB.activeJoinIdx = -1;
        renderAdvOptionsPanel('node', id);
      }

      // ── Primary Table: visual glow + options panel checkbox ──────────────────
      function updatePrimaryTableVisual() {
        const pid = DataLaVistaState.advancedQB.primaryNodeId;
        for (const nid of Object.keys(DataLaVistaState.advancedQB.nodes || {}))
          document.getElementById('adv-' + nid)?.classList.toggle('primary-table', nid === pid);
      }

      function setPrimaryAdvNode(nodeId, checked) {
        if (!checked) return; // must pick another table to unset; uncheck is a no-op
        DataLaVistaState.advancedQB.primaryNodeId = nodeId;
        updatePrimaryTableVisual();
        rebuildAdvancedSQL();
        // Re-render options panel so checkbox states refresh
        if (selectedNode) renderAdvOptionsPanel('node', selectedNode);
      }

      function showNodeProps(nodeId) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = DataLaVistaState.tables[nd.tableName];
        const props = document.getElementById('node-props');
        const el = document.getElementById('adv-' + nodeId);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const canvas = document.getElementById('qb-canvas');
        const crect = canvas.getBoundingClientRect();

        props.style.left = (rect.right - crect.left + 10) + 'px';
        props.style.top = Math.max(0, rect.top - crect.top) + 'px';
        document.getElementById('node-props-title').textContent = nd.alias || nd.tableName;

        const body = document.getElementById('node-props-body');
        const _baseFields = t.fields.filter(f => !f.isSynthetic);
        const _synByParent = {};
        for (const f of t.fields) {
          if (f.isSynthetic && f.parentField && !f.isLookupRaw) {
            if (!_synByParent[f.parentField]) _synByParent[f.parentField] = [];
            _synByParent[f.parentField].push(f);
          }
        }
        const _fieldRowHTML = (f, indent) => {
          const sel = nd.selectedFields.includes(f.alias);
          return '<div class="basic-field-row' + (indent ? ' basic-field-synthetic' : '') + '" style="' + (indent ? 'padding-left:18px;border-left:2px solid var(--border);margin-left:8px' : '') + '" onclick="toggleAdvFieldInProps(\'' + nodeId + '\',\'' + f.alias + '\',this)">'
            + '<input type="checkbox" ' + (sel ? 'checked' : '') + ' onclick="event.stopPropagation();" onchange="toggleAdvFieldInProps(\'' + nodeId + '\',\'' + f.alias + '\',this.closest(\'.basic-field-row\'))"/>'
            + '<label>' + f.alias + '</label>'
            + '</div>';
        };
        const _fieldsHTML = _baseFields.map(f => {
          const children = _synByParent[f.alias] || [];
          return _fieldRowHTML(f, false) + children.map(sf => _fieldRowHTML(sf, true)).join('');
        }).join('');

        body.innerHTML = `
    <div class="form-group">
      <label>Alias</label>
      <input type="text" class="form-input" style="height:28px" value="${nd.alias}" oninput="DataLaVistaState.advancedQB.nodes['${nodeId}'].alias=this.value; if(DataLaVistaState.advancedQB.nodeAliases?.['${nodeId}']!==undefined) DataLaVistaState.advancedQB.nodeAliases['${nodeId}']=this.value; rebuildAdvancedSQL()"/>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-disabled);text-transform:uppercase;margin-bottom:4px">Fields — click to toggle</div>
      ${_fieldsHTML}
    </div>
  `;
        props.classList.add('visible');
      }

      function toggleAdvFieldInProps(nodeId, field, rowEl) {
        // Delegate to advNodeToggleField which also refreshes pills + options panel
        advNodeToggleField(nodeId, field);
      }

      function closeNodeProps() { selectedNode = null; }

      // ============================================================
      // ADVANCED QB — RIGHT OPTIONS PANEL
      // ============================================================
      function renderAdvOptionsPanel(mode, id) {
        const body = document.getElementById('adv-options-body');
        const titleEl = document.getElementById('adv-opts-title-text');
        if (!body) return;

        const setTitle = t => { if (titleEl) titleEl.textContent = t; };

        // ── NO SELECTION: show row-count ──────────────────────────
        if (!mode || (!id && id !== 0)) {
          setTitle('Options');
          body.innerHTML = `
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">ROW COUNT (LIMIT)</div>
              <input type="number" class="form-input" style="height:28px;width:100%"
                min="1" max="100000" value="${DataLaVistaState.advancedQB.rowLimit || 500}"
                oninput="DataLaVistaState.advancedQB.rowLimit=parseInt(this.value)||500; rebuildAdvancedSQL()"/>
              <div style="font-size:11px;color:var(--text-disabled);margin-top:4px">Applies LIMIT to the full query.</div>
            </div>`;
          return;
        }

        // ── JOIN SELECTION ────────────────────────────────────────
        if (mode === 'join') {
          const j = DataLaVistaState.advancedQB.joins[id];
          if (!j) return;
          normalizeJoinKeys(j);
          const fromND = DataLaVistaState.advancedQB.nodes[j.fromNode];
          const toND   = DataLaVistaState.advancedQB.nodes[j.toNode];
          const fromT  = DataLaVistaState.tables[fromND?.tableName];
          const toT    = DataLaVistaState.tables[toND?.tableName];
          const fromAlias = fromND?.alias || fromND?.tableName || '';
          const toAlias   = toND?.alias   || toND?.tableName   || '';

          const JOIN_TYPES = [
            { val: 'INNER',    label: 'Inner Join',          desc: 'ℹ️ Matching rows in both sides' },
            { val: 'LEFT',     label: 'Left Join',           desc: 'ℹ️ Everything on the left, only matching rows on the right' },
            { val: 'RIGHT',    label: 'Right Join',          desc: 'ℹ️ Everything on the right, only matching rows on the left' },
            { val: 'CROSS',    label: 'Cross Join',          desc: 'ℹ️ Combine tables, repeating all rows in 2nd table for every row in 1st table' },
            { val: 'UNION',    label: 'Union',               desc: 'ℹ️ Combine tables, removing duplicate rows' },
            { val: 'UNION ALL',label: 'Union All',           desc: 'ℹ️ Combine tables, keeping duplicate rows' },
            { val: 'DLV_LOOKUP',label: 'Lookup Join',        desc: 'ℹ️ Everything on the left, only matching rows from the SP lookup on the right.' }
          ];

          const augmentFields = (t, tableKey) => {
            const fields = [...(t?.fields || [])].filter(f => !f.isLookupRaw);
            const aliases = new Set(fields.map(f => f.alias));
            for (const r of (DataLaVistaState.relationships || [])) {
              if (r.childTableKey === tableKey && r.childField && !aliases.has(r.childField)) {
                fields.push({ alias: r.childField, internalName: r.childField, isAutoId: true });
                aliases.add(r.childField);
              }
            }
            return fields;
          };
          const fromFields = augmentFields(fromT, fromND?.tableName);
          const toFields   = augmentFields(toT,   toND?.tableName);
          const isLookupJoin = j.type === 'DLV_LOOKUP';
          const filteredFromFields = isLookupJoin
            ? fromFields.filter(f => f.displayType === 'lookup' || f.displayType === 'lookup-multi' || f.displayType === 'array' || (f.alias || '').endsWith('Data'))
            : fromFields;
          const filteredToFields = isLookupJoin
            ? toFields.filter(f => f.isAutoId || f.displayType === 'number' || f.displayType === 'text')
            : toFields;
          const makeFromOpts = (selectedKey) => filteredFromFields.map(f => `<option value="${f.alias}" ${f.alias === selectedKey ? 'selected' : ''}>${f.alias}${f.isAutoId ? ' [auto]' : ''}</option>`).join('');
          const makeToOpts   = (selectedKey) => filteredToFields.map(f => `<option value="${f.alias}" ${f.alias === selectedKey ? 'selected' : ''}>${f.alias}${f.isAutoId ? ' [auto]' : ''}</option>`).join('');

          const keyPairRows = j.keys.map((kp, ki) => `
            <div class="adv-join-key-row" style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:4px;align-items:center;margin-bottom:4px">
              <select class="form-input" style="height:26px" onchange="setActiveJoinKeyProp(${ki},'fromKey',this.value)">
                ${makeFromOpts(kp.fromKey)}
              </select>
              <span style="font-size:13px;color:var(--text-disabled);padding:0 2px">=</span>
              <select class="form-input" style="height:26px" onchange="setActiveJoinKeyProp(${ki},'toKey',this.value)">
                ${makeToOpts(kp.toKey)}
              </select>
              <button class="btn btn-sm" style="padding:0 5px;height:26px;min-width:24px;background:transparent;color:var(--text-disabled);font-size:14px;line-height:1"
                title="Remove this key pair" ${j.keys.length <= 1 ? 'disabled style="opacity:.3;padding:0 5px;height:26px;min-width:24px"' : ''}
                onclick="removeActiveJoinKey(${ki})">✕</button>
            </div>`).join('');

          setTitle('Join Options');
          body.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-size:11px;font-weight:600;color:var(--text-disabled)">LEFT: ${fromAlias}</div>
              <div style="font-size:11px;color:var(--text-disabled)">RIGHT: ${toAlias}</div>
            </div>
            <div class="form-group" style="margin-bottom:4px">
              <label>Alias (left)</label>
              <input type="text" class="form-input" style="height:26px" value="${fromAlias}"
                oninput="if(DataLaVistaState.advancedQB.nodes['${j.fromNode}']) { DataLaVistaState.advancedQB.nodes['${j.fromNode}'].alias=this.value; if(DataLaVistaState.advancedQB.nodeAliases?.['${j.fromNode}']!==undefined) DataLaVistaState.advancedQB.nodeAliases['${j.fromNode}']=this.value; rebuildAdvancedSQL(); }"/>
            </div>
            <div class="form-group" style="margin-bottom:8px">
              <label>Alias (right)</label>
              <input type="text" class="form-input" style="height:26px" value="${toAlias}"
                oninput="if(DataLaVistaState.advancedQB.nodes['${j.toNode}']) { DataLaVistaState.advancedQB.nodes['${j.toNode}'].alias=this.value; if(DataLaVistaState.advancedQB.nodeAliases?.['${j.toNode}']!==undefined) DataLaVistaState.advancedQB.nodeAliases['${j.toNode}']=this.value; rebuildAdvancedSQL(); }"/>
            </div>
            <div class="adv-node-section-hdr" style="margin-bottom:6px">KEY FIELDS
            ${isLookupJoin ? '' : `<span class="qb-badge" style="font-size:10px;padding:2px 8px;cursor:pointer;margin-left:4px"
              data-opts="${_attrEnc(JSON.stringify([{val:'AND',label:'AND'},{val:'OR',label:'OR'}]))}"
              data-cur="${_attrEnc(j.keysConj || 'AND')}"
              data-js="${_attrEnc("setActiveJoinProp('keysConj',__V__)")}"
              onclick="showPropPopup(this)">${j.keysConj || 'AND'}</span>`}
          </div>
            <div id="adv-join-key-pairs">
              ${keyPairRows}
            </div>
            ${isLookupJoin ? '' : `<button class="btn btn-sm" style="width:100%;margin-bottom:10px;font-size:12px" onclick="addActiveJoinKey()">+ Add Key Pair</button>`}
            <div class="form-group" style="margin-top:4px">
              <label>Join Type</label>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span class="qb-badge" style="font-size:11px;padding:3px 10px"
                  data-opts="${_attrEnc(JSON.stringify(JOIN_TYPES.map(jt => ({ val: jt.val, label: jt.label }))))}"
                  data-cur="${_attrEnc(j.type)}"
                  data-js="${_attrEnc("setActiveJoinProp('type',__V__); renderAdvOptionsPanel('join'," + id + ")")}"
                  onclick="showPropPopup(this)">${_attrEnc(JOIN_TYPES.find(jt => jt.val === j.type)?.label || j.type)}</span>
                <span style="font-size:11px;color:var(--text-disabled)">${JOIN_TYPES.find(jt => jt.val === j.type)?.desc || ''}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;margin-top:10px;gap:4px">
              <div id="adv-join-venn">${getVennSVG(j.type, 72)}</div>
              <div style="font-size:11px;color:var(--text-disabled)">${JOIN_TYPES.find(jt=>jt.val===j.type)?.label||j.type}</div>
            </div>
            <button class="btn btn-danger btn-sm" style="margin-top:8px;width:100%" onclick="removeActiveJoin()">✕ Remove Join</button>`;
          return;
        }

        // ── NODE (TABLE) SELECTION ────────────────────────────────
        if (mode === 'node') {
          const nd = DataLaVistaState.advancedQB.nodes[id];
          if (!nd) return;
          const t = DataLaVistaState.tables[nd.tableName];
          if (!t) return;
          const fields = t.fields.filter(f => !f.isAutoId && !f.isLookupRaw && !f.isSynthetic).sort((/** @type {any} */ a, /** @type {any} */ b) => (a.alias || '').localeCompare(b.alias || ''));

          // Ensure state arrays / maps exist on older nodes (loaded from saved config)
          if (!nd.conditions)       nd.conditions = [];
          if (!nd.sorts)            nd.sorts = [];
          if (!nd.groupBy)          nd.groupBy = [];
          if (!nd.fieldAggs)        nd.fieldAggs = {};
          if (!nd.lookupAggFields)  nd.lookupAggFields = {};

          // ── PRIMARY TABLE checkbox ───────────────────────────────
          const isPrimary = DataLaVistaState.advancedQB.primaryNodeId === id;
          const primaryHTML = `
            <div class="adv-node-section">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" ${isPrimary ? 'checked' : ''}
                  onchange="setPrimaryAdvNode('${id}', this.checked)"/>
                <span style="font-size:12px;font-weight:600">Primary Table</span>
              </label>
              <div style="font-size:11px;color:var(--text-disabled);margin-top:2px">Aggregates on this table are the outer grouping level.</div>
            </div>`;

          // ── FIELDS section ───────────────────────────────────────
          const FIELDS_COLLAPSED_COUNT = 5;
          const renderFieldRow = f => {
            const ti  = DataLaVistaCore.FIELD_TYPE_ICONS[f.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
            const sel = nd.selectedFields.includes(f.alias);
            const agg = nd.fieldAggs[f.alias] || '';
            const aggActive = agg !== '';
            const expandable     = _isExpandableLookupField(f, t);
            const dateExpandable = _isExpandableDateField(f, t);
            const isExpandable   = expandable || dateExpandable;
            const expanded       = isExpandable && _expandedLookupFields[id]?.has(f.alias);
            const aggBtnCls   = 'adv-agg-btn' + (aggActive ? ' has-agg' : '');
            const aggLabel    = aggActive ? (aggsForType(f.displayType).find(a => a.val === agg)?.label || agg) : 'No aggregate';
            const aggBtnContent = aggActive ? getAggIcon(agg) : '∑';
            // Disable agg button only for multi-select SP lookup fields that have remote rollup children
            // (the user must expand and pick child field aggregates instead of aggregating the parent directly).
            const hasObjChildren = expandable && f.displayType === 'lookup-multi' &&
              (DataLaVistaState.relationships || []).some(r =>
                r.isMultiSelect && r.childTableKey === nd.tableName && r.spLookupField === f.internalName
              );
            const aggBtn = hasObjChildren
              ? '<button class="adv-agg-btn" disabled title="Expand ▼ to select child field aggregates">∑</button>'
              : '<button class="' + aggBtnCls + '" title="' + aggLabel + '"'
                + ' onclick="event.stopPropagation();showAdvAggPopup(\'' + id + '\',\'' + f.alias + '\',this)">'
                + aggBtnContent + '</button>';
            const expandBtnCls = 'adv-expand-btn' + (expanded ? ' expanded' : '');
            const expandBtn = isExpandable
              ? '<button class="' + expandBtnCls + '" title="' + (expanded ? 'Collapse' : 'Expand') + '"'
                + ' onclick="event.stopPropagation();_toggleLookupExpand(\'' + id + '\',\'' + f.alias + '\')">'
                + (expanded ? '▼' : '▶') + '</button>'
              : '';
            const childRows = expanded
              ? (expandable ? _renderChildFieldRows(id, nd, f) : _renderDateChildRows(id, nd, f, t))
              : '';
            return `<div class="adv-field-row${sel ? ' selected' : ''}"
                onclick="advNodeToggleField('${id}','${f.alias}')" draggable="true"
                ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-field-pill',nodeId:'${id}',field:'${f.alias}'})">
              <input type="checkbox" ${sel ? 'checked' : ''}/>
              <span class="field-type-icon ${ti.cls}">${ti.icon}</span>
              <span class="field-name">${f.userAlias || f.alias}</span>
              ${expandBtn}${aggBtn}
            </div>${childRows}`;
          };
          const renderFieldsSection = () => {
            const visible = _advOptsFieldsExpanded ? fields : fields.slice(0, FIELDS_COLLAPSED_COUNT);
            const extra   = fields.length - FIELDS_COLLAPSED_COUNT;
            let html = visible.map(renderFieldRow).join('');
            if (fields.length > FIELDS_COLLAPSED_COUNT) {
              if (_advOptsFieldsExpanded) {
                html += `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px;font-size:10px"
                  onclick="_advShowLessFields('${id}')">▲ Show less</button>`;
              } else {
                html += `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px;font-size:10px"
                  onclick="_advShowMoreFields('${id}')">▼ Show ${extra} more</button>`;
              }
            }
            return html;
          };

          // ── FILTER CONDITIONS section ───────────────────────────
          const condCols = fields.map(f => ({
            alias: f.alias,
            displayType: f.displayType,
            tableKey: nd.tableName,
            fieldInternalName: f.internalName,
          }));
          const renderNodeConditions = () => renderConditionRows(
            nd.conditions, condCols,
            (ci, v) => `advNodeCond('${id}',${ci},'conj',${v})`,
            (ci, v) => `advNodeCond('${id}',${ci},'field',${v})`,
            (ci, v) => `advNodeCond('${id}',${ci},'op',${v})`,
            (ci, v) => `advNodeCondValOnly('${id}',${ci},${v})`,
            (ci)    => `advNodeRemoveCond('${id}',${ci})`,
            (ci)    => `draggable="true" ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-node-cond',nodeId:'${id}',idx:${ci}})"`,
            (ci, v) => `advNodeCondVal2Only('${id}',${ci},${v})`,
            (ci, v) => `advNodeCond('${id}',${ci},'elementKey',${v})`
          );

          // ── SORT section ────────────────────────────────────────
          const sortCols = fields.map(f => f.alias);
          const renderNodeSorts = () => renderSortRows(
            nd.sorts, sortCols,
            (si, v) => `advNodeSort('${id}',${si},'field',${v})`,
            (si, v) => `advNodeSort('${id}',${si},'dir',${v})`,
            (si)    => `advNodeRemoveSort('${id}',${si})`,
            (si)    => `draggable="true" ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-node-sort',nodeId:'${id}',idx:${si}})"`
          );

          // ── GROUP BY section ────────────────────────────────────
          const renderNodeGroupBy = () => {
            if (!nd.groupBy.length)
              return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No grouping — click + Add</div>';
            return nd.groupBy.map((g, gi) => `
              <div class="qb-sort-row" draggable="true"
                  ondragstart="event.stopPropagation();safeDragSet(event,{type:'adv-node-gb',nodeId:'${id}',idx:${gi}})">
                <select class="form-input qb-field-select" onchange="advNodeGB('${id}',${gi},this.value)">
                  ${fields.map(f=>`<option value="${f.alias}" ${f.alias===g?'selected':''}>${f.alias}</option>`).join('')}
                </select>
                <button class="btn btn-ghost btn-sm btn-icon" onclick="advNodeRemoveGB('${id}',${gi})">✕</button>
              </div>`).join('');
          };

          // ── Drop-zone handler factories ─────────────────────────
          const makeDZHandlers = (zone, dropAction) => {
            zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', e => {
              e.preventDefault(); zone.classList.remove('drag-over');
              const data = safeDragParse(e);
              if (!data) return;
              dropAction(data);
            });
          };

          // ── GROUP BY auto-lock when aggregates active ────────────
          const activeAggs = nd.selectedFields.filter(f => (nd.fieldAggs || {})[f]);
          const hasAggs    = activeAggs.length > 0;
          const nonAggFields = nd.selectedFields.filter(f => !(nd.fieldAggs || {})[f]);
          const gbAutoHTML = hasAggs
            ? (nonAggFields.length
                ? `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${nonAggFields.join(', ')}</div>`
                : `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All fields aggregated — no GROUP BY needed</div>`)
            : null;

          setTitle(nd.alias || nd.tableName);
          body.innerHTML = primaryHTML + `
            <div class="adv-node-section">
              <div class="adv-node-section-hdr"><span>FIELDS</span>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="advNodeClearFields('${id}')">- Clear all</button>
                  <button class="btn btn-ghost btn-sm" onclick="advNodeAddAllFields('${id}')">+ Add all</button>
                </div>
              </div>
              <div id="adv-node-fields">${renderFieldsSection()}</div>
            </div>
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">
                <span>FILTER CONDITIONS</span>
                <button class="btn btn-ghost btn-sm" onclick="advNodeAddCond('${id}')">+ Add</button>
              </div>
              <div id="adv-node-conds" class="adv-drop-zone">${renderNodeConditions()}</div>
            </div>
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">
                <span>SORT ORDER</span>
                <button class="btn btn-ghost btn-sm" onclick="advNodeAddSort('${id}')">+ Add</button>
              </div>
              <div id="adv-node-sorts" class="adv-drop-zone">${renderNodeSorts()}</div>
            </div>
            <div class="adv-node-section">
              <div class="adv-node-section-hdr">
                <span>${hasAggs ? 'GROUP BY (auto)' : 'GROUP BY'}</span>
                ${hasAggs ? '' : `<button class="btn btn-ghost btn-sm" onclick="advNodeAddGB('${id}')">+ Add</button>`}
              </div>
              <div id="adv-node-groupby" class="adv-drop-zone">${hasAggs ? gbAutoHTML : renderNodeGroupBy()}</div>
            </div>`;

          // Wire drop zones to accept field pills / field rows dropped onto them
          const condZone  = body.querySelector('#adv-node-conds');
          const sortZone  = body.querySelector('#adv-node-sorts');
          const groupZone = body.querySelector('#adv-node-groupby');

          makeDZHandlers(condZone, data => {
            if (data.type === 'adv-field-pill' || data.type === 'adv-field-row') {
              const fAlias = data.field;
              if (!nd.conditions) nd.conditions = [];
              nd.conditions.push({ conj:'AND', field: fAlias, op:'=', value:'' });
              rebuildAdvancedSQL(); renderAdvOptionsPanel('node', id);
            }
          });
          makeDZHandlers(sortZone, data => {
            if (data.type === 'adv-field-pill' || data.type === 'adv-field-row') {
              if (!nd.sorts) nd.sorts = [];
              nd.sorts.push({ field: data.field, dir:'ASC' });
              rebuildAdvancedSQL(); renderAdvOptionsPanel('node', id);
            }
          });
          makeDZHandlers(groupZone, data => {
            if (data.type === 'adv-field-pill' || data.type === 'adv-field-row') {
              if (!nd.groupBy) nd.groupBy = [];
              nd.groupBy.push(data.field);
              rebuildAdvancedSQL(); renderAdvOptionsPanel('node', id);
            }
          });
        }
      }

      // ── Helpers for per-node conditions / sorts / groupby ─────────────────────────
      function advNodeCond(nodeId, idx, prop, val) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd || !nd.conditions[idx]) return;
        nd.conditions[idx][prop] = val;
        // Reset op/value when field or elementKey changes to avoid stale operators/values
        if (prop === 'field' || prop === 'elementKey') {
          nd.conditions[idx].op = '=';
          nd.conditions[idx].value = (prop === 'field' && sniffType(nd.conditions[idx].field) === 'boolean') ? 'true' : '';
          nd.conditions[idx].value2 = '';
          if (prop === 'field') nd.conditions[idx].elementKey = '';
        }
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      // Value-only updates: update state + SQL without re-rendering the panel
      // (prevents focus loss in autosuggest text inputs)
      function advNodeCondValOnly(nodeId, idx, val) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd || !nd.conditions[idx]) return;
        nd.conditions[idx].value = val;
        rebuildAdvancedSQL();
      }
      function advNodeCondVal2Only(nodeId, idx, val) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd || !nd.conditions[idx]) return;
        nd.conditions[idx].value2 = val;
        rebuildAdvancedSQL();
      }
      function advNodeAddCond(nodeId) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = DataLaVistaState.tables[nd.tableName];
        const fields = t ? t.fields.filter(f => !f.isAutoId && !f.isLookupRaw && !f.isSynthetic) : [];
        if (!nd.conditions) nd.conditions = [];
        nd.conditions.push({ conj: 'AND', field: fields[0]?.alias || '', op: '=', value: '' });
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeRemoveCond(nodeId, idx) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.conditions.splice(idx, 1);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeClearAllConds(/** @type {string} */ nodeId) {
        const nd = (/** @type {Record<string,any>} */ (DataLaVistaState.advancedQB.nodes))[nodeId];
        if (!nd) return;
        nd.conditions = [];
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeSort(nodeId, idx, prop, val) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd || !nd.sorts[idx]) return;
        nd.sorts[idx][prop] = val;
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeAddSort(nodeId) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = DataLaVistaState.tables[nd.tableName];
        const fields = t ? t.fields.filter(f => !f.isAutoId && !f.isLookupRaw && !f.isSynthetic) : [];
        if (!nd.sorts) nd.sorts = [];
        nd.sorts.push({ field: fields[0]?.alias || '', dir: 'ASC' });
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeRemoveSort(nodeId, idx) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.sorts.splice(idx, 1);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeGB(nodeId, idx, val) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.groupBy[idx] = val;
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeAddGB(nodeId) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        const t = DataLaVistaState.tables[nd.tableName];
        const fields = t ? t.fields.filter(f => !f.isAutoId && !f.isLookupRaw) : [];
        if (!nd.groupBy) nd.groupBy = [];
        nd.groupBy.push(fields[0]?.alias || '');
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      function advNodeRemoveGB(nodeId, idx) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        nd.groupBy.splice(idx, 1);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      /** @param {string} nodeId */
      function advNodeClearFields(nodeId) {
        const nd = (/** @type {any} */ (DataLaVistaState.advancedQB.nodes))[nodeId];
        if (!nd) return;
        nd.selectedFields = [];
        nd.fieldAggs = {};
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }
      /** @param {string} nodeId */
      function advNodeAddAllFields(nodeId) {
        const nd = (/** @type {any} */ (DataLaVistaState.advancedQB.nodes))[nodeId];
        if (!nd) return;
        const t = (/** @type {any} */ (DataLaVistaState.tables))[nd.tableName];
        const allAliases = ((t?.fields || []) /** @type {any[]} */ ).filter((/** @type {any} */ f) => !f.isAutoId && !f.isLookupRaw && !f.isSynthetic).map((/** @type {any} */ f) => f.alias);
        nd.selectedFields = allAliases;
        updateAdvNodePills(nodeId);
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }

      // Draw join line
      function startDrawJoin(e, nodeId, side) {
        e.preventDefault();
        const canvas = document.getElementById('qb-canvas');
        const crect = canvas.getBoundingClientRect();
        drawingJoin = { fromNode: nodeId, fromSide: side, startX: e.clientX - crect.left, startY: e.clientY - crect.top };

        const tmpLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tmpLine.setAttribute('stroke', '#0078d4');
        tmpLine.setAttribute('stroke-width', '2');
        tmpLine.setAttribute('stroke-dasharray', '4');
        tmpLine.id = 'tmp-join-line';
        document.getElementById('qb-svg').appendChild(tmpLine);

        const onMove = mv => {
          const x2 = mv.clientX - crect.left, y2 = mv.clientY - crect.top;
          tmpLine.setAttribute('x1', drawingJoin.startX); tmpLine.setAttribute('y1', drawingJoin.startY);
          tmpLine.setAttribute('x2', x2); tmpLine.setAttribute('y2', y2);
        };
        const onUp = mv => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          tmpLine.remove();
          // Find target snap point
          const target = document.elementFromPoint(mv.clientX, mv.clientY);
          if (target && target.classList.contains('snap-point')) {
            const toNode = target.dataset.node;
            const toSide = target.dataset.side;
            if (toNode && toNode !== drawingJoin.fromNode) {
              addJoin(drawingJoin.fromNode, drawingJoin.fromSide, toNode, toSide);
            }
          }
          drawingJoin = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      /** Migrate legacy single-key join objects to the keys-array format in place. */
      function normalizeJoinKeys(j) {
        if (!j.keys) j.keys = [{ fromKey: j.fromKey || 'ID', toKey: j.toKey || 'ID' }];
        return j;
      }

      function addJoin(fromNode, fromSide, toNode, toSide) {
        const fromT = DataLaVistaState.tables[DataLaVistaState.advancedQB.nodes[fromNode]?.tableName];
        const toT = DataLaVistaState.tables[DataLaVistaState.advancedQB.nodes[toNode]?.tableName];
        if (!fromT || !toT) return;

        // Prevent duplicate table pairs via the ⚯ icon
        const existing = DataLaVistaState.advancedQB.joins.find(j =>
          (j.fromNode === fromNode && j.toNode === toNode) ||
          (j.fromNode === toNode   && j.toNode === fromNode));
        if (existing) {
          toast('Tables are already joined. Select the join line to add more key fields.', 'warning');
          // Auto-select the existing join so the user can inspect/edit it
          const existIdx = DataLaVistaState.advancedQB.joins.indexOf(existing);
          DataLaVistaState.advancedQB.activeJoinIdx = existIdx;
          selectedNode = null;
          document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
          renderAdvOptionsPanel('join', existIdx);
          return;
        }

        // Smart key detection
        let fromKey = 'ID', toKey = 'ID';
        const fromAlias = DataLaVistaState.advancedQB.nodes[fromNode]?.alias || DataLaVistaState.advancedQB.nodes[fromNode]?.tableName;
        const toAlias = DataLaVistaState.advancedQB.nodes[toNode]?.alias || DataLaVistaState.advancedQB.nodes[toNode]?.tableName;
        for (const f of toT.fields) {
          if (f.alias.toLowerCase() === fromAlias.toLowerCase() + 'id' || f.alias.toLowerCase() === fromAlias.toLowerCase().replace(/s$/, '') + 'id') {
            toKey = f.alias; fromKey = 'ID'; break;
          }
        }
        for (const f of fromT.fields) {
          if (f.alias.toLowerCase() === toAlias.toLowerCase() + 'id' || f.alias.toLowerCase() === toAlias.toLowerCase().replace(/s$/, '') + 'id') {
            fromKey = f.alias; toKey = 'ID'; break;
          }
        }

        // Auto-detect DLV_LOOKUP when a known multi-select SP lookup relationship exists
        let joinType = 'LEFT';
        const fromTableName = DataLaVistaState.advancedQB.nodes[fromNode]?.tableName;
        const toTableName   = DataLaVistaState.advancedQB.nodes[toNode]?.tableName;
        for (const rel of (DataLaVistaState.relationships || [])) {
          if (rel.source !== 'sharepoint-lookup' || !rel.isMultiSelect) continue;
          if ((rel.childTableKey === fromTableName && rel.parentTableKey === toTableName) ||
              (rel.childTableKey === toTableName   && rel.parentTableKey === fromTableName)) {
            joinType = 'DLV_LOOKUP';
            const childT  = DataLaVistaState.tables[rel.childTableKey];
            const parentT = DataLaVistaState.tables[rel.parentTableKey];
            const ck = (childT?.fields.find(f => f.internalName === rel.childField))?.alias || rel.childField;
            const pk = (parentT?.fields.find(f => f.internalName === rel.parentField))?.alias || rel.parentField;
            fromKey = (rel.childTableKey === fromTableName) ? ck : pk;
            toKey   = (rel.childTableKey === fromTableName) ? pk : ck;
            break;
          }
        }
        DataLaVistaState.advancedQB.joins.push({ fromNode, fromSide, toNode, toSide, keys: [{ fromKey, toKey }], type: joinType });
        redrawJoins();
        rebuildAdvancedSQL();
        // Auto-select the new join to show its options panel
        const newIdx = DataLaVistaState.advancedQB.joins.length - 1;
        DataLaVistaState.advancedQB.activeJoinIdx = newIdx;
        selectedNode = null;
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        renderAdvOptionsPanel('join', newIdx);
      }

      /** Create a join between two nodes with explicit key fields (skips smart detection). */
      function addJoinWithKeys(fromNode, toNode, fromKey, toKey) {
        const fromT = DataLaVistaState.tables[DataLaVistaState.advancedQB.nodes[fromNode]?.tableName];
        const toT   = DataLaVistaState.tables[DataLaVistaState.advancedQB.nodes[toNode]?.tableName];
        if (!fromT || !toT) return;
        // Determine best snap sides based on relative horizontal positions
        const fromNd = DataLaVistaState.advancedQB.nodes[fromNode];
        const toNd   = DataLaVistaState.advancedQB.nodes[toNode];
        const fromSide = (fromNd.x < toNd.x) ? 'right' : 'left';
        const toSide   = (fromNd.x < toNd.x) ? 'left'  : 'right';
        DataLaVistaState.advancedQB.joins.push({ fromNode, fromSide, toNode, toSide, keys: [{ fromKey, toKey }], type: 'LEFT' });
        redrawJoins();
        rebuildAdvancedSQL();
        const newIdx = DataLaVistaState.advancedQB.joins.length - 1;
        DataLaVistaState.advancedQB.activeJoinIdx = newIdx;
        selectedNode = null;
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        renderAdvOptionsPanel('join', newIdx);
      }

      /** Called when user drops a field pill onto a pill in a different table. */
      function addJoinFromPills(fromNode, fromKey, toNode, toKey) {
        const existing = DataLaVistaState.advancedQB.joins.find(j =>
          (j.fromNode === fromNode && j.toNode === toNode) ||
          (j.fromNode === toNode   && j.toNode === fromNode));
        if (existing) {
          normalizeJoinKeys(existing);
          // Normalize direction to match existing join's fromNode/toNode orientation
          const [fk, tk] = existing.fromNode === fromNode ? [fromKey, toKey] : [toKey, fromKey];
          const alreadyExists = existing.keys.some(k => k.fromKey === fk && k.toKey === tk);
          if (alreadyExists) {
            toast('This key combination already exists in the join.', 'warning');
            return;
          }
          existing.keys.push({ fromKey: fk, toKey: tk });
          redrawJoins();
          rebuildAdvancedSQL();
          const idx = DataLaVistaState.advancedQB.joins.indexOf(existing);
          DataLaVistaState.advancedQB.activeJoinIdx = idx;
          selectedNode = null;
          document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
          renderAdvOptionsPanel('join', idx);
          toast('Key fields added to existing join.', 'success');
        } else {
          addJoinWithKeys(fromNode, toNode, fromKey, toKey);
        }
      }

      function getSnapPoint(nodeId, side) {
        const el = document.getElementById('adv-' + nodeId);
        if (!el) return { x: 0, y: 0 };
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        const r = el.getBoundingClientRect();
        const canvas = document.getElementById('qb-canvas');
        const cr = canvas.getBoundingClientRect();
        const x = nd.x + (side === 'left' ? 0 : side === 'right' ? el.offsetWidth : el.offsetWidth / 2);
        const y = nd.y + (side === 'top' ? 0 : side === 'bottom' ? el.offsetHeight : el.offsetHeight / 2);
        return { x, y };
      }

      function redrawJoins() {
        const svg = document.getElementById('qb-svg');
        svg.innerHTML = '';

        // Arrowhead marker (must be first)
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `<marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
    <polygon points="0 0, 8 3, 0 6" fill="#0078d4"/>
  </marker>`;
        svg.appendChild(defs);

        for (let ji = 0; ji < DataLaVistaState.advancedQB.joins.length; ji++) {
          const j = DataLaVistaState.advancedQB.joins[ji];
          const from = getSnapPoint(j.fromNode, j.fromSide);
          const to   = getSnapPoint(j.toNode,   j.toSide);
          const dx   = (to.x - from.x) * 0.5;
          const d    = `M${from.x},${from.y} C${from.x+dx},${from.y} ${to.x-dx},${to.y} ${to.x},${to.y}`;

          // Invisible wide hit path
          const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hitPath.setAttribute('d', d);
          hitPath.setAttribute('stroke', 'transparent');
          hitPath.setAttribute('stroke-width', '12');
          hitPath.setAttribute('fill', 'none');
          hitPath.style.cursor = 'pointer';
          hitPath.style.pointerEvents = 'stroke';
          hitPath.addEventListener('click', e => { e.stopPropagation(); selectJoin(j, from, to); });
          svg.appendChild(hitPath);

          // Visible path
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', d);
          path.setAttribute('stroke', '#0078d4');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          path.setAttribute('marker-end', 'url(#arrowhead)');
          path.classList.add('join-line');
          path.style.cursor = 'pointer';
          path.style.pointerEvents = 'stroke';
          path.addEventListener('click', e => { e.stopPropagation(); selectJoin(j, from, to); });
          svg.appendChild(path);

          // Venn badge at midpoint via foreignObject (allows HTML drag events)
          const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
          const badgeW = 44, badgeH = 44;
          const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
          fo.setAttribute('x', mx - badgeW / 2);
          fo.setAttribute('y', my - badgeH / 2);
          fo.setAttribute('width', badgeW);
          fo.setAttribute('height', badgeH);
          fo.style.pointerEvents = 'all';
          fo.style.overflow = 'visible';

          const badge = document.createElement('div');
          badge.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
          badge.className = 'join-venn-badge';
          badge.draggable = true;
          badge.title = 'Drag to Clear to remove join • Click to edit';
          const _badgeLabel = j.type === 'DLV_LOOKUP' ? 'LOOKUP' : j.type;
          badge.innerHTML = getVennSVG(j.type, 32) + `<span class="join-venn-label">${_badgeLabel}</span>`;

          const jCapture = j;
          badge.addEventListener('click', e => { e.stopPropagation(); selectJoin(jCapture, from, to); });
          badge.addEventListener('dragstart', e => {
            e.stopPropagation();
            safeDragSet(e, { type: 'adv-join-trash', idx: ji });
          });
          fo.appendChild(badge);
          svg.appendChild(fo);
        }
      }

      function selectJoin(joinObj, from, to) {
        // Store reference by index so inline handlers can reach it safely
        const joinIdx = DataLaVistaState.advancedQB.joins.indexOf(joinObj);
        if (joinIdx < 0) return;
        DataLaVistaState.advancedQB.activeJoinIdx = joinIdx;
        selectedNode = null;
        document.querySelectorAll('.qb-table-node').forEach(n => n.classList.remove('selected'));
        renderAdvOptionsPanel('join', joinIdx);
      }

      /** Called by inline onchange handlers inside the join props popup */
      function setActiveJoinProp(prop, value) {
        const idx = DataLaVistaState.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        const j = DataLaVistaState.advancedQB.joins[idx];
        if (!j) return;
        j[prop] = value;
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('join', idx);
      }

      function setActiveJoinKeyProp(keyIdx, prop, value) {
        const idx = DataLaVistaState.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        const j = DataLaVistaState.advancedQB.joins[idx];
        if (!j) return;
        normalizeJoinKeys(j);
        if (!j.keys[keyIdx]) return;
        j.keys[keyIdx][prop] = value;
        redrawJoins();
        rebuildAdvancedSQL();
      }

      function removeActiveJoinKey(keyIdx) {
        const idx = DataLaVistaState.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        const j = DataLaVistaState.advancedQB.joins[idx];
        if (!j || j.keys.length <= 1) return;
        j.keys.splice(keyIdx, 1);
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('join', idx);
      }

      function addActiveJoinKey() {
        const idx = DataLaVistaState.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        const j = DataLaVistaState.advancedQB.joins[idx];
        if (!j) return;
        normalizeJoinKeys(j);
        const fromT = DataLaVistaState.tables[DataLaVistaState.advancedQB.nodes[j.fromNode]?.tableName];
        const toT   = DataLaVistaState.tables[DataLaVistaState.advancedQB.nodes[j.toNode]?.tableName];
        j.keys.push({ fromKey: fromT?.fields?.[0]?.alias || 'ID', toKey: toT?.fields?.[0]?.alias || 'ID' });
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('join', idx);
      }

      /** Called by the Remove Join button inside the join props popup */
      function removeActiveJoin() {
        const idx = DataLaVistaState.advancedQB.activeJoinIdx;
        if (idx == null || idx < 0) return;
        DataLaVistaState.advancedQB.joins.splice(idx, 1);
        DataLaVistaState.advancedQB.activeJoinIdx = -1;
        redrawJoins();
        rebuildAdvancedSQL();
        renderAdvOptionsPanel(null, null);
      }

      // ── Enable / disable the Design › Preview › Generate toolbar buttons ──────
      function setDesignTabsEnabled(enabled, reason) {
        // Only enable if caller says OK AND a query has already run successfully
        const actualEnabled = enabled && !!DataLaVistaState.queryResultsReady;
        const ids = ['toolbar-button-design', 'toolbar-button-preview', 'toolbar-button-generate'];
        ids.forEach(id => {
          const btn = document.getElementById(id);
          if (!btn) return;
          btn.disabled = !actualEnabled;
          btn.title = actualEnabled ? '' : (reason || (!DataLaVistaState.queryResultsReady ? 'Run a query first' : 'Disabled'));
          btn.style.opacity = actualEnabled ? '' : '.4';
          btn.style.pointerEvents = actualEnabled ? '' : 'none';
        });
      }

      // ── Lookup / array-of-objects field expansion helpers ──────────────────────

      // Resolve the PK field alias for a table (e.g. 'ID' for SP tables). Used when generating DLV_LOOKUP SQL.
      function _resolveTablePK(table) {
        const pk = (table?.fields || []).find(f => f.internalName === 'ID' || f.internalName === 'Id')
                || (table?.fields || []).find(f => /^id$/i.test(f.alias));
        return pk?.alias || 'ID';
      }

      // Returns true if a field should get the expand-to-children UX.
      // Any non-synthetic field with at least one non-raw, non-autoId synthetic child is expandable.
      // Date types are excluded here — they are handled separately by _isExpandableDateField.
      function _isExpandableLookupField(f, t) {
        if (!f || !t || f.isLookupRaw || f.isAutoId || f.isSynthetic) return false;
        if (f.displayType === 'date' || f.displayType === 'datetime') return false;
        return (t.fields || []).some(x => x.isSynthetic && !x.isLookupRaw && !x.isAutoId && x.parentField === f.internalName);
      }

      // Returns true if f is a synthetic field whose parent is a date-typed field
      function _isDateSyntheticChild(f, t) {
        if (!f.isSynthetic || !f.parentField) return false;
        const parent = (t.fields || []).find(p => p.internalName === f.parentField && !p.isSynthetic);
        return parent?.displayType === 'date' || parent?.type === 'date';
      }

      // Returns all visible date synthetic companions for a date parent field
      function _getDateSyntheticChildren(f, t) {
        return (t.fields || []).filter(sf =>
          sf.isSynthetic && sf.parentField === f.internalName && !sf.isLookupRaw
        );
      }

      // Returns true if f is a non-synthetic date field that has synthetic date companions
      function _isExpandableDateField(f, t) {
        if (f.isSynthetic || f.isLookupRaw || f.isAutoId) return false;
        if (f.displayType !== 'date' && f.type !== 'date') return false;
        return _getDateSyntheticChildren(f, t).length > 0;
      }

      // Render indented child rows for an expanded date field
      function _renderDateChildRows(nodeId, nd, parentField, t) {
        const children = _getDateSyntheticChildren(parentField, t);
        if (!children.length) return '';
        const rows = children.map(cf => {
          const ti = DataLaVistaCore.FIELD_TYPE_ICONS[cf.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const sel = nd.selectedFields.includes(cf.alias);
          const agg = nd.fieldAggs[cf.alias] || '';
          const aggActive = agg !== '';
          const aggCls = 'adv-agg-btn' + (aggActive ? ' has-agg' : '');
          const aggTitle = aggActive ? agg : 'No aggregate';
          const aggContent = aggActive ? getAggIcon(agg) : '∑';
          const aggBtn = '<button class="' + aggCls + '" title="' + aggTitle + '"'
            + ' onclick="event.stopPropagation();showAdvAggPopup(\'' + nodeId + '\',\'' + cf.alias + '\',this)">'
            + aggContent + '</button>';
          const rowCls = 'adv-field-row adv-child-field-row' + (sel ? ' selected' : '');
          return '<div class="' + rowCls + '" style="padding-left:22px"'
            + ' onclick="advNodeToggleField(\'' + nodeId + '\',\'' + cf.alias + '\')" draggable="true"'
            + ' ondragstart="event.stopPropagation();safeDragSet(event,{type:\'adv-field-pill\',nodeId:\'' + nodeId + '\',field:\'' + cf.alias + '\'})">'
            + '<input type="checkbox" ' + (sel ? 'checked' : '') + ' onclick="event.stopPropagation();" onchange="advNodeToggleField(\'' + nodeId + '\',\'' + cf.alias + '\')"/>'
            + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
            + '<span class="field-name" style="font-size:11px">' + (cf.userAlias || cf.alias) + '</span>'
            + aggBtn
            + '</div>';
        }).join('');
        return '<div class="adv-child-fields">' + rows + '</div>';
      }

      // Aggregates available for child fields by type (no "none" option — child fields always have an agg)
      function _childAggsForType(displayType) {
        const COUNT_DIST  = { val: 'COUNT_DISTINCT', label: 'COUNT DISTINCT' };
        const COUNT       = { val: 'COUNT',          label: 'COUNT' };
        const LIST        = { val: 'LIST',           label: 'LIST' };
        const SUM         = { val: 'SUM',            label: 'SUM' };
        const AVG         = { val: 'AVG',            label: 'AVG' };
        const MIN         = { val: 'MIN',            label: 'MIN' };
        const MAX         = { val: 'MAX',            label: 'MAX' };
        const MEDIAN      = { val: 'MEDIAN',         label: 'MEDIAN' };
        const MODE        = { val: 'MODE',           label: 'MODE' };
        const STDEV       = { val: 'STDEV',          label: 'STD DEV' };
        const VAR         = { val: 'VAR',            label: 'VARIANCE' };
        const CV          = { val: 'CV',             label: 'CV (Coeff. of Variation)' };
        const EARLIEST    = { val: 'EARLIEST',       label: 'EARLIEST' };
        const LATEST      = { val: 'LATEST',         label: 'LATEST' };
        const FIRST_ALPHA = { val: 'FIRST_ALPHA',    label: 'FIRST ALPHABETICALLY' };
        const LAST_ALPHA  = { val: 'LAST_ALPHA',     label: 'LAST ALPHABETICALLY' };

        if (displayType === 'number')
          return [COUNT_DIST, COUNT, SUM, AVG, MIN, MAX, MEDIAN, MODE, STDEV, VAR, CV, LIST];
        if (displayType === 'date')
          return [COUNT_DIST, COUNT, EARLIEST, LATEST, MEDIAN, MODE, LIST];
        if (displayType === 'boolean')
          return [COUNT_DIST, COUNT];
        if (displayType === 'array')
          return [COUNT, LIST];
        if (displayType === 'object')
          return [COUNT];
        if (displayType === 'lookup')
          return [];
        // text and default
        return [COUNT_DIST, COUNT, FIRST_ALPHA, LAST_ALPHA, MODE, LIST];
      }

      // Get the child fields for an expandable field.
      // Returns local non-raw synthetics grouped under this parent, plus (for multi-select SP lookup)
      // remote table fields for DLV_LOOKUP rollup aggregation marked with _isRemoteRollup:true.
      // tableKey = nd.tableName (the raw table key, same as the key in DataLaVistaState.tables)
      function _getChildFieldsForLookup(f, tableKey) {
        const t = DataLaVistaState.tables[tableKey];
        const synthChildren = (t?.fields || []).filter(x =>
          x.isSynthetic && !x.isLookupRaw && !x.isAutoId && x.parentField === f.internalName
        );
        // For multi-select SP lookup fields: also include remote table fields for rollup aggregation
        if (f.displayType === 'lookup-multi') {
          const rel = (DataLaVistaState.relationships || []).find(r =>
            r.source === 'sharepoint-lookup' && r.isMultiSelect &&
            r.childTableKey === tableKey && r.spLookupField === f.internalName
          );
          const remoteTable = rel?.parentTableKey && DataLaVistaState.tables[rel.parentTableKey];
          if (remoteTable) {
            const remoteFields = (remoteTable.fields || []).filter(rf =>
              !rf.isAutoId && !rf.isLookupRaw && !rf.isSynthetic &&
              !['lookup', 'lookup-multi', 'array', 'object'].includes(rf.displayType)
            ).map(rf => ({ ...rf, _isRemoteRollup: true }));
            return [...synthChildren, ...remoteFields];
          }
        }
        return synthChildren;
      }

      // Get the remote view name for an SP multi-select lookup field
      function _getRemoteViewForLookup(tableKey, lookupAlias) {
        const rel = (DataLaVistaState.relationships || []).find(r =>
          r.source === 'sharepoint-lookup' && r.isMultiSelect &&
          r.childTableKey === tableKey &&
          r.childField === lookupAlias + 'Data'
        );
        if (!rel) return null;
        return CyberdynePipeline.rawTableToView[rel.parentTableKey] || rel.parentTableKey;
      }

      // Toggle expand/collapse of a lookup field's child list in the options panel
      function _toggleLookupExpand(nodeId, fieldAlias) {
        if (!_expandedLookupFields[nodeId]) _expandedLookupFields[nodeId] = new Set();
        if (_expandedLookupFields[nodeId].has(fieldAlias))
          _expandedLookupFields[nodeId].delete(fieldAlias);
        else
          _expandedLookupFields[nodeId].add(fieldAlias);
        renderAdvOptionsPanel('node', nodeId);
      }

      // Toggle a child field on/off; default agg = COUNT_DISTINCT
      function _toggleLookupChild(nodeId, parentAlias, childField, checked) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd) return;
        if (!nd.lookupAggFields) nd.lookupAggFields = {};
        if (!nd.lookupAggFields[parentAlias]) nd.lookupAggFields[parentAlias] = [];
        if (checked) {
          if (!nd.lookupAggFields[parentAlias].find(x => x.field === childField)) {
            nd.lookupAggFields[parentAlias].push({
              field: childField,
              agg: 'COUNT_DISTINCT',
              alias: parentAlias + '_' + childField
            });
          }
        } else {
          nd.lookupAggFields[parentAlias] = nd.lookupAggFields[parentAlias].filter(x => x.field !== childField);
        }
        rebuildAdvancedSQL();
        renderAdvOptionsPanel('node', nodeId);
      }

      // Change the aggregate for a checked child field
      function _setLookupChildAgg(nodeId, parentAlias, childField, newAgg) {
        const nd = DataLaVistaState.advancedQB.nodes[nodeId];
        if (!nd?.lookupAggFields?.[parentAlias]) return;
        const entry = nd.lookupAggFields[parentAlias].find(x => x.field === childField);
        if (entry) { entry.agg = newAgg; rebuildAdvancedSQL(); }
      }

      // Render the indented child-field rows for an expanded field.
      // Remote rollup fields (_isRemoteRollup) get aggregate dropdowns (DLV_LOOKUP rollup path).
      // Local synthetic fields get simple checkbox toggles (adds to selectedFields).
      function _renderChildFieldRows(nodeId, nd, parentField) {
        const childFields = _getChildFieldsForLookup(parentField, nd.tableName);
        if (!childFields.length) return '<div class="adv-child-fields"><span style="font-size:10px;color:var(--text-disabled)">No child fields found</span></div>';
        const entries = nd.lookupAggFields?.[parentField.alias] || [];
        const rows = childFields.map(cf => {
          const ti = DataLaVistaCore.FIELD_TYPE_ICONS[cf.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          if (cf._isRemoteRollup) {
            const entry = entries.find(x => x.field === cf.alias);
            const checked = !!entry;
            const currentAgg = entry?.agg || 'COUNT_DISTINCT';
            const aggs = _childAggsForType(cf.displayType);
            const aggOptions = aggs.map(a =>
              '<option value="' + a.val + '"' + (currentAgg === a.val ? ' selected' : '') + '>' + a.label + '</option>'
            ).join('');
            return '<div class="adv-field-row adv-child-field-row' + (checked ? ' selected' : '') + '" style="padding-left:22px">'
              + '<input type="checkbox" ' + (checked ? 'checked' : '')
              + ' onclick="event.stopPropagation();_toggleLookupChild(\'' + nodeId + '\',\'' + parentField.alias + '\',\'' + cf.alias + '\',this.checked)"/>'
              + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
              + '<span class="field-name" style="font-size:11px">' + (parentField.userAlias || parentField.alias) + ' \u2192 ' + (cf.userAlias || cf.alias) + '</span>'
              + '<select class="form-input" style="height:22px;font-size:10px;padding:0 2px;min-width:0;width:auto"'
              + (checked ? '' : ' disabled')
              + ' onchange="_setLookupChildAgg(\'' + nodeId + '\',\'' + parentField.alias + '\',\'' + cf.alias + '\',this.value)"'
              + ' onclick="event.stopPropagation()">' + aggOptions + '</select>'
              + '</div>';
          }
          const sel = nd.selectedFields.includes(cf.alias);
          return '<div class="adv-field-row adv-child-field-row' + (sel ? ' selected' : '') + '" style="padding-left:22px"'
            + ' onclick="advNodeToggleField(\'' + nodeId + '\',\'' + cf.alias + '\')" draggable="true"'
            + ' ondragstart="event.stopPropagation();safeDragSet(event,{type:\'adv-field-pill\',nodeId:\'' + nodeId + '\',field:\'' + cf.alias + '\'})">'
            + '<input type="checkbox" ' + (sel ? 'checked' : '')
            + ' onclick="event.stopPropagation();" onchange="advNodeToggleField(\'' + nodeId + '\',\'' + cf.alias + '\')">'
            + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
            + '<span class="field-name" style="font-size:11px">' + (cf.userAlias || cf.alias) + '</span>'
            + '</div>';
        }).join('');
        return '<div class="adv-child-fields">' + rows + '</div>';
      }

      function rebuildAdvancedSQL() {
        if (DataLaVistaState.sqlLocked) return;
        const nodes = Object.entries(DataLaVistaState.advancedQB.nodes);
        if (!nodes.length) { if (window._cmEditor) window._cmEditor.setValue(''); updateRunQueryButton(); return; }

        const joins = DataLaVistaState.advancedQB.joins;
        const multiNode = nodes.length > 1;

        // ── Multiple tables (with or without joins) → disable Design/Preview/Generate ──
        if (multiNode) {
          setDesignTabsEnabled(false, 'Run the query first to use results in Design, Preview, and Generate');
        } else {
          setDesignTabsEnabled(true);
        }

        // Helper: resolve raw table key → DS-prefixed view name (used in FROM clause)
        const getView  = (tableName) => CyberdynePipeline.rawTableToView[tableName] || tableName;
        // Helper: resolve raw table key → short alias (used in column refs and AS alias)
        const getAlias = (tableName) => DataLaVistaState.tables[tableName]?.alias || getView(tableName);
        // Helper: resolve per-node SQL alias (nodeAliases takes precedence over table-level alias)
        const getNodeAlias = (nodeId, nd) =>
          DataLaVistaState.advancedQB.nodeAliases?.[nodeId] || getAlias(nd.tableName);
        // Helper: build FROM fragment — "AS alias" only when view name differs from alias
        const fromFrag = (nodeId, nd) => {
          const v = getView(nd.tableName), a = getNodeAlias(nodeId, nd);
          return a !== v ? `[${v}] AS [${a}]` : `[${v}]`;
        };

        const _primaryNodeId = DataLaVistaState.advancedQB.primaryNodeId || nodes[0]?.[0];
        const mainId = _primaryNodeId;
        const mainNd = DataLaVistaState.advancedQB.nodes[_primaryNodeId] || nodes[0][1];
        const mainView = getView(mainNd.tableName);

        // ── Determine primary node for rollup decisions ───────────────────────
        const primaryId = mainId;
        const primaryNd = primaryId && DataLaVistaState.advancedQB.nodes[primaryId];
        const primaryT  = primaryNd && DataLaVistaState.tables[primaryNd.tableName];
        // hasParentAgg: primary node has ≥1 aggregate on a non-lookup/non-array/non-object field
        const hasParentAgg = !!primaryNd && Object.entries(primaryNd.fieldAggs || {}).some(([fa, agg]) => {
          if (!agg) return false;
          const fld = primaryT?.fields?.find(x => x.alias === fa);
          return fld && !['lookup','object','array'].includes(fld.displayType);
        });

        // Helper: resolve user-friendly agg val to the base SQL op used for rollup matching
        const _resolveAggOp = agg => ({ EARLIEST:'MIN', FIRST_ALPHA:'MIN', LATEST:'MAX',
          LAST_ALPHA:'MAX', LIST:'GROUP_CONCAT', GROUP_CONCAT:'GROUP_CONCAT' }[agg] || agg);

        // Helper: rollup subquery + outer expressions for SP lookup child fields.
        // Returns { subExprs: string[], outerExpr: string }
        const _lookupRollup = (agg, field, alias, subAlias, fieldTable = '') => {
          const op = _resolveAggOp(agg);
          const f = fieldTable ? `[${fieldTable}].[${field}]` : `[${field}]`;
          const a = `[${alias}]`, sub = `[${subAlias}]`;
          switch (op) {
            case 'MIN': case 'MAX': case 'SUM':
              return { subExprs: [`${op}(${f}) AS ${a}`],
                outerExpr: `${op}(${sub}.${a}) AS ${a}` };
            case 'COUNT':
              return { subExprs: [`COUNT(${f}) AS ${a}`],
                outerExpr: `SUM(${sub}.${a}) AS ${a}` };
            case 'AVG': {
              const sA = `[${alias}_sum]`, cA = `[${alias}_cnt]`;
              return { subExprs: [`SUM(${f}) AS ${sA}`, `COUNT(${f}) AS ${cA}`],
                outerExpr: `SUM(${sub}.${sA}) / NULLIF(SUM(${sub}.${cA}), 0) AS ${a}` };
            }
            case 'STDEV': {
              const sA = `[${alias}_sum]`, sqA = `[${alias}_sq]`, cA = `[${alias}_cnt]`;
              return { subExprs: [`SUM(${f}) AS ${sA}`, `SUM(${f}*${f}) AS ${sqA}`, `COUNT(${f}) AS ${cA}`],
                outerExpr: `DLV_SQRT(SUM(${sub}.${sqA}) / NULLIF(SUM(${sub}.${cA}), 0) - DLV_POW2(SUM(${sub}.${sA}) / NULLIF(SUM(${sub}.${cA}), 0))) AS ${a}` };
            }
            case 'VAR': {
              const sA = `[${alias}_sum]`, sqA = `[${alias}_sq]`, cA = `[${alias}_cnt]`;
              return { subExprs: [`SUM(${f}) AS ${sA}`, `SUM(${f}*${f}) AS ${sqA}`, `COUNT(${f}) AS ${cA}`],
                outerExpr: `SUM(${sub}.${sqA}) / NULLIF(SUM(${sub}.${cA}), 0) - DLV_POW2(SUM(${sub}.${sA}) / NULLIF(SUM(${sub}.${cA}), 0)) AS ${a}` };
            }
            case 'CV': {
              const sA = `[${alias}_sum]`, sqA = `[${alias}_sq]`, cA = `[${alias}_cnt]`;
              return { subExprs: [`SUM(${f}) AS ${sA}`, `SUM(${f}*${f}) AS ${sqA}`, `COUNT(${f}) AS ${cA}`],
                outerExpr: `DLV_SQRT(SUM(${sub}.${sqA}) / NULLIF(SUM(${sub}.${cA}), 0) - DLV_POW2(SUM(${sub}.${sA}) / NULLIF(SUM(${sub}.${cA}), 0))) / NULLIF(SUM(${sub}.${sA}) / NULLIF(SUM(${sub}.${cA}), 0), 0) AS ${a}` };
            }
            case 'GROUP_CONCAT':
              return { subExprs: [`GROUP_CONCAT(${f} ORDER BY ${f} ASC SEPARATOR ';') AS ${a}`],
                outerExpr: `DLV_MERGE_LIST(${sub}.${a}) AS ${a}` };
            case 'COUNT_DISTINCT': {
              const lA = `[${alias}_list]`;
              return { subExprs: [`GROUP_CONCAT(${f} ORDER BY ${f} ASC SEPARATOR ';') AS ${lA}`],
                outerExpr: `DLV_MERGE_COUNT_DISTINCT(${sub}.${lA}) AS ${a}` };
            }
            case 'MEDIAN': {
              const lA = `[${alias}_list]`;
              return { subExprs: [`GROUP_CONCAT(${f} ORDER BY ${f} ASC SEPARATOR ';') AS ${lA}`],
                outerExpr: `DLV_MERGE_MEDIAN(${sub}.${lA}) AS ${a}` };
            }
            case 'MODE': {
              const lA = `[${alias}_list]`;
              return { subExprs: [`GROUP_CONCAT(${f} ORDER BY ${f} ASC SEPARATOR ';') AS ${lA}`],
                outerExpr: `DLV_MERGE_MODE(${sub}.${lA}) AS ${a}` };
            }
            default:
              return { subExprs: [`${op}(${f}) AS ${a}`],
                outerExpr: `${op}(${sub}.${a}) AS ${a}` };
          }
        };

        // Helper: rollup outer SELECT expr for local DLV_ARRAY_AGG child fields.
        const _arrayAggRollup = (agg, nodeAlias, parentAlias, field, alias) => {
          const op = _resolveAggOp(agg);
          const arr = `[${nodeAlias}].[${parentAlias}]`, a = `[${alias}]`;
          switch (op) {
            case 'MIN':    return `MIN(DLV_ARRAY_AGG(${arr}, '${field}', 'MIN')) AS ${a}`;
            case 'MAX':    return `MAX(DLV_ARRAY_AGG(${arr}, '${field}', 'MAX')) AS ${a}`;
            case 'SUM':    return `SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM')) AS ${a}`;
            case 'COUNT':  return `SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')) AS ${a}`;
            case 'AVG':    return `SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0) AS ${a}`;
            case 'STDEV':  return `DLV_SQRT(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM_SQ')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0) - DLV_POW2(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0))) AS ${a}`;
            case 'VAR':    return `SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM_SQ')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0) - DLV_POW2(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0)) AS ${a}`;
            case 'CV':     return `DLV_SQRT(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM_SQ')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0) - DLV_POW2(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0))) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'SUM')) / NULLIF(SUM(DLV_ARRAY_AGG(${arr}, '${field}', 'COUNT')), 0), 0) AS ${a}`;
            case 'GROUP_CONCAT': return `DLV_MERGE_LIST(DLV_ARRAY_AGG(${arr}, '${field}', 'GROUP_CONCAT')) AS ${a}`;
            case 'COUNT_DISTINCT': return `DLV_MERGE_COUNT_DISTINCT(DLV_ARRAY_AGG(${arr}, '${field}', 'GROUP_CONCAT')) AS ${a}`;
            case 'MEDIAN': return `DLV_MERGE_MEDIAN(DLV_ARRAY_AGG(${arr}, '${field}', 'GROUP_CONCAT')) AS ${a}`;
            case 'MODE':   return `DLV_MERGE_MODE(DLV_ARRAY_AGG(${arr}, '${field}', 'GROUP_CONCAT')) AS ${a}`;
            default:       return `${op}(DLV_ARRAY_AGG(${arr}, '${field}', '${op}')) AS ${a}`;
          }
        };

        // ── Collect SELECT fields, detect duplicate output aliases, apply per-field aggregates
        const allFields = [];
        for (const [id, nd] of nodes) {
          const fieldAggs = nd.fieldAggs || {};
          const vname = getNodeAlias(id, nd); // use per-node alias for column refs
          for (const fa of nd.selectedFields) {
            allFields.push({ vname, fa, agg: fieldAggs[fa] || '' });
          }
        }
        const seenAliases = {};
        const selects = allFields.length ? allFields.map(({ vname, fa, agg }) => {
          const count = seenAliases[fa] = (seenAliases[fa] || 0) + 1;
          const outAlias = count === 1 ? fa : fa + (count - 1);
          const col = `[${vname}].[${fa}]`;
          if (!agg) return count === 1 ? `  ${col}` : `  ${col} AS [${outAlias}]`;
          return '  ' + aggToSQL(agg, col, outAlias);
        }) : ['  *'];

        // ── Populate queryColumnMeta for sniffType + data dictionary ─────────
        DataLaVistaState.queryColumnMeta = {};
        const _seen2 = {};
        for (const [id, nd] of nodes) {
          const fieldAggs = nd.fieldAggs || {};
          const t = DataLaVistaState.tables[nd.tableName];
          for (const fa of nd.selectedFields) {
            const count = _seen2[fa] = (_seen2[fa] || 0) + 1;
            const outAlias = count === 1 ? fa : fa + (count - 1);
            const field = t?.fields?.find(f => f.alias === fa);
            const agg = fieldAggs[fa] || '';
            DataLaVistaState.queryColumnMeta[outAlias] = {
              displayType:             _aggOutputDisplayType(agg, field?.displayType || 'text'),
              agg,
              sourceAlias:             fa,
              sourceDisplayName:       field?.displayName || fa,
              sourceInternalName:      field?.internalName || fa,
              sourceTableKey:          nd.tableName,
              sourceTableName:         t?.displayName || nd.tableName,
              sourceDataSource:        t?.dataSource || '',
              viewName:                CyberdynePipeline.rawTableToView[nd.tableName] || nd.tableName,
              sourceFieldDescription:  field?.description || '',
              sourceTableDescription:  t?.description || '',
            };
          }
        }

        // ── Build child SELECT entries and subquery JOIN SQL for lookupAggFields.
        // SP multi-select lookup fields → pre-aggregated subquery JOIN (one row per source PK, no fanout).
        // Local array-of-object fields → DLV_ARRAY_AGG scalar in SELECT (no JOIN needed).
        // When hasParentAgg, use rollup-aware expressions to avoid aggregating pre-aggregated values.
        const childSelects = [];
        const lookupJoins  = [];
        for (const [nid, nd] of nodes) {
          if (!nd.lookupAggFields) continue;
          const nodeAlias = getNodeAlias(nid, nd);
          const t = DataLaVistaState.tables[nd.tableName];
          const localView = getView(nd.tableName);
          const localPK   = _resolveTablePK(t);

          for (const [parentAlias, childEntries] of Object.entries(nd.lookupAggFields)) {
            if (!childEntries || !childEntries.length) continue;
            const parentField = t?.fields?.find(f => f.alias === parentAlias);
            if (!parentField) continue;

            if (parentField.displayType === 'lookup' || parentField.displayType === 'lookup-multi') {
              const remoteView = _getRemoteViewForLookup(nd.tableName, parentAlias);
              if (!remoteView) continue;
              const subAlias = '_dlv_' + parentAlias;

              if (hasParentAgg) {
                // Rollup mode: subquery carries intermediate values; outer SELECT applies rollup ops
                const subExprsAll = [], outerExprs = [];
                for (const { field, agg, alias } of childEntries) {
                  const { subExprs, outerExpr } = _lookupRollup(agg, field, alias, subAlias, '_rem');
                  subExprsAll.push(...subExprs.map(e => `    ${e}`));
                  outerExprs.push(`  ${outerExpr}`);
                }
                childSelects.push(...outerExprs);
                lookupJoins.push(
                  `\nLEFT JOIN (\n  SELECT [_dlv].[_SourceID] AS [_SourceID],\n${subExprsAll.join(',\n')}\n` +
                  `  FROM DLV_LOOKUP("${localView}", "${parentAlias}Data") AS [_dlv]\n` +
                  `  LEFT JOIN [${remoteView}] AS [_rem] ON [_rem].[ID] = [_dlv].[_LookupId]\n` +
                  `  WHERE [_dlv].[_LookupId] IS NOT NULL\n` +
                  `  GROUP BY [_dlv].[_SourceID]\n) AS [${subAlias}] ON [${nodeAlias}].[${localPK}] = [${subAlias}].[_SourceID]`
                );
              } else {
                // Direct mode: subquery aggregates fully; outer SELECT just references the column
                for (const { alias } of childEntries) {
                  childSelects.push(`  [${subAlias}].[${alias}]`);
                }
                const selectExprs = childEntries.map(({ field, agg, alias }) =>
                  '    ' + aggToSQL(agg, `[_rem].[${field}]`, alias)
                ).join(',\n');
                lookupJoins.push(
                  `\nLEFT JOIN (\n  SELECT [_dlv].[_SourceID] AS [_SourceID],\n${selectExprs}\n` +
                  `  FROM DLV_LOOKUP("${localView}", "${parentAlias}Data") AS [_dlv]\n` +
                  `  LEFT JOIN [${remoteView}] AS [_rem] ON [_rem].[ID] = [_dlv].[_LookupId]\n` +
                  `  WHERE [_dlv].[_LookupId] IS NOT NULL\n` +
                  `  GROUP BY [_dlv].[_SourceID]\n) AS [${subAlias}] ON [${nodeAlias}].[${localPK}] = [${subAlias}].[_SourceID]`
                );
              }
            } else {
              // Local array of objects — DLV_ARRAY_AGG scalar (no JOIN)
              for (const { field, agg, alias } of childEntries) {
                if (hasParentAgg) {
                  childSelects.push(`  ${_arrayAggRollup(agg, nodeAlias, parentAlias, field, alias)}`);
                } else {
                  childSelects.push(`  DLV_ARRAY_AGG([${nodeAlias}].[${parentAlias}], '${field}', '${_resolveAggOp(agg)}') AS [${alias}]`);
                }
              }
            }
          }
        }
        const finalSelects = childSelects.length
          ? [...(allFields.length ? selects : []), ...childSelects]
          : selects;

        // Auto GROUP BY: if any field has an agg, non-agg fields need to be in GROUP BY
        const hasAnyAgg = allFields.some(f => f.agg);
        if (hasAnyAgg) {
          for (const [, nd] of nodes) {
            if (!nd.groupBy) nd.groupBy = [];
            const fieldAggs = nd.fieldAggs || {};
            // Purge fields that now have an aggregate (may have been added in a previous pass)
            nd.groupBy = nd.groupBy.filter(fa => !fieldAggs[fa]);
            // Add non-aggregated selected fields not already present
            for (const fa of nd.selectedFields) {
              if (!fieldAggs[fa] && !nd.groupBy.includes(fa)) nd.groupBy.push(fa);
            }
          }
        }

        const hasUnion = joins.some(j => j.type === 'UNION' || j.type === 'UNION ALL');

        if (hasUnion) {
          const parts = [];
          for (const [nid, nd] of nodes) {
            const nodeAlias = getNodeAlias(nid, nd); // per-node alias for column refs
            const fAggs = nd.fieldAggs || {};
            const nodeSelects = nd.selectedFields.length
              ? nd.selectedFields.map(fa => {
                  const agg = fAggs[fa] || '';
                  const col = `[${nodeAlias}].[${fa}]`;
                  if (!agg) return `  ${col}`;
                  return '  ' + aggToSQL(agg, col, fa);
                }).join(',\n')
              : '  *';
            let part = `SELECT\n${nodeSelects}\nFROM ${fromFrag(nid, nd)}`;
            const where = buildNodeWhere(nd, nd.tableName, nid);
            if (where) part += `\nWHERE ${where}`;
            parts.push({ sql: part });
          }
          let sql = '';
          for (let i = 0; i < parts.length; i++) {
            if (i === 0) { sql = parts[0].sql; continue; }
            const j = joins.find(j => j.toNode === Object.keys(DataLaVistaState.advancedQB.nodes)[i]);
            sql += `\n${j ? j.type : 'UNION'}\n` + parts[i].sql;
          }
          sql += `\nLIMIT ${DataLaVistaState.advancedQB.rowLimit || 500}`;
          DataLaVistaState.sql = sql; if (window._cmEditor) window._cmEditor.setValue(sql); return;
        }

        let sql = `SELECT\n${finalSelects.join(',\n')}\nFROM ${fromFrag(mainId, mainNd)}`;

        const joinedNodes = new Set([mainId]);
        for (const j of joins) {
          const fromNd = DataLaVistaState.advancedQB.nodes[j.fromNode];
          const toNd   = DataLaVistaState.advancedQB.nodes[j.toNode];
          if (!fromNd || !toNd) continue;

          // Always JOIN the node not yet in the query; keep ON condition aliases tied to fromNd/toNd
          const newIsTo   = !joinedNodes.has(j.toNode);
          const newNd     = newIsTo ? toNd   : fromNd;
          const newNodeId = newIsTo ? j.toNode : j.fromNode;
          joinedNodes.add(newNodeId);

          const fromAlias = getNodeAlias(j.fromNode, fromNd);
          const toAlias   = getNodeAlias(j.toNode, toNd);
          normalizeJoinKeys(j);
          if (j.type === 'CROSS') {
            sql += `\nCROSS JOIN ${fromFrag(newNodeId, newNd)}`;
          } else if (j.type === 'DLV_LOOKUP') {
            const kp = j.keys[0];
            // Identify which side holds the multi-select lookup array field (the child/source table).
            // Normally fromNd is child, but if the join was saved with inverted direction, detect and swap.
            let childNd = fromNd, parentNd = toNd, childNodeId = j.fromNode, parentNodeId = j.toNode;
            let childLookupKey = kp.fromKey, parentJoinKey = kp.toKey;
            const fromTable = DataLaVistaState.tables[fromNd.tableName];
            const fromFieldMeta = fromTable?.fields.find(f => f.alias === kp.fromKey);
            if (!fromFieldMeta) {
              // fromNd does not own the lookup field — join stored backwards; swap sides
              childNd = toNd; parentNd = fromNd;
              childNodeId = j.toNode; parentNodeId = j.fromNode;
              childLookupKey = kp.toKey; parentJoinKey = kp.fromKey;
            }
            const childTable = DataLaVistaState.tables[childNd.tableName];
            const localViewName = getView(childNd.tableName);
            const localPK = _resolveTablePK(childTable);
            const childFieldMeta = childTable?.fields.find(f => f.alias === childLookupKey);
            const lookupColName = (childFieldMeta?.displayType === 'lookup' || childFieldMeta?.displayType === 'lookup-multi')
              ? childLookupKey + 'Data'
              : childLookupKey;
            const childAlias  = getNodeAlias(childNodeId,  childNd);
            const parentAlias = getNodeAlias(parentNodeId, parentNd);
            // The DLV_LOOKUP virtual table gets the alias of the "new" node being joined into the query
            const dlvAlias = getNodeAlias(newNodeId, newNd);
            if (parentNodeId === mainId) {
              // REVERSE: primary table (e.g. People) is the FROM; source table (Events) owns the lookup column.
              // DLV_LOOKUP returns Events scalars + _LookupId → join ON _LookupId = People.ID
              sql += `\nLEFT JOIN DLV_LOOKUP("${localViewName}", "${lookupColName}") AS [${dlvAlias}]`
                   + ` ON [${dlvAlias}].[_LookupId] = [${parentAlias}].[${parentJoinKey}]`;
            } else {
              // FORWARD: source table (Events) is the FROM; DLV_LOOKUP joined ON _SourceID = Events.ID
              sql += `\nLEFT JOIN DLV_LOOKUP("${localViewName}", "${lookupColName}") AS [${dlvAlias}]`
                   + ` ON [${dlvAlias}].[_SourceID] = [${childAlias}].[${localPK}]`;
            }
          } else {
            const _keysConj = j.keysConj === 'OR' ? ' OR ' : ' AND ';
            const onClauses = j.keys.map(kp => `[${fromAlias}].[${kp.fromKey}] = [${toAlias}].[${kp.toKey}]`).join(_keysConj);
            sql += `\n${j.type} JOIN ${fromFrag(newNodeId, newNd)} ON ${onClauses}`;
          }
        }

        if (lookupJoins.length) sql += lookupJoins.join('');

        const allWhere = [];
        for (const [nid, nd] of nodes) {
          if (nd.conditions && nd.conditions.length) {
            const w = buildNodeWhere(nd, nd.tableName, nid);
            if (w) allWhere.push(`(${w})`);
          }
        }
        if (allWhere.length) sql += `\nWHERE ${allWhere.join(' AND ')}`;

        const allGB = [];
        for (const [nid, nd] of nodes) {
          if (nd.groupBy && nd.groupBy.length)
            nd.groupBy.forEach(g => allGB.push(`[${getNodeAlias(nid, nd)}].[${g}]`));
        }
        if (allGB.length) sql += `\nGROUP BY ${allGB.join(', ')}`;

        const allOrder = [];
        for (const [nid, nd] of nodes) {
          if (nd.sorts && nd.sorts.length)
            nd.sorts.forEach(s => allOrder.push(`[${getNodeAlias(nid, nd)}].[${s.field}] ${s.dir || 'ASC'}`));
        }
        if (allOrder.length) sql += `\nORDER BY ${allOrder.join(', ')}`;

        sql += `\nLIMIT ${DataLaVistaState.advancedQB.rowLimit || 500}`;
        DataLaVistaState.sql = sql; if (window._cmEditor) window._cmEditor.setValue(sql); hideUseInDesign(); updateRunQueryButton();
      }

      // buildNodeWhere: uses per-node SQL alias (or table alias fallback) for column refs
      function buildNodeWhere(nd, tableKey, nodeId) {
        if (!nd.conditions || !nd.conditions.length) return '';
        const vname = (nodeId && DataLaVistaState.advancedQB.nodeAliases?.[nodeId])
          || DataLaVistaState.tables[tableKey]?.alias
          || CyberdynePipeline.rawTableToView[tableKey]
          || tableKey;
        const prefix = vname ? `[${vname}].` : '';
        const t = DataLaVistaState.tables[tableKey];
        return nd.conditions.map((c, i) => {
          const conj = i === 0 ? '' : (c.conj + ' ');
          const col  = `${prefix}[${c.field}]`;
          const fieldMeta = t && t.fields && t.fields.find(f => f.alias === c.field);
          const dt = fieldMeta ? (fieldMeta.displayType || 'text') : 'text';
          return conj + condToSQL(c, col, dt);
        }).join(' ');
      }
      function clearQueryBuilder() {
        if(document.getElementById('qmt-sql').classList.contains('active')) {
          if (window._cmEditor) window._cmEditor.setValue('');
          DataLaVistaState.sql = '';
          hideUseInDesign();
        } else {
          DataLaVistaState.advancedQB = { nodes: {}, joins: [], activeJoinIdx: -1, nodeAliases: {}, rowLimit: 500, primaryNodeId: null };
          if (window._cmEditor) window._cmEditor.setValue('');
          DataLaVistaState.sql = '';
          renderAdvancedQB();
        }
      }