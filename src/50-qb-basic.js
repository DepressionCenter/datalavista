/* ============================================================
This file is part of DataLaVista
50-qb-basic.js: Basic query builder - field selection, filters, sorts, and SQL generation.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
Summary: Basic query builder - field selection, filters, sorts, and SQL generation.
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
      // QUERY BUILDER — BASIC MODE
      // ============================================================
      function setQBMode(mode) {
        DataLaVistaState.queryMode = mode;
        document.getElementById('qb-basic').style.display = mode === 'basic' ? 'flex' : 'none';
        document.getElementById('qb-advanced').style.display = mode === 'advanced' ? 'flex' : 'none';
        document.getElementById('qb-basic-btn').classList.toggle('active', mode === 'basic');
        document.getElementById('qb-adv-btn').classList.toggle('active', mode === 'advanced');
        if (mode === 'advanced') {
          _migrateBasicToAdvancedQB();
          renderAdvancedQB(); renderAdvOptionsPanel();
          rebuildAdvancedSQL();
        } else {
          // Leaving advanced mode — re-enable design tabs (join restriction only applies to AQB)
          setDesignTabsEnabled(true);
          rebuildBasicSQL();
        }
      }

      // Copy basic QB state into a new advanced QB node, but only when
      // advanced QB is empty and basic QB has a table selected.
      function _migrateBasicToAdvancedQB() {
        const bqb = DataLaVistaState.basicQB;
        if (!bqb.tableName) return;                                          // nothing to migrate
        const nodes = DataLaVistaState.advancedQB.nodes || {};
        if (Object.keys(nodes).length > 0) return;                          // adv QB already has content

        const t = DataLaVistaState.tables[bqb.tableName];
        const id = 'node_1';
        DataLaVistaState.advancedQB.nodes = {};
        DataLaVistaState.advancedQB.nodes[id] = {
          tableName:      bqb.tableName,
          x:              80,
          y:              60,
          selectedFields: bqb.selectedFields.length ? [...bqb.selectedFields] : [],
          alias:          (t && t.alias) || bqb.tableName,
          conditions:     (bqb.conditions || []).map(c => ({ ...c })),
          sorts:          (bqb.sorts     || []).map(s => ({ ...s })),
          groupBy:        [...(bqb.groupBy || [])],
          fieldAggs:      Object.assign({}, bqb.fieldAggs || {})
        };
        advNodeCounter = 1;
        DataLaVistaState.advancedQB.rowLimit = bqb.rowLimit || 500;
      }

      // ============================================================
      // SQL EDITOR DROP HANDLER
      // ============================================================
      function onDropToSQLEditor(event) {
        event.preventDefault();

        const data = safeDragParse(event);

        const cm = window._cmEditor;
        if (!cm) return; // Exist if no editor (shouldn't happen since drop target is editor wrapper, but just in case)
        const isQueryEmpty = (!cm || cm.getValue().trim().replace('-- Connect to a data source and drag a table into the query builder\n-- or write your SQL here directly\nSELECT \'DataLaVista\'','').length < 1);
       
        // Set cursor to drop position
        const pos = cm.coordsChar({ left: event.clientX, top: event.clientY });
        cm.setCursor(pos);

        // If it's not our custom drag data, just insert the plain text
        if (!data) {
            // Prefer plain text for a code editor, fall back to HTML stripped of tags
            let text = event.dataTransfer.getData('text/plain');
            if (!text) {
                const html = event.dataTransfer.getData('text/html');
                if (html) {
                    text = stripHtml(html);
                }
            }
            if (text) {
                cm.replaceSelection(text);
            }
        } else if (data.type === 'table') {
          const t = DataLaVistaState.tables[data.table];
          if (!t) return;
          if (isQueryEmpty) {
            // Switch to basic QB, load table, select default fields
            setQBMode('basic');
            addTableToBasicQB(data.table);

            // Auto-select all fields by default
            selectAllBasicFields();
            rebuildBasicSQL();
          } else {
            // Insert table name at cursor
            if (cm) cm.replaceSelection(`[${data.table}]`);
            ensureTableData(data.table);
          }
        } else if (data.type === 'field') {
          const t = DataLaVistaState.tables[data.table];
          if (!t) return;
          if (isQueryEmpty) {
            // Switch to basic QB, load table, select only this field
            setQBMode('basic');
            addTableToBasicQB(data.table);
            DataLaVistaState.basicQB.selectedFields = [data.field];
            // Sync checkboxes if already rendered
            document.querySelectorAll('#basic-fields-grid input[type=checkbox]').forEach(cb => {
              cb.checked = cb.id === 'bfchk-' + data.field;
            });
            rebuildBasicSQL();
          } else {
            // Insert field at cursor
            if (cm) cm.replaceSelection(`[${data.field}]`);
            ensureTableData(data.table);
          }
        } else {
          // Unknown custom data type — just ignore and don't insert anything
          return;
        }
      }

      function onDropToBasicQB(event) {
        event.preventDefault();
        document.getElementById('qb-basic-drop').classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        if (data.type === 'table') addTableToBasicQB(data.table);
        else if (data.type === 'field') { addTableToBasicQB(data.table); basicQBSelectField(data.table, data.field); }
      }

      function addTableToBasicQB(tableName) {
        const t = DataLaVistaState.tables[tableName];
        if (!t) return;

        // Always reset fully when a new table is dropped — even if same table
        DataLaVistaState.basicQB.tableName = tableName;
        DataLaVistaState.basicQB.selectedFields = [];
        DataLaVistaState.basicQB.fieldAggs = {};
        DataLaVistaState.basicQB.conditions = [];
        DataLaVistaState.basicQB.sorts = [];
        DataLaVistaState.basicQB.groupBy = [];
        DataLaVistaState.basicQB.rowLimit = 500;

        // Auto-select all fields by default
        selectAllBasicFields();
        renderBasicQB();
        ensureTableData(tableName);
      }

      function basicQBSelectField(tableName, fieldAlias) {
        if (DataLaVistaState.basicQB.tableName !== tableName) return;
        if (!DataLaVistaState.basicQB.selectedFields.includes(fieldAlias)) {
          DataLaVistaState.basicQB.selectedFields.push(fieldAlias);
          renderBasicQB();
        }
      }

      // ── Date macro helpers ────────────────────────────────────────────────────────
      function dateMacroToSQL(op, value, colExpr) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const fmt = d => `'${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}'`;

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = fmt(today);

        function fiscalStart(yr) { return new Date(yr, 6, 1); }   // July 1
        function academicStart(yr) { return new Date(yr, 7, 1); } // Aug 1

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
            // Fiscal year: July 1 – June 30
            const fy = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
            const s = fmt(fiscalStart(fy));
            const e = fmt(new Date(fy + 1, 5, 30));
            return `${colExpr} >= ${s} AND ${colExpr} <= ${e}`;
          }
          case 'LAST_FISCAL': {
            const fy = (today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1) - 1;
            const s = fmt(fiscalStart(fy));
            const e = fmt(new Date(fy + 1, 5, 30));
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
            const fy = (today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1) - x + 1;
            const s = fmt(fiscalStart(fy));
            const currFyEnd = (() => { const fy2 = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1; return fmt(new Date(fy2 + 1, 5, 30)); })();
            return `${colExpr} >= ${s} AND ${colExpr} <= ${currFyEnd}`;
          }
          default: return null;
        }
      }

      // Which aggregates are visible for a given field displayType
      function aggsForType(displayType) {
        const isNumeric = displayType === 'number';
        const isDate = displayType === 'date';
        // text, lookup, bool, array → only 'all' tier
        // date → 'all' + 'ordered'
        // number → all tiers
        return DataLaVistaCore.QB_AGGS.filter(a => {
          if (a.types === 'all') return true;
          if (a.types === 'ordered') return isNumeric || isDate;
          if (a.types === 'numeric') return isNumeric;
          return false;
        });
      }

      // ── QB: build SQL from state ──────────────────────────────────────────────
      // Rule: FROM uses the view name (user-facing alias) that wraps the raw table.
      //       Column refs use [viewName].[fieldAlias] — views map aliases to internal names.
      //       This lets users rename fields/tables without breaking existing queries.
      function buildBasicSQL(formatted = false) {
        const tkey = DataLaVistaState.basicQB.tableName;
        const t = tkey ? DataLaVistaState.tables[tkey] : null;
        if (!t) return '';

        // Use the view name (DS-prefixed) for the FROM clause; use the short table alias for column refs.
        // E.g.: FROM [Depres_Consultations] AS [Consultations]  →  [Consultations].[field]
        const vname = CyberdynePipeline.rawTableToView[tkey] || tkey;
        const alias = t.alias || vname;
        const fromClause = alias !== vname ? `[${vname}] AS [${alias}]` : `[${vname}]`;

        const selectedAliases = [...new Set(DataLaVistaState.basicQB.selectedFields)];
        const aggs   = DataLaVistaState.basicQB.fieldAggs || {};
        const conds  = DataLaVistaState.basicQB.conditions.filter(c => c.field);
        const sorts  = DataLaVistaState.basicQB.sorts.filter(s => s.field);
        const limit  = DataLaVistaState.basicQB.rowLimit || 500;
        const anyAgg = selectedAliases.some(a => aggs[a]);

        // SELECT [alias].[fieldAlias]  — view columns are already named by alias
        const selCols = selectedAliases.length ? selectedAliases.map(fa => {
          const agg = aggs[fa];
          const col = `[${alias}].[${fa}]`;
          if (!agg) return col;
          if (agg === 'COUNT_DISTINCT') return `COUNT(DISTINCT ${col}) AS [CountDistinct_${fa}]`;
          return `${agg}(${col}) AS [${agg}_${fa}]`;
        }) : [`[${alias}].*`];

        const autoGroups   = anyAgg
          ? selectedAliases.filter(a => !aggs[a]).map(a => `[${alias}].[${a}]`)
          : [];
        const manualGroups = !anyAgg
          ? (DataLaVistaState.basicQB.groupBy || []).filter(g => g).map(g => `[${alias}].[${g}]`)
          : [];
        const groupParts = anyAgg ? autoGroups : manualGroups;

        const whereParts = conds.map((c, i) => {
          const conj = i === 0 ? '' : (c.conj || 'AND') + ' ';
          const col  = `[${alias}].[${c.field}]`;
          const fieldMeta = t.fields.find(f => f.alias === c.field);
          const dt = fieldMeta ? (fieldMeta.displayType || 'text') : 'text';
          return conj + condToSQL(c, col, dt);
        });

        const orderParts = sorts.map(s => `[${alias}].[${s.field}] ${s.dir || 'ASC'}`);

        if (!formatted) {
          let sql = `SELECT ${selCols.join(', ')} FROM ${fromClause}`;
          if (whereParts.length) sql += ` WHERE ${whereParts.join(' ')}`;
          if (groupParts.length) sql += ` GROUP BY ${groupParts.join(', ')}`;
          if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;
          sql += ` LIMIT ${limit}`;
          return sql;
        } else {
          let sql = `SELECT\n  ${selCols.join(',\n  ')}\nFROM ${fromClause}`;
          if (whereParts.length) sql += `\nWHERE\n  ${whereParts.join('\n  ')}`;
          if (groupParts.length) sql += `\nGROUP BY\n  ${groupParts.join(',\n  ')}`;
          if (orderParts.length) sql += `\nORDER BY\n  ${orderParts.join(',\n  ')}`;
          sql += `\nLIMIT ${limit}`;
          return sql;
        }
      }

      // ── QB: render the full basic QB UI ──────────────────────────────────────────
      function renderBasicQB() {
        const tname = DataLaVistaState.basicQB.tableName;
        const t = tname ? DataLaVistaState.tables[tname] : null;
        const content = document.getElementById('qb-basic-content');
        const dropZone = document.getElementById('qb-basic-drop');

        if (!t) {
          content.innerHTML = '';
          dropZone.style.display = 'flex';
          return;
        }
        dropZone.style.display = 'none';

        const rows = t.fields.filter(f => !f.isAutoId);

        content.innerHTML = `
    <div class="basic-table-card">
      <!-- Card header -->
      <div class="basic-table-card-header">
        <span style="font-weight:700;font-size:13px">${t.alias || t.displayName}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:11px;color:var(--text-disabled)">${t.displayName}</span>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="clearBasicQB()" title="Remove table">✕</button>
        </div>
      </div>

      <!-- 1. COLUMNS -->
      <div class="qb-section">
        <div class="qb-section-header">
          <span>COLUMNS</span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="selectAllBasicFields()">All</button>
            <button class="btn btn-ghost btn-sm" onclick="clearBasicFields()">None</button>
          </div>
        </div>
        <div class="basic-fields-grid" id="basic-fields-grid"></div>
      </div>

      <!-- 2. FILTER CONDITIONS -->
      <div class="qb-section">
        <div class="qb-section-header">
          <span>FILTER CONDITIONS</span>
          <button class="btn btn-ghost btn-sm" onclick="addBasicCondition()">+ Add</button>
        </div>
        <div id="basic-conditions-area"></div>
      </div>

      <!-- 3. SORT ORDER -->
      <div class="qb-section">
        <div class="qb-section-header">
          <span>SORT ORDER</span>
          <button class="btn btn-ghost btn-sm" onclick="addBasicSort()">+ Add</button>
        </div>
        <div id="basic-sorts-area"></div>
      </div>

      <!-- 4. GROUP BY -->
      <div class="qb-section">
        <div class="qb-section-header">
          <span id="groupby-section-label">GROUP BY</span>
          <button class="btn btn-ghost btn-sm" id="groupby-add-btn" onclick="addBasicGroupBy()">+ Add</button>
        </div>
        <div id="basic-groupby-area"></div>
      </div>

      <!-- 5. ROW LIMIT -->
      <div class="qb-section">
        <div class="qb-section-header"><span>ROW LIMIT</span></div>
        <div style="padding:4px 0">
          <input type="number" class="form-input" style="height:28px;font-size:12px;width:120px"
            min="1" max="50000" value="${DataLaVistaState.basicQB.rowLimit || 500}"
            onchange="DataLaVistaState.basicQB.rowLimit = Math.min(50000, Math.max(1, +this.value||500)); rebuildBasicSQL()"/>
        </div>
      </div>
    </div>
  `;

        // Render field checkboxes with aggregate dropdown; group synthetic children under parent
        const grid = document.getElementById('basic-fields-grid');
        const aggs = DataLaVistaState.basicQB.fieldAggs || {};
        const baseRows = rows.filter(f => !f.isSynthetic);
        const synByParent = {};
        for (const f of rows) {
          if (f.isSynthetic && f.parentField) {
            if (!synByParent[f.parentField]) synByParent[f.parentField] = [];
            synByParent[f.parentField].push(f);
          }
        }

        const makeFieldRow = (f, extraClass) => {
          const checked = DataLaVistaState.basicQB.selectedFields.includes(f.alias);
          const currentAgg = aggs[f.alias] || '';
          const ti = DataLaVistaCore.FIELD_TYPE_ICONS[f.displayType] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const availableAggs = aggsForType(f.displayType);
          const aggOpts = availableAggs.map(a => `<option value="${a.val}" ${a.val === currentAgg ? 'selected' : ''}>${a.label}</option>`).join('');
          const div = document.createElement('div');
          div.className = 'basic-field-row' + (checked ? '' : ' field-row-unchecked') + (extraClass ? ' ' + extraClass : '');
          div.innerHTML = `
      <input type="checkbox" id="bfchk-${f.alias}" ${checked ? 'checked' : ''}
        onchange="toggleBasicField('${f.alias}', this.checked)"/>
      <span class="field-type-icon ${ti.cls}" style="font-size:10px">${ti.icon}</span>
      <label for="bfchk-${f.alias}" title="${f.displayName}" style="flex:1">${f.alias}</label>
      ${checked ? '<select class="form-input field-agg-select" title="Aggregate function" onchange="setFieldAgg(\'' + f.alias + '\', this.value)">' + aggOpts + '</select>' : ''}
    `;
          return div;
        };

        for (const f of baseRows) {
          grid.appendChild(makeFieldRow(f, ''));
          const children = synByParent[f.alias] || [];
          if (children.length) {
            const group = document.createElement('div');
            group.className = 'basic-field-synthetic-group';
            for (const sf of children) group.appendChild(makeFieldRow(sf, 'basic-field-synthetic'));
            grid.appendChild(group);
          }
        }

        renderBasicConditions();
        renderBasicSorts();
        syncGroupBySection();
        rebuildBasicSQL();
      }

      function toggleBasicField(alias, checked) {
        if (checked) {
          if (!DataLaVistaState.basicQB.selectedFields.includes(alias)) DataLaVistaState.basicQB.selectedFields.push(alias);
        } else {
          DataLaVistaState.basicQB.selectedFields = DataLaVistaState.basicQB.selectedFields.filter(f => f !== alias);
          if (DataLaVistaState.basicQB.fieldAggs) delete DataLaVistaState.basicQB.fieldAggs[alias];
        }
        // Re-render to show/hide agg dropdown and update GROUP BY section
        renderBasicQB();
      }

      function setFieldAgg(alias, agg) {
        if (!DataLaVistaState.basicQB.fieldAggs) DataLaVistaState.basicQB.fieldAggs = {};
        if (agg) DataLaVistaState.basicQB.fieldAggs[alias] = agg;
        else delete DataLaVistaState.basicQB.fieldAggs[alias];
        syncGroupBySection();
        rebuildBasicSQL();
      }

      // Show/hide the manual GROUP BY section & its add button based on whether aggs are active
      function syncGroupBySection() {
        const anyAgg = DataLaVistaState.basicQB.selectedFields.some(f => (DataLaVistaState.basicQB.fieldAggs || {})[f]);
        const label = document.getElementById('groupby-section-label');
        const addBtn = document.getElementById('groupby-add-btn');
        if (label) label.textContent = anyAgg ? 'GROUP BY (auto)' : 'GROUP BY';
        if (addBtn) addBtn.style.display = anyAgg ? 'none' : '';
        if (anyAgg) {
          // Clear manual group-by entries and show auto message
          const area = document.getElementById('basic-groupby-area');
          if (area) {
            const nonAggFields = DataLaVistaState.basicQB.selectedFields.filter(f => !(DataLaVistaState.basicQB.fieldAggs || {})[f]);
            area.innerHTML = nonAggFields.length
              ? `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${nonAggFields.join(', ')}</div>`
              : `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All fields aggregated — no GROUP BY needed</div>`;
          }
        } else {
          renderBasicGroupBy();
        }
      }

      function selectAllBasicFields() {
        const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
        if (!t) return;
        DataLaVistaState.basicQB.selectedFields = t.fields.filter(f => !f.isAutoId).map(f => f.alias);
        renderBasicQB();
      }
      function clearBasicFields() { DataLaVistaState.basicQB.selectedFields = []; renderBasicQB(); }
      function clearBasicQB() {
        DataLaVistaState.basicQB = { tableName: null, selectedFields: [], fieldAggs: {}, conditions: [], sorts: [], groupBy: [], rowLimit: 500 };
        renderBasicQB();
        document.getElementById('qb-basic-drop').style.display = 'flex';
      }

      function addBasicCondition() {
        const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
        if (!t) return;
        const fields = t.fields.filter(f => !f.isAutoId);
        const firstField = fields[0];
        const defaultValue = firstField?.displayType === 'boolean' ? 'true' : '';
        DataLaVistaState.basicQB.conditions.push({ conj: 'AND', field: firstField?.alias || '', op: '=', value: defaultValue });
        renderBasicConditions();
      }

      function removeBasicCondition(i) {
        DataLaVistaState.basicQB.conditions.splice(i, 1);
        renderBasicConditions();
        rebuildBasicSQL();
      }

      function renderBasicConditions() {
        const area = document.getElementById('basic-conditions-area');
        if (!area) return;
        const tname = DataLaVistaState.basicQB.tableName;
        const t = DataLaVistaState.tables[tname];
        if (!t) return;
        const fields = t.fields.filter(f => !f.isAutoId);
        const cols = fields.map(f => ({
          alias: f.alias,
          displayType: f.displayType,
          tableKey: tname,
          fieldInternalName: f.internalName,
        }));
        area.innerHTML = renderConditionRows(
          DataLaVistaState.basicQB.conditions, cols,
          (ci, v) => `DataLaVistaState.basicQB.conditions[${ci}].conj=${v}; rebuildBasicSQL()`,
          (ci, v) => `DataLaVistaState.basicQB.conditions[${ci}].field=${v}; DataLaVistaState.basicQB.conditions[${ci}].value=(sniffType(${v})==='boolean'?'true':''); DataLaVistaState.basicQB.conditions[${ci}].value2=''; DataLaVistaState.basicQB.conditions[${ci}].elementKey=''; renderBasicConditions(); rebuildBasicSQL()`,
          (ci, v) => `DataLaVistaState.basicQB.conditions[${ci}].op=${v}; renderBasicConditions(); rebuildBasicSQL()`,
          (ci, v) => `DataLaVistaState.basicQB.conditions[${ci}].value=${v}; rebuildBasicSQL()`,
          (ci)    => `removeBasicCondition(${ci})`,
          null,   // rowAttrs
          (ci, v) => `DataLaVistaState.basicQB.conditions[${ci}].value2=${v}; rebuildBasicSQL()`,
          (ci, v) => `DataLaVistaState.basicQB.conditions[${ci}].elementKey=${v}; renderBasicConditions(); rebuildBasicSQL()`
        );
      }

      // ── Sorts ─────────────────────────────────────────────────────────────────────
      function addBasicSort() {
        const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
        if (!t) return;
        const fields = t.fields.filter(f => !f.isAutoId);
        DataLaVistaState.basicQB.sorts.push({ field: fields[0]?.alias || '', dir: 'ASC' });
        renderBasicSorts();
      }

      function removeBasicSort(i) {
        DataLaVistaState.basicQB.sorts.splice(i, 1);
        renderBasicSorts();
        rebuildBasicSQL();
      }

      function renderBasicSorts() {
        const area = document.getElementById('basic-sorts-area');
        if (!area) return;
        const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
        if (!t) return;
        const fields = t.fields.filter(f => !f.isAutoId);
        const cols = fields.map(f => f.alias);
        area.innerHTML = renderSortRows(
          DataLaVistaState.basicQB.sorts, cols,
          (si, v) => `DataLaVistaState.basicQB.sorts[${si}].field=${v}; rebuildBasicSQL()`,
          (si, v) => `DataLaVistaState.basicQB.sorts[${si}].dir=${v}; rebuildBasicSQL()`,
          (si)    => `removeBasicSort(${si})`
        );
      }

      // ── Rebuild SQL and push to editor ────────────────────────────────────────────
      function rebuildBasicSQL() {
        if (DataLaVistaState.sqlLocked) return;
        if (DataLaVistaState.queryMode !== 'basic') return;
        const compact = buildBasicSQL(false);
        const formatted = buildBasicSQL(true);
        DataLaVistaState.sql = compact;
        if (window._cmEditor && formatted) window._cmEditor.setValue(formatted);
        hideUseInDesign();
        updateRunQueryButton();
      }

      // ── Group By ─────────────────────────────────────────────────────────────────
      function addBasicGroupBy() {
        const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
        if (!t) return;
        const fields = t.fields.filter(f => !f.isAutoId);
        if (!DataLaVistaState.basicQB.groupBy) DataLaVistaState.basicQB.groupBy = [];
        DataLaVistaState.basicQB.groupBy.push(fields[0]?.alias || '');
        renderBasicGroupBy();
        rebuildBasicSQL();
      }

      function removeBasicGroupBy(i) {
        DataLaVistaState.basicQB.groupBy.splice(i, 1);
        renderBasicGroupBy();
        rebuildBasicSQL();
      }

      function renderBasicGroupBy() {
        const area = document.getElementById('basic-groupby-area');
        if (!area) return;
        const t = DataLaVistaState.tables[DataLaVistaState.basicQB.tableName];
        if (!t) return;
        const fields = t.fields.filter(f => !f.isAutoId);
        const groups = DataLaVistaState.basicQB.groupBy || [];

        area.innerHTML = '';
        if (!groups.length) {
          area.innerHTML = '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No grouping — click + Add</div>';
          return;
        }
        groups.forEach((g, i) => {
          const row = document.createElement('div');
          row.className = 'qb-sort-row';
          row.innerHTML = `
      <select class="form-input qb-field-select" onchange="DataLaVistaState.basicQB.groupBy[${i}]=this.value; rebuildBasicSQL()">
        ${fields.map(f => `<option value="${f.alias}" ${f.alias === g ? 'selected' : ''}>${f.alias}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeBasicGroupBy(${i})">✕</button>
    `;
          area.appendChild(row);
        });
      }

      // Legacy aliases kept so any other code that calls these still works
      function addBasicFilter() { addBasicCondition(); }
      function removeBasicFilter(i) { removeBasicCondition(i); }
      function renderBasicFilters() { renderBasicConditions(); }
      function selectBasicField(tname, alias) { basicQBSelectField(tname, alias); }