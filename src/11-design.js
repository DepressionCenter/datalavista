/* ============================================================
This file is part of DataLaVista
11-design.js: Design canvas, widget rendering, data transforms, and widget properties.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
Summary: Design canvas, widget rendering, data transforms, and widget properties.
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
  // DESIGN FIELDS PANEL  (fields with agg dropdowns + filter/sort/group sections)
  // ============================================================
  function renderDesignFieldsPanel() {
    const body = document.getElementById('design-fields-body');
    if (!DataLaVistaState.queryColumns.length) {
      body.innerHTML = '<div class="text-muted text-sm" style="padding:12px 10px">Run a query first</div>';
      return;
    }

    // Ensure design transform arrays exist
    if (!DataLaVistaState.design.conditions) DataLaVistaState.design.conditions = [];
    if (!DataLaVistaState.design.sorts)      DataLaVistaState.design.sorts = [];
    if (!DataLaVistaState.design.groupBy)    DataLaVistaState.design.groupBy = [];
    if (!DataLaVistaState.design.fieldAggs)  DataLaVistaState.design.fieldAggs = {};

    const cols = DataLaVistaState.queryColumns;
    const fieldAggs = DataLaVistaState.design.fieldAggs;

    body.innerHTML = '';

    // ── 1. FIELDS section ──────────────────────────────────────────────────
    const secFields = document.createElement('div');
    secFields.className = 'qb-section';
    secFields.style.borderTop = 'none';
    secFields.innerHTML = `<div class="qb-section-header"><span>FIELDS</span><span style="font-size:10px;font-weight:400">drag → canvas</span></div>`;

    for (const col of cols) {
      const dt = sniffType(col);
      const ti = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
      const availAggs = aggsForType(dt);
      const curAgg = fieldAggs[col] || '';
      const aggOpts = availAggs.map(a =>
        `<option value="${a.val}" ${a.val === curAgg ? 'selected' : ''}>${a.label}</option>`
      ).join('');

      const row = document.createElement('div');
      row.className = 'design-field-row';
      row.draggable = true;
      row.innerHTML = `
        <span class="field-type-icon ${ti.cls}" style="font-size:10px">${ti.icon}</span>
        <span class="field-label" title="${col}">${col}</span>
        <select class="form-input design-agg-select${curAgg ? ' agg-active' : ''}"
          title="Aggregate function"
          onchange="setDesignFieldAgg('${col.replace(/'/g,"\\'")}', this.value)">${aggOpts}</select>
      `;
      row.addEventListener('dragstart', e => {
        safeDragSet(e, { type: 'result-field', field: col, dataType: dt });
      });
      secFields.appendChild(row);
    }
    body.appendChild(secFields);

    // ── 2. FILTER CONDITIONS section ───────────────────────────────────────
    const secFilters = document.createElement('div');
    secFilters.className = 'qb-section';
    secFilters.innerHTML = `
      <div class="qb-section-header">
        <span>FILTER CONDITIONS</span>
        <button class="btn btn-ghost btn-sm" onclick="addDesignCondition()">+ Add</button>
      </div>
      <div id="design-conditions-area"></div>`;
    body.appendChild(secFilters);

    // ── 3. SORT ORDER section ──────────────────────────────────────────────
    const secSorts = document.createElement('div');
    secSorts.className = 'qb-section';
    secSorts.innerHTML = `
      <div class="qb-section-header">
        <span>SORT ORDER</span>
        <button class="btn btn-ghost btn-sm" onclick="addDesignSort()">+ Add</button>
      </div>
      <div id="design-sorts-area"></div>`;
    body.appendChild(secSorts);

    // ── 4. GROUP BY section ────────────────────────────────────────────────
    const secGroup = document.createElement('div');
    secGroup.className = 'qb-section';
    secGroup.innerHTML = `
      <div class="qb-section-header">
        <span id="design-groupby-label">GROUP BY</span>
        <button class="btn btn-ghost btn-sm" id="design-groupby-add-btn" onclick="addDesignGroupBy()">+ Add</button>
      </div>
      <div id="design-groupby-area"></div>`;
    body.appendChild(secGroup);

    // Render the sub-sections
    renderDesignConditions();
    renderDesignSorts();
    syncDesignGroupBySection();
  }

  // ============================================================
  // DESIGN DATA TRANSFORMS (filter / sort / group / aggregate)
  // Uses the same QB_OPS, DATE_MACRO_OPS, QB_AGGS, and aggsForType()
  // as the Query Builder so the UI is identical.
  // ============================================================

  /** Returns design-transformed data if transforms are active, otherwise raw query results. */
  function getDesignData() {
    return DataLaVistaState.design.transformedResults || DataLaVistaState.queryResults || [];
  }

  /** Re-runs the design-level AlaSQL transform on DataLaVistaState.queryResults and
   *  stores the result in DataLaVistaState.design.transformedResults, then re-renders widgets. */
  function applyDesignTransforms() {
    if (!DataLaVistaState.queryResults || !DataLaVistaState.queryResults.length) {
      DataLaVistaState.design.transformedResults = null;
      renderDesignCanvas();
      return;
    }

    const cols = DataLaVistaState.queryColumns;
    if (!cols.length) { DataLaVistaState.design.transformedResults = null; renderDesignCanvas(); return; }

    const conditions = (DataLaVistaState.design.conditions || []).filter(c => c.field);
    const sorts      = (DataLaVistaState.design.sorts      || []).filter(s => s.field);
    const groups     = DataLaVistaState.design.groupBy || [];
    const fieldAggs  = DataLaVistaState.design.fieldAggs || {};
    const anyAgg     = cols.some(c => fieldAggs[c]);

    // No transforms at all → clear cache and use raw data
    if (!conditions.length && !sorts.length && !groups.length && !anyAgg) {
      DataLaVistaState.design.transformedResults = null;
      renderDesignCanvas();
      renderDesignFieldsPanel();
      return;
    }

    // SELECT parts — preserve original column name with AS so widgets keep working
    const selParts = cols.map(col => {
      const agg = fieldAggs[col];
      if (!agg) return `[${col}]`;
      if (agg === 'COUNT_DISTINCT') return `COUNT(DISTINCT [${col}]) AS [${col}]`;
      return `${agg}([${col}]) AS [${col}]`;
    });

    // WHERE parts — identical logic to buildBasicSQL / renderNodeConditions
    const whereParts = conditions.map((c, i) => {
      const conj = i === 0 ? '' : (c.conj || 'AND') + ' ';
      const col  = `[${c.field}]`;
      if (c.op === 'NULL')    return conj + `${col} IS NULL`;
      if (c.op === 'NOTNULL') return conj + `${col} IS NOT NULL`;
      if (DataLaVistaCore.DATE_MACRO_VALS.has(c.op)) {
        const expr = dateMacroToSQL(c.op, c.value, col);
        return expr ? conj + expr : conj + `${col} IS NOT NULL`;
      }
      const raw = c.value || '';
      const val = c.op === 'LIKE'
        ? `'%${raw}%'`
        : (raw !== '' && !isNaN(raw) ? raw : `'${raw.replace(/'/g, "''")}'`);
      return conj + `${col} ${c.op} ${val}`;
    });

    // GROUP BY parts
    let groupParts;
    if (anyAgg) {
      groupParts = cols.filter(c => !fieldAggs[c]).map(c => `[${c}]`);
    } else {
      groupParts = groups.filter(g => g).map(g => `[${g}]`);
    }

    const orderParts = sorts.map(s => `[${s.field}] ${s.dir || 'ASC'}`);

    let sql = `SELECT ${selParts.join(', ')} FROM ?`;
    if (whereParts.length) sql += ` WHERE ${whereParts.join(' ')}`;
    if (groupParts.length) sql += ` GROUP BY ${groupParts.join(', ')}`;
    if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;

    try {
      const results = alasql(sql, [DataLaVistaState.queryResults]);
      DataLaVistaState.design.transformedResults = Array.isArray(results) ? results : null;
      const rowCount = DataLaVistaState.design.transformedResults ? DataLaVistaState.design.transformedResults.length : 0;
      toast(`Design transform applied — ${rowCount} rows`, 'success');
    } catch (e) {
      console.error('Design transform error:', e);
      DataLaVistaState.design.transformedResults = null;
      toast('Design transform error: ' + e.message, 'error');
    }

    renderDesignCanvas();
    renderDesignFieldsPanel();
  }

  // ── Design aggregate dropdown ─────────────────────────────────────────────
  function setDesignFieldAgg(col, agg) {
    if (!DataLaVistaState.design.fieldAggs) DataLaVistaState.design.fieldAggs = {};
    if (agg) DataLaVistaState.design.fieldAggs[col] = agg;
    else delete DataLaVistaState.design.fieldAggs[col];
    syncDesignGroupBySection();
    // Update the select's active styling inline without full re-render
    const sel = document.querySelector(`.design-agg-select`);
    // Re-render fields panel to update agg-active class
    renderDesignFieldsPanel();
  }

  // ── Design conditions ─────────────────────────────────────────────────────
  function addDesignCondition() {
    if (!DataLaVistaState.queryColumns.length) return;
    if (!DataLaVistaState.design.conditions) DataLaVistaState.design.conditions = [];
    DataLaVistaState.design.conditions.push({ conj: 'AND', field: DataLaVistaState.queryColumns[0], op: '=', value: '' });
    renderDesignConditions();
  }

  function removeDesignCondition(i) {
    DataLaVistaState.design.conditions.splice(i, 1);
    renderDesignConditions();
  }

  function renderDesignConditions() {
    const area = document.getElementById('design-conditions-area');
    if (!area) return;
    const cols = DataLaVistaState.queryColumns;
    const conds = DataLaVistaState.design.conditions || [];

    area.innerHTML = '';
    if (!conds.length) {
      area.innerHTML = '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No filters — click + Add</div>';
      return;
    }

    const fieldOpts = cols.map(c => `<option value="${c}">${c}</option>`).join('');

    conds.forEach((c, i) => {
      const dt = sniffType(c.field);
      const isDate = dt === 'date';
      const ops = isDate ? [...QB_OPS, ...DataLaVistaCore.DATE_MACRO_OPS] : QB_OPS;
      const isMacro = DataLaVistaCore.DATE_MACRO_VALS.has(c.op);
      const macroMeta = DataLaVistaCore.DATE_MACRO_OPS.find(o => o.val === c.op);
      const needsValue = c.op !== 'NULL' && c.op !== 'NOTNULL' && !(isMacro && !macroMeta?.hasInput);
      const valPlaceholder = isMacro && macroMeta?.hasInput ? 'e.g. 3' : 'value';

      const row = document.createElement('div');
      row.className = 'qb-condition-row';
      row.innerHTML = `
        ${i === 0
          ? `<span class="qb-where-badge">WHERE</span>`
          : `<select class="form-input qb-conj-select" onchange="DataLaVistaState.design.conditions[${i}].conj=this.value">
               <option ${c.conj==='AND'?'selected':''}>AND</option>
               <option ${c.conj==='OR'?'selected':''}>OR</option>
             </select>`}
        <select class="form-input qb-field-select"
          onchange="DataLaVistaState.design.conditions[${i}].field=this.value; renderDesignConditions()">
          ${cols.map(f=>`<option value="${f}" ${f===c.field?'selected':''}>${f}</option>`).join('')}
        </select>
        <select class="form-input qb-op-select" style="width:${isDate?'150px':'112px'}!important"
          onchange="DataLaVistaState.design.conditions[${i}].op=this.value; renderDesignConditions()">
          ${ops.map(o=>`<option value="${o.val}" ${o.val===c.op?'selected':''}>${o.label}</option>`).join('')}
        </select>
        ${needsValue
          ? `<input type="${isMacro?'number':'text'}" class="form-input qb-val-input"
               placeholder="${valPlaceholder}" min="1"
               value="${(c.value||'').replace(/"/g,'&quot;')}"
               oninput="DataLaVistaState.design.conditions[${i}].value=this.value"/>`
          : `<span class="qb-val-blank"></span>`}
        <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeDesignCondition(${i})">✕</button>
      `;
      area.appendChild(row);
    });
  }

  // ── Design sorts ──────────────────────────────────────────────────────────
  function addDesignSort() {
    if (!DataLaVistaState.queryColumns.length) return;
    if (!DataLaVistaState.design.sorts) DataLaVistaState.design.sorts = [];
    DataLaVistaState.design.sorts.push({ field: DataLaVistaState.queryColumns[0], dir: 'ASC' });
    renderDesignSorts();
  }

  function removeDesignSort(i) {
    DataLaVistaState.design.sorts.splice(i, 1);
    renderDesignSorts();
  }

  function renderDesignSorts() {
    const area = document.getElementById('design-sorts-area');
    if (!area) return;
    const cols = DataLaVistaState.queryColumns;
    const sorts = DataLaVistaState.design.sorts || [];

    area.innerHTML = '';
    if (!sorts.length) {
      area.innerHTML = '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No sorts — click + Add</div>';
      return;
    }

    sorts.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'qb-sort-row';
      row.innerHTML = `
        <select class="form-input qb-field-select" onchange="DataLaVistaState.design.sorts[${i}].field=this.value">
          ${cols.map(f=>`<option value="${f}" ${f===s.field?'selected':''}>${f}</option>`).join('')}
        </select>
        <select class="form-input qb-dir-select" onchange="DataLaVistaState.design.sorts[${i}].dir=this.value">
          <option ${s.dir==='ASC'?'selected':''}>ASC</option>
          <option ${s.dir==='DESC'?'selected':''}>DESC</option>
        </select>
        <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeDesignSort(${i})">✕</button>
      `;
      area.appendChild(row);
    });
  }

  // ── Design group by ───────────────────────────────────────────────────────
  function addDesignGroupBy() {
    if (!DataLaVistaState.queryColumns.length) return;
    if (!DataLaVistaState.design.groupBy) DataLaVistaState.design.groupBy = [];
    DataLaVistaState.design.groupBy.push(DataLaVistaState.queryColumns[0]);
    syncDesignGroupBySection();
  }

  function removeDesignGroupBy(i) {
    DataLaVistaState.design.groupBy.splice(i, 1);
    syncDesignGroupBySection();
  }

  function renderDesignGroupBy() {
    const area = document.getElementById('design-groupby-area');
    if (!area) return;
    const cols = DataLaVistaState.queryColumns;
    const groups = DataLaVistaState.design.groupBy || [];

    area.innerHTML = '';
    if (!groups.length) {
      area.innerHTML = '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No grouping — click + Add</div>';
      return;
    }

    groups.forEach((g, i) => {
      const row = document.createElement('div');
      row.className = 'qb-sort-row';
      row.innerHTML = `
        <select class="form-input qb-field-select" onchange="DataLaVistaState.design.groupBy[${i}]=this.value">
          ${cols.map(f=>`<option value="${f}" ${f===g?'selected':''}>${f}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeDesignGroupBy(${i})">✕</button>
      `;
      area.appendChild(row);
    });
  }

  /** Shows/hides the manual GROUP BY add-button when aggregates are active (auto-group then). */
  function syncDesignGroupBySection() {
    const anyAgg = DataLaVistaState.queryColumns.some(c => (DataLaVistaState.design.fieldAggs || {})[c]);
    const label  = document.getElementById('design-groupby-label');
    const addBtn = document.getElementById('design-groupby-add-btn');
    if (label)  label.textContent = anyAgg ? 'GROUP BY (auto)' : 'GROUP BY';
    if (addBtn) addBtn.style.display = anyAgg ? 'none' : '';
    if (anyAgg) {
      const area = document.getElementById('design-groupby-area');
      if (area) {
        const nonAgg = DataLaVistaState.queryColumns.filter(c => !(DataLaVistaState.design.fieldAggs || {})[c]);
        area.innerHTML = nonAgg.length
          ? `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${nonAgg.join(', ')}</div>`
          : `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All fields aggregated — no GROUP BY needed</div>`;
      }
    } else {
      renderDesignGroupBy();
    }
  }

      // ============================================================
      // WIDGET TYPES
      // ============================================================
      const WIDGET_TYPES = [
        { id: 'table', label: 'Table', icon: '⊞' },
        { id: 'bar', label: 'Bar', icon: '▐' },
        { id: 'line', label: 'Line', icon: '〰' },
        { id: 'pie', label: 'Pie', icon: '◕' },
        { id: 'scatter', label: 'Scatter', icon: '⁘' },
        { id: 'kpi', label: 'KPI', icon: '🔢' },
        { id: 'text', label: 'Text', icon: 'T' },
        { id: 'placeholder', label: 'Blank', icon: '□' },
      ];

      function initToolbox() {
        const grid = document.getElementById('widget-types-grid');
        grid.innerHTML = '';
        for (const wt of WIDGET_TYPES) {
          const btn = document.createElement('div');
          btn.className = 'widget-type-btn';
          btn.draggable = true;
          btn.innerHTML = `<span class="icon">${wt.icon}</span><span>${wt.label}</span>`;
          btn.addEventListener('dragstart', e => {
            safeDragSet(e, { type: 'widget-type', widgetType: wt.id });
          });
          btn.addEventListener('click', () => { addWidgetToCanvas(wt.id, null, null); }); // TODO: Does this conflict with another event?
          grid.appendChild(btn);
        }
      }

      // ============================================================
      // CANVAS DROP HANDLING
      // ============================================================
      function onCanvasDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
      }
      function onCanvasDragLeave(event) {
        if (event.currentTarget === event.target) event.currentTarget.classList.remove('drag-over');
      }

      function onDropToCanvas(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        if (data.type === 'widget-type') {
          if (data.widgetType === 'table') {
            addWidgetToCanvas('table', null, data.table);
          } else {
            addWidgetToCanvas(data.widgetType, null, null);
          }
        }
        else if (data.type === 'table') addWidgetToCanvas('table', null, data.table);

        if(data.type === 'result-field' || data.type === 'field') {
          switch (data.dataType) {
            case 'number':
              addWidgetToCanvas('bar', [...(DataLaVistaState.queryColumns.filter(c => c !== data.field && sniffType(c) === 'text')[0] || data.field), data.field], null);
              break;
            case 'date':
              addWidgetToCanvas('line', [data.field, ...DataLaVistaState.queryColumns.filter(c => c !== data.field && sniffType(c) === 'number')], null); break;
            case 'boolean':
              addWidgetToCanvas('pie', [data.field, ...DataLaVistaState.queryColumns.filter(c => c !== data.field && sniffType(c) === 'number')], null); break;
            default:
              addWidgetToCanvas('table', [data.field], null);
          }
        }
      }

      function onDropToFilterBar(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        let field = null;
        if (data.type === 'result-field') field = data.field;
        else if (data.type === 'field') field = data.field;
        if (field) addFilterToBar(field);
      }

      function addFilterToBar(field) {
        if (DataLaVistaState.design.filters.find(f => f.field === field)) { toast('Filter for ' + field + ' already added', 'warning'); return; }
        DataLaVistaState.design.filters.push({ field, label: field, position: 'bar' });
        renderFilterBar();
      }

      function addWidgetToCanvas(widgetType, fields, tableName) {
        const id = 'w_' + Date.now();
        const widget = {
          id,
          type: widgetType,
          title: getDefaultTitle(widgetType),
          widthPct: 45,
          heightVh: 30,
          fields: fields || (DataLaVistaState.queryColumns.length ? (widgetType === 'kpi' ? [DataLaVistaState.queryColumns[0]] : DataLaVistaState.queryColumns.slice(0, 8)) : []),
          xField: (fields && fields.length>0) ? fields[0] : DataLaVistaState.queryColumns[0] || '', // TODO: guess x and y based on dataType
          yField: (fields && fields.length>1) ? fields[1] : DataLaVistaState.queryColumns[1] || '',
          aggregation: '',
          fillColor: '#0078d4',
          borderColor: '#edebe9',
          borderSize: 1,
          fontSize: 13,
          fontColor: '#323130',
          textContent: 'Enter text or HTML here...',
          imageUrl: '',
          filters: []
        };

        if (tableName && DataLaVistaState.tables[tableName]) {
          widget.fields = DataLaVistaState.tables[tableName].fields.filter(f => !f.isAutoId).map(f => f.alias).slice(0, 8);
        }

        DataLaVistaState.design.widgets.push(widget);
        renderDesignCanvas();
        selectWidget(id);
        document.getElementById('canvas-empty-hint').style.display = 'none';
      }

      function getDefaultTitle(type) {
        const map = { table: 'Data Table', bar: 'Bar Chart', line: 'Line Chart', pie: 'Pie Chart', scatter: 'Scatter Plot', kpi: 'KPI', text: 'Text', placeholder: '' };
        return map[type] || 'Widget';
      }

      // ============================================================
      // DESIGN CANVAS RENDERING
      // ============================================================
      function renderDesignCanvas() {
        const canvas = document.getElementById('canvas-drop-zone');
        const hint = document.getElementById('canvas-empty-hint');

        // Remove existing widgets (but not hint or drop zone controls)
        canvas.querySelectorAll('.widget').forEach(w => w.remove());

        // Destroy old chart instances
        for (const [id, chart] of Object.entries(DataLaVistaState.charts)) {
          try { chart.dispose(); } catch (e) { }
        }
        DataLaVistaState.charts = {};

        if (!DataLaVistaState.design.widgets.length) {
          hint.style.display = 'flex';
          return;
        }
        hint.style.display = 'none';

        for (const w of DataLaVistaState.design.widgets) {
          const el = createWidgetElement(w);
          canvas.appendChild(el);
        }

        // Render charts after DOM
        requestAnimationFrame(() => {
          for (const w of DataLaVistaState.design.widgets) {
            if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
              renderChart(w);
            }
          }
        });
      }

      function createWidgetElement(w) {
        const el = document.createElement('div');
        el.className = 'widget';
        el.id = 'widget-' + w.id;
        el.style.cssText = `width:${w.widthPct}%;height:${w.heightVh}vh;min-height:120px;border-color:${w.borderColor};border-width:${w.borderSize}px`;

        const actions = `
    <div class="widget-actions">
      <button class="btn btn-ghost btn-icon btn-sm" onclick="moveWidget('${w.id}', -1)" title="Move left">←</button>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="moveWidget('${w.id}', 1)" title="Move right">→</button>
      <button class="btn btn-danger btn-icon btn-sm" onclick="deleteWidget('${w.id}')" title="Delete">✕</button>
    </div>
  `;

        el.innerHTML = `
    <div class="widget-header">
      <span class="widget-title">${w.title || ''}</span>
      ${actions}
    </div>
    <div class="widget-content" id="wcontent-${w.id}">
      ${getWidgetContentHTML(w)}
    </div>
    <div class="widget-resize-handle"></div>
  `;

        el.addEventListener('click', e => { if (!e.target.closest('button')) selectWidget(w.id); });

        // Resize handle
        const rh = el.querySelector('.widget-resize-handle');
        rh.addEventListener('mousedown', e => startWidgetResize(e, w.id, el));

        return el;
      }

      function getWidgetContentHTML(w) {
        if (w.type === 'text') return `<div class="text-widget" style="font-size:${w.fontSize}px;color:${w.fontColor}">${w.textContent}</div>`;
        if (w.type === 'placeholder') return '';
        if (w.type === 'kpi') return renderKPIContent(w);
        if (w.type === 'table') return renderTableContent(w);
        if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) return `<div id="chart-${w.id}" style="width:100%;height:100%;min-height:200px"></div>`;
        return '';
      }

      // ============================================================
      // DATA AGGREGATION HELPER (fixes raw-data chart & KPI bugs)
      // ============================================================
      /**
       * Applies global previewFilters AND per-widget filters, then groups by xField
       * and aggregates yField according to w.aggregation.
       * Returns a flat array suitable for charts/KPIs.
       * If xField is absent (KPI-only widget), just returns the filtered rows.
       */
      function aggregateDataForWidget(w, data) {
        data = data || getDesignData();
        if (!data.length) return [];

        // 1. Apply per-widget filters (field + operator + value)
        let filtered = data;
        if (w.filters && w.filters.length) {
          for (const f of w.filters) {
            if (f.value !== undefined && f.value !== '' && f.value !== '(All)') {
              const op = f.operator || '=';
              filtered = filtered.filter(r => {
                const rv = String(r[f.field] ?? '');
                const fv = String(f.value);
                switch (op) {
                  case '!=': return rv !== fv;
                  case 'contains': return rv.toLowerCase().includes(fv.toLowerCase());
                  case '>': return parseFloat(rv) > parseFloat(fv);
                  case '<': return parseFloat(rv) < parseFloat(fv);
                  case '>=': return parseFloat(rv) >= parseFloat(fv);
                  case '<=': return parseFloat(rv) <= parseFloat(fv);
                  default: return rv === fv; // '='
                }
              });
            }
          }
        }

        // 2. If no xField, just return filtered rows (for KPI, table, etc.)
        const xField = w.xField;
        const yField = w.yField;
        const agg = (w.aggregation || 'NONE').toUpperCase();
        if (!xField || agg === 'NONE') return filtered;

        // 3. Group by xField, collect yField values per group
        const groups = new Map();
        const order = [];
        for (const row of filtered) {
          const key = String(row[xField] ?? '');
          if (!groups.has(key)) { groups.set(key, { x: row[xField], values: [] }); order.push(key); }
          if (yField) {
            const yv = parseFloat(row[yField]);
            groups.get(key).values.push(isNaN(yv) ? 0 : yv);
          } else {
            groups.get(key).values.push(1); // COUNT fallback
          }
        }

        // 4. Aggregate each group
        return order.map(key => {
          const g = groups.get(key);
          const vals = g.values;
          let yAgg;
          switch (agg) {
            case 'COUNT': yAgg = vals.length; break;
            case 'AVG': yAgg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; break;
            case 'MIN':
            case 'MINDATE': yAgg = Math.min(...vals); break;
            case 'MAX':
            case 'MAXDATE': yAgg = Math.max(...vals); break;
            case 'FIRST': yAgg = vals[0] ?? 0; break;
            case 'LAST': yAgg = vals[vals.length - 1] ?? 0; break;
            case 'SUM':
            default: yAgg = vals.reduce((a, b) => a + b, 0); break;
          }
          const out = {};
          out[xField] = g.x;
          if (yField) out[yField] = yAgg;
          return out;
        });
      }

      function renderKPIContent(w, data) {
        let value = '—', label = w.fields[0] || '';
        const kpiData = data || getDesignData();
        if (kpiData && kpiData.length && label) {
          const field = label;
          const agg = w.aggregation || 'SUM';
          const vals = kpiData.map(r => parseFloat(r[field]) || 0);
          if (agg === 'COUNT') value = kpiData.length;
          else if (agg === 'SUM') value = vals.reduce((a, b) => a + b, 0).toLocaleString();
          else if (agg === 'AVG') value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—';
          else value = kpiData[0][field] ?? '—';
        }
        return `<div class="kpi-card"><div class="kpi-value" style="color:${w.fillColor}">${value}</div><div class="kpi-label">${label}</div></div>`;
      }

      function renderTableContent(w) {
        const tableData = getDesignData();
        if (!tableData || !tableData.length) {
          return '<div class="text-muted text-sm" style="padding:12px">No data — run a query first</div>';
        }
        const allCols = tableData.length ? Object.keys(tableData[0]) : DataLaVistaState.queryColumns;
        const cols = w.fields.filter(f => allCols.includes(f));
        if (!cols.length) return '<div class="text-muted text-sm" style="padding:12px">No fields selected</div>';
        const rows = tableData;
        let html = '<div style="overflow:auto;max-height:100%"><table class="widget-table"><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        for (const row of rows) {
          html += '<tr>' + cols.map(c => `<td>${row[c] ?? ''}</td>`).join('') + '</tr>';
        }
        html += '</tbody></table></div>';
        return html;
      }

      function renderChart(w) {
        const chartEl = document.getElementById('chart-' + w.id);
        if (!chartEl) return;
        if (DataLaVistaState.charts[w.id]) { try { DataLaVistaState.charts[w.id].dispose(); } catch (e) { } }

        const chart = echarts.init(chartEl);
        DataLaVistaState.charts[w.id] = chart;

        const chartData = getDesignData();
        if (!chartData || !chartData.length) {
          chart.setOption({ title: { text: 'No data', left: 'center', top: 'middle', textStyle: { color: '#a19f9d', fontSize: 13 } } });
          return;
        }

        const allChartCols = chartData.length ? Object.keys(chartData[0]) : DataLaVistaState.queryColumns;
        const xField = w.xField || (allChartCols[0] || '');
        const yField = w.yField || (allChartCols[1] || allChartCols[0] || '');
        const data = chartData;

        let option = {};
        if (w.type === 'bar') {
          const xData = data.map(r => r[xField]);
          const yData = data.map(r => parseFloat(r[yField]) || 0);
          option = {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, fontSize: 11 } },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: yData, itemStyle: { color: w.fillColor } }],
            grid: { left: 40, right: 20, top: 20, bottom: 60 }
          };
        } else if (w.type === 'line') {
          const xData = data.map(r => r[xField]);
          const yData = data.map(r => parseFloat(r[yField]) || 0);
          option = {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, fontSize: 11 } },
            yAxis: { type: 'value' },
            series: [{ type: 'line', data: yData, itemStyle: { color: w.fillColor }, smooth: true }],
            grid: { left: 40, right: 20, top: 20, bottom: 60 }
          };
        } else if (w.type === 'pie') {
          const pieData = data.map(r => ({ name: String(r[xField] || ''), value: parseFloat(r[yField]) || 0 }));
          option = {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{ type: 'pie', data: pieData, radius: ['30%', '65%'], label: { fontSize: 11 } }]
          };
        } else if (w.type === 'scatter') {
          const scData = data.map(r => [parseFloat(r[xField]) || 0, parseFloat(r[yField]) || 0]);
          option = {
            tooltip: { trigger: 'item' },
            xAxis: { type: 'value' },
            yAxis: { type: 'value' },
            series: [{ type: 'scatter', data: scData, itemStyle: { color: w.fillColor } }],
            grid: { left: 40, right: 20, top: 20, bottom: 40 }
          };
        }

        chart.setOption(option);
      }

      // Resize charts on window resize
      window.addEventListener('resize', () => {
        for (const chart of Object.values(DataLaVistaState.charts)) {
          try { chart.resize(); } catch (e) { }
        }
      });

      function startWidgetResize(e, wid, el) {
        e.preventDefault();
        e.stopPropagation();
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const startX = e.clientX, startY = e.clientY;
        const startW = el.offsetWidth, startH = el.offsetHeight;
        const containerW = document.getElementById('canvas-wrap').offsetWidth;

        const onMove = mv => {
          const dx = mv.clientX - startX, dy = mv.clientY - startY;
          w.widthPct = Math.max(20, Math.min(100, ((startW + dx) / containerW) * 100));
          w.heightVh = Math.max(10, (startH + dy) / window.innerHeight * 100);
          el.style.width = w.widthPct + '%';
          el.style.height = w.heightVh + 'vh';
          if (DataLaVistaState.charts[wid]) DataLaVistaState.charts[wid].resize();
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }

      function selectWidget(wid) {
        DataLaVistaState.currentWidgetId = wid;
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('selected'));
        document.getElementById('widget-' + wid)?.classList.add('selected');
        renderWidgetProperties(wid);
      }

      function deleteWidget(wid) {
        DataLaVistaState.design.widgets = DataLaVistaState.design.widgets.filter(w => w.id !== wid);
        if (DataLaVistaState.charts[wid]) { try { DataLaVistaState.charts[wid].dispose(); } catch (e) { } delete DataLaVistaState.charts[wid]; }
        document.getElementById('widget-' + wid)?.remove();
        if (DataLaVistaState.currentWidgetId === wid) {
          DataLaVistaState.currentWidgetId = null;
          document.getElementById('props-section').innerHTML = '<div class="props-empty">Click a widget to edit its properties</div>';
        }
        if (!DataLaVistaState.design.widgets.length) document.getElementById('canvas-empty-hint').style.display = 'flex';
      }

      function moveWidget(wid, dir) {
        const idx = DataLaVistaState.design.widgets.findIndex(w => w.id === wid);
        if (idx < 0) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= DataLaVistaState.design.widgets.length) return;
        [DataLaVistaState.design.widgets[idx], DataLaVistaState.design.widgets[newIdx]] = [DataLaVistaState.design.widgets[newIdx], DataLaVistaState.design.widgets[idx]];
        renderDesignCanvas();
        selectWidget(wid);
      }

      // ============================================================
      // WIDGET PROPERTIES
      // ============================================================
      function renderWidgetProperties(wid) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const section = document.getElementById('props-section');

        const isChart = ['bar', 'line', 'pie', 'scatter'].includes(w.type);
        const isKPI = w.type === 'kpi';
        const isTable = w.type === 'table';
        const isText = w.type === 'text';

        section.innerHTML = `
    <div class="props-group">
      <div class="props-group-label">General</div>
      <div class="props-row">
        <label>Title</label>
        <input type="text" class="form-input" value="${w.title}" oninput="updateWidgetProp('${wid}','title',this.value)"/>
      </div>
      <div class="props-row">
        <label>Type</label>
        <select class="form-input" onchange="changeWidgetType('${wid}', this.value)">
          ${WIDGET_TYPES.map(t => `<option value="${t.id}" ${t.id === w.type ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="props-row">
        <label>Width %</label>
        <input type="number" class="form-input" min="10" max="100" value="${w.widthPct}" oninput="updateWidgetProp('${wid}','widthPct',+this.value)"/>
      </div>
      <div class="props-row">
        <label>Height vh</label>
        <input type="number" class="form-input" min="5" max="100" value="${w.heightVh}" oninput="updateWidgetProp('${wid}','heightVh',+this.value)"/>
      </div>
    </div>

    <div class="props-group">
      <div class="props-group-label">Appearance</div>
      <div class="props-row">
        <label>Fill/Accent</label>
        <div class="color-input-wrap">
          <input type="color" value="${w.fillColor}" oninput="updateWidgetProp('${wid}','fillColor',this.value)"/>
          <input type="text" class="form-input" value="${w.fillColor}" oninput="updateWidgetProp('${wid}','fillColor',this.value)"/>
        </div>
      </div>
      <div class="props-row">
        <label>Border</label>
        <div class="color-input-wrap">
          <input type="color" value="${w.borderColor}" oninput="updateWidgetProp('${wid}','borderColor',this.value)"/>
          <input type="number" class="form-input" value="${w.borderSize}" min="0" max="10" oninput="updateWidgetProp('${wid}','borderSize',+this.value)" style="width:50px"/>
        </div>
      </div>
      ${isText ? `
      <div class="props-row">
        <label>Font size</label>
        <input type="number" class="form-input" min="8" max="72" value="${w.fontSize}" oninput="updateWidgetProp('${wid}','fontSize',+this.value)"/>
      </div>
      <div class="props-row">
        <label>Font color</label>
        <div class="color-input-wrap">
          <input type="color" value="${w.fontColor}" oninput="updateWidgetProp('${wid}','fontColor',this.value)"/>
          <input type="text" class="form-input" value="${w.fontColor}" oninput="updateWidgetProp('${wid}','fontColor',this.value)"/>
        </div>
      </div>
      <div class="props-row" style="flex-direction:column;align-items:flex-start">
        <label>Content</label>
        <textarea class="form-input" rows="4" oninput="updateWidgetProp('${wid}','textContent',this.value)">${w.textContent}</textarea>
      </div>` : ''}
    </div>

    ${(isChart || isKPI) ? `
    <div class="props-group">
      <div class="props-group-label">Data Binding</div>
      ${isChart ? `
      <div class="props-row">
        <label>X / Label</label>
        <select class="form-input" onchange="updateWidgetProp('${wid}','xField',this.value)">
          ${DataLaVistaState.queryColumns.map(c => `<option ${c === w.xField ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="props-row">
        <label>Y / Value</label>
        <select class="form-input" onchange="updateWidgetProp('${wid}','yField',this.value)">
          ${DataLaVistaState.queryColumns.map(c => `<option ${c === w.yField ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>` : ''}
      ${isKPI ? `
      <div class="props-row">
        <label>Field</label>
        <select class="form-input" onchange="updateWidgetProp('${wid}','fields',[this.value])">
          ${DataLaVistaState.queryColumns.map(c => `<option ${w.fields[0] === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="props-row">
        <label>Aggregation</label>
        <select class="form-input" onchange="updateWidgetProp('${wid}','aggregation',this.value)">
          ${['SUM', 'COUNT', 'AVG', 'FIRST', 'LAST', 'MIN', 'MAX'].map(a => `<option ${a === w.aggregation ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>` : ''}

    ${isTable ? `
    <div class="props-group">
      <div class="props-group-label">Columns</div>
      <div id="table-fields-list" class="field-assign-list">
        ${w.fields.map((f, i) => `
          <div class="field-assign-item">
            <span style="flex:1">${f}</span>
            <span class="remove" onclick="removeWidgetField('${wid}',${i})">✕</span>
          </div>`).join('')}
      </div>
      <div class="field-drop-zone" style="margin-top:4px" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="onDropFieldToWidget('${wid}',event)">
        Drop fields here
      </div>
    </div>` : ''}

    <div class="props-group">
      <div class="props-group-label">Widget Filters</div>
      <div id="widget-filters-list">
        ${w.filters.map((f, i) => `<div class="field-assign-item"><span style="flex:1">${f.field}</span><span class="remove" onclick="removeWidgetFilter('${wid}',${i})">✕</span></div>`).join('')}
      </div>
      <div class="field-drop-zone" style="margin-top:4px" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="onDropFilterToWidget('${wid}',event)">
        Drop fields for widget filter
      </div>
    </div>
  `;
      }

      function updateWidgetProp(wid, prop, value) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w[prop] = value;
        // Live-update element
        const el = document.getElementById('widget-' + wid);
        if (!el) return;
        if (prop === 'title') el.querySelector('.widget-title').textContent = value;
        if (prop === 'widthPct') el.style.width = value + '%';
        if (prop === 'heightVh') { el.style.height = value + 'vh'; if (DataLaVistaState.charts[wid]) DataLaVistaState.charts[wid].resize(); }
        if (prop === 'borderColor') el.style.borderColor = value;
        if (prop === 'borderSize') el.style.borderWidth = value + 'px';
        if (prop === 'textContent' && w.type === 'text') el.querySelector('.text-widget').innerHTML = value;
        if (prop === 'fontSize' && w.type === 'text') el.querySelector('.text-widget').style.fontSize = value + 'px';
        if (prop === 'fontColor' && w.type === 'text') el.querySelector('.text-widget').style.color = value;
        if (['xField', 'yField', 'aggregation', 'fillColor', 'fields'].includes(prop) && ['bar', 'line', 'pie', 'scatter'].includes(w.type)) renderChart(w);
        if (['xField', 'yField', 'aggregation', 'fillColor', 'fields'].includes(prop) && w.type === 'kpi') el.querySelector('.widget-content').innerHTML = renderKPIContent(w);
      }

      function changeWidgetType(wid, newType) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w.type = newType;
        // Refresh the widget
        const el = document.getElementById('widget-' + wid);
        if (!el) return;
        const content = el.querySelector('.widget-content');
        content.innerHTML = getWidgetContentHTML(w);
        if (DataLaVistaState.charts[wid]) { try { DataLaVistaState.charts[wid].dispose(); } catch (e) { } delete DataLaVistaState.charts[wid]; }
        if (['bar', 'line', 'pie', 'scatter'].includes(newType)) {
          requestAnimationFrame(() => renderChart(w));
        }
      }

      function removeWidgetField(wid, idx) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w.fields.splice(idx, 1);
        renderWidgetProperties(wid);
        updateWidgetContent(wid);
      }

      function removeWidgetFilter(wid, idx) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w.filters.splice(idx, 1);
        renderWidgetProperties(wid);
      }

      function onDropFieldToWidget(wid, event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        const field = data.field || data.alias;
        if (field) {
          const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
          if (w && !w.fields.includes(field)) { w.fields.push(field); renderWidgetProperties(wid); updateWidgetContent(wid); }
        }
      }

      function onDropFilterToWidget(wid, event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        const field = data.field || data.alias;
        if (field) {
          const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
          if (w && !w.filters.find(f => f.field === field)) { w.filters.push({ field, position: 'widget' }); renderWidgetProperties(wid); }
        }
      }

      function updateWidgetContent(wid) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const el = document.getElementById('wcontent-' + wid);
        if (!el) return;
        el.innerHTML = getWidgetContentHTML(w);
        if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) requestAnimationFrame(() => renderChart(w));
      }

      // ============================================================
      // FILTER BAR
      // ============================================================
      function renderFilterBar() {
        const bar = document.getElementById('filter-drop-zone');
        if (!bar) return;
        bar.innerHTML = '';

        if (DataLaVistaState.design.filters.length === 0) {
          bar.innerHTML = '<div class="text-muted text-sm" style="padding:4px 8px;">Drag fields here to filter dashboard</div>';
          return;
        }

        DataLaVistaState.design.filters.forEach(f => {
          let uniqueVals = [];
          if (DataLaVistaState.queryResults) {
            uniqueVals = [...new Set(DataLaVistaState.queryResults.map(r => r[f.field]).filter(v => v !== null && v !== undefined))].sort();
          }

          const wrap = document.createElement('div');
          wrap.className = 'filter-pill';
          wrap.style.display = 'flex';
          wrap.style.alignItems = 'center';
          wrap.style.gap = '6px';
          wrap.style.background = 'var(--surface)';
          wrap.style.border = '1px solid var(--border-strong)';
          wrap.style.padding = '4px 8px';
          wrap.style.borderRadius = 'var(--radius)';

          const lbl = document.createElement('span');
          lbl.style.fontSize = '12px';
          lbl.style.fontWeight = '600';
          lbl.innerText = f.label || f.field;

          const sel = document.createElement('select');
          sel.className = 'form-input';
          sel.style.height = '24px';
          sel.style.padding = '0 24px 0 6px';
          sel.innerHTML = `<option value="(All)">(All)</option>` +
            uniqueVals.map(v => `<option value="${v}">${v}</option>`).join('');

          sel.value = DataLaVistaState.previewFilters[f.field] || '(All)';
          sel.onchange = (e) => {
            if (e.target.value === '(All)') delete DataLaVistaState.previewFilters[f.field];
            else DataLaVistaState.previewFilters[f.field] = e.target.value;
            refreshWidgets();
          };

          const del = document.createElement('span');
          del.innerHTML = '✕';
          del.style.cursor = 'pointer';
          del.style.fontSize = '10px';
          del.onclick = () => removeFilterFromBar(f.field);

          wrap.appendChild(lbl); wrap.appendChild(sel); wrap.appendChild(del);
          bar.appendChild(wrap);
        });
      }

      function removeFilterFromBar(field) {
        DataLaVistaState.design.filters = DataLaVistaState.design.filters.filter(f => f.field !== field);
        renderFilterBar();
      }

      function applyPreviewFilter(field, value) {
        if (value === '(All)') delete DataLaVistaState.previewFilters[field];
        else DataLaVistaState.previewFilters[field] = value;
        refreshWidgets();
      }

      function refreshWidgets() {
        let filtered = DataLaVistaState.queryResults || [];
        for (const [field, value] of Object.entries(DataLaVistaState.previewFilters)) {
          // Basic equals filter matching
          filtered = filtered.filter(r => String(r[field]) === String(value));
        }

        // Re-render chart/KPI elements based on filtered subset
        DataLaVistaState.design.widgets.forEach(w => {
          const el = document.getElementById('wcontent-' + w.id);
          if (el) {
            el.innerHTML = getWidgetContentHTML(w, filtered);
            if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
              requestAnimationFrame(() => renderChart(w, filtered));
            }
          }
        });
      }

