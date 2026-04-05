/* ============================================================
This file is part of DataLaVista™
60-design.js: Design canvas, widget rendering, data transforms, and widget properties.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-05
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

  

/**
 * Scores a given ECharts widget suggestion rule based on the provided dataset metadata.
 * Higher scores indicate a better fit for the dataset.
 * * @param {Object} rule - A single rule object from CHART_TYPE_RULES
 * @param {Array} cols - Array of column metadata: [{name, type, cardinality, nullPct}]
 * @param {Object} meta - Dataset metadata: {rowCount, totalCols}
 * @returns {number} The calculated priority score
 */
function scoreRule(rule, cols, meta) {
  let score = 0;
  const suggestion = rule.suggestion || {};
  
  // 1. Chart type resolution (handle structural variations in rules)
  const ruleString = JSON.stringify(rule).toLowerCase();
  const chartType = (suggestion.chartType || '').toLowerCase();
  
  const isPie = chartType === 'pie' || ruleString.includes('"type":"pie"') || ruleString.includes('"pie":{');
  const isLine = chartType === 'line' || chartType === 'area' || ruleString.includes('"type":"line"');
  const isScatter = chartType === 'scatter' || ruleString.includes('"type":"scatter"');
  const isGauge = chartType === 'gauge' || chartType === 'kpi' || ruleString.includes('"gauge":{');
  const isRadar = chartType === 'radar' || ruleString.includes('"type":"radar"');

  // Baseline Score based on rule Priority (1 is highest/best)
  const priority = suggestion.priority || 3;
  score += (4 - priority) * 20; // Priority 1 = +60, Priority 2 = +40, Priority 3 = +20

  // Resolve requested fields safely
  const xField = suggestion.xField;
  const yFields = Array.isArray(suggestion.yFields) ? suggestion.yFields : (suggestion.yFields ? [suggestion.yFields] : []);
  const seriesField = suggestion.seriesField;

  // FACTOR 1: How many columns does the rule use? (More specific = higher score)
  let colsUsed = 0;
  if (xField) colsUsed++;
  if (seriesField) colsUsed++;
  
  // Handle wildcard/magic fields like '__NUM_ALL__' or 'number'
  const yFieldStr = yFields.join(',').toLowerCase();
  if (yFieldStr.includes('all') || yFieldStr.includes('number')) {
    colsUsed += cols.filter(c => c.type === 'number').length || 1;
  } else {
    colsUsed += yFields.length;
  }
  score += (colsUsed * 5); // Reward rules that utilize more of the dataset dimensions

  // FACTOR 2 & 4: Matches primary apparent purpose & named column hints
  // Dynamic scanning: If the rule explicitly hardcodes or looks for domain-specific words 
  // (like 'ticket', 'assignee', 'glucose', 'status') and the dataset actually has them.
  cols.forEach(c => {
    const cname = c.name.toLowerCase();
    if (cname.length > 2 && ruleString.includes(cname)) {
      score += 15; // Bonus for each exact column name / keyword match
    }
  });

  // FACTOR 3: Is the chart type appropriate for the row count?
  const rc = meta.rowCount || 0;
  if (rc === 1) {
    if (isGauge) score += 40;
    if (isLine || isScatter) score -= 50; // Lines/scatters are useless with 1 row
  } else if (rc > 50) {
    if (isPie || isRadar) score -= 30; // Pies/Radars become unreadable
    if (isScatter || isLine) score += 20; // Dense data looks great here
  }

  // FACTOR 5: Penalize pie charts if cardinality > 6
  if (isPie) {
    // Try to find the dimension column being used to group the pie
    const dimCol = cols.find(c => c.name === xField || c.name === seriesField) || cols.find(c => c.type === 'text');
    const card = dimCol ? dimCol.cardinality : rc;
    if (card > 6) {
      score -= (card - 6) * 5; // Progressive penalty (-5 points per excess slice)
    }
  }

  // FACTOR 6: Bonus for temporal data being shown as line/area
  const hasDate = cols.some(c => c.type === 'date');
  if (hasDate && isLine) {
    score += 30; 
  }

  // FACTOR 7: Penalize if >30% null values in key fields
  const keyFieldNames = [xField, ...yFields, seriesField].filter(Boolean).map(f => String(f).toLowerCase());
  let nullPenalty = 0;
  
  cols.forEach(c => {
    // Check if the dataset column matches a requested field by name or primitive type
    if (keyFieldNames.includes(c.name.toLowerCase()) || keyFieldNames.includes(c.type.toLowerCase())) {
      if (c.nullPct > 0.3) {
        nullPenalty += Math.floor(c.nullPct * 50); // e.g., 60% nulls = -30 point penalty
      }
    }
  });
  score -= nullPenalty;

  return score;
}

/**
 * Evaluates all matched rules against the dataset and returns the top 5 suggestions.
 * * @param {Array} rules - Array of matching rule objects
 * @param {Array} cols - Array of column metadata
 * @param {Object} meta - Dataset metadata
 * @returns {Array} Top 5 rule objects sorted by best fit
 */
function rankSuggestions(rules, cols, meta) {
  if (!rules || !rules.length) return [];

  // Map rules to their scores
  const scoredRules = rules.map(rule => ({
    rule: rule,
    score: scoreRule(rule, cols, meta)
  }));

  // Sort descending (highest score first)
  scoredRules.sort((a, b) => b.score - a.score);

  // Return the top 5 raw rule objects
  return scoredRules.slice(0, 5).map(item => item.rule);
}

  function renderDesignFieldsPanel() {
    const body = document.getElementById('design-fields-body');
    if (!DataLaVistaState.queryColumns.length) {
      body.innerHTML = '<div class="text-muted text-sm" style="padding:12px 10px">Run a query first</div>';
      return;
    }

    const cols = DataLaVistaState.queryColumns;

    body.innerHTML = '';

    // ── FIELDS section (drag → canvas / widget) ────────────────────────────
    const secFields = document.createElement('div');
    secFields.className = 'qb-section';
    secFields.style.borderTop = 'none';
    secFields.innerHTML = `<div class="qb-section-header"><span>FIELDS</span><span style="font-size:10px;font-weight:400">drag → canvas</span></div>`;

    for (const col of cols) {
      const dt = sniffType(col);
      const ti = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;

      const row = document.createElement('div');
      row.className = 'design-field-row';
      row.draggable = true;
      row.innerHTML = `
        <span class="field-type-icon ${ti.cls}" style="font-size:10px">${ti.icon}</span>
        <span class="field-label" title="${col}">${col}</span>
      `;
      row.addEventListener('dragstart', e => {
        safeDragSet(e, { type: 'result-field', field: col, dataType: dt });
      });
      secFields.appendChild(row);
    }
    body.appendChild(secFields);
  }

  // ============================================================
  // DESIGN DATA TRANSFORMS (filter / sort / group / aggregate)
  // Uses the same QB_OPS, DATE_MACRO_OPS, QB_AGGS, and aggsForType()
  // as the Query Builder so the UI is identical.
  // ============================================================

  /** Returns the most-specific base dataset available.
   *  Priority: previewFilteredData → transformedResults → [dlv_active] view → queryResults fallback. */
  function getDesignData() {
    if (DataLaVistaState.design.previewFilteredData)  return DataLaVistaState.design.previewFilteredData;
    if (DataLaVistaState.design.transformedResults)   return DataLaVistaState.design.transformedResults;
    if (alasql.tables && alasql.tables['dlv_active']) return alasql('SELECT * FROM [dlv_active]');
    return [];
  }

  /** Re-runs the design-level AlaSQL transform against [dlv_results] (or queryResults fallback)
   *  and stores the result in DataLaVistaState.design.transformedResults, then re-renders widgets. */
  function applyDesignTransforms() {
    const hasView = !!(alasql.tables && alasql.tables['dlv_results']);
    if (!hasView) {
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

    const fromSrc = hasView ? '[dlv_results]' : '?';
    let sql = `SELECT ${selParts.join(', ')} FROM ${fromSrc}`;
    if (whereParts.length) sql += ` WHERE ${whereParts.join(' ')}`;
    if (groupParts.length) sql += ` GROUP BY ${groupParts.join(', ')}`;
    if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;

    try {
      const results = alasql(sql);
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
    const sel = document.querySelector('.design-agg-select');
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
	  row.innerHTML = (i === 0 ? `<span class="qb-where-badge">WHERE</span>`
          : `<select class="form-input qb-conj-select" onchange="DataLaVistaState.design.conditions[${i}].conj=this.value">
               <option ${c.conj==='AND'?'selected':''}>AND</option>
               <option ${c.conj==='OR'?'selected':''}>OR</option>
             </select>` );
	  row.innerHTML += `<select class="form-input qb-field-select"
          onchange="DataLaVistaState.design.conditions[${i}].field=this.value; renderDesignConditions()">`;
	  row.innerHTML += cols.map(f=>`<option value="${f}" ${f===c.field?'selected':''}>${f}</option>`).join('');
	  row.innerHTML == `</select>`;
	  row.innerHTML += `<select class="form-input qb-op-select" style="width:${isDate?'150px':'112px'}!important"
          onchange="DataLaVistaState.design.conditions[${i}].op=this.value; renderDesignConditions()">`;
	  row.innerHTML += ops.map(o=>`<option value="${o.val}" ${o.val===c.op?'selected':''}>${o.label}</option>`).join('');
	  row.innerHTML += `</select>`;
	  row.innerHTML += (needsValue
          ? `<input type="${isMacro?'number':'text'}" class="form-input qb-val-input"
               placeholder="${valPlaceholder}" min="1"
               value="${(c.value||'').replace(/"/g,'&quot;')}"
               oninput="DataLaVistaState.design.conditions[${i}].value=this.value"/>`
          : `<span class="qb-val-blank"></span>`);
	  row.innerHTML += `<button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeDesignCondition(${i})">✕</button>`;
	  row.innerHTML += ``;
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
      row.innerHTML = `<select class="form-input qb-field-select" onchange="DataLaVistaState.design.sorts[${i}].field=this.value">`;
	  row.innerHTML += cols.map(f=>`<option value="${f}" ${f===s.field?'selected':''}>${f}</option>`).join('');
      row.innerHTML += `</select>
        <select class="form-input qb-dir-select" onchange="DataLaVistaState.design.sorts[${i}].dir=this.value">
          <option ${s.dir==='ASC'?'selected':''}>ASC</option>
          <option ${s.dir==='DESC'?'selected':''}>DESC</option>
        </select>
        <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeDesignSort(${i})">✕</button>`;
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
      row.innerHTML = `<select class="form-input qb-field-select" onchange="DataLaVistaState.design.groupBy[${i}]=this.value">`;
	  row.innerHTML += cols.map(f=>`<option value="${f}" ${f===g?'selected':''}>${f}</option>`).join('');
      row.innerHTML += `</select><button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="removeDesignGroupBy(${i})">✕</button>`;
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
        if(grid) {
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

      // TODO: Use new heuristic functions scoreRule() and rankSuggestions()
      // to auto-suggest best widget type and fields based on the dropped item
      // (e.g. date → line chart with date on x-axis, number → bar chart, etc.).
      // The CHART_TYPE_RULES const needs revision as some heuristics that use
      // field names changed to just data types during de-duplication.
      // See AI prompt #4 in the archive folder.
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

        // Smart default Y field for chart widgets
        const _smartY = (() => {
          if (fields && fields.length > 1) return { yField: fields[1], yFields: [fields[1]], yAgg: '' };
          const qcols = DataLaVistaState.queryColumns;
          // 1. ID/Id field → COUNT DISTINCT
          const idCol = qcols.find(c => /^(id|ID|Id)$/i.test(c));
          if (idCol) return { yField: idCol, yFields: [idCol], yAgg: 'COUNT_DISTINCT' };
          // 2. Numeric → SUM
          const numCol = qcols.find(c => sniffType(c) === 'number');
          if (numCol) return { yField: numCol, yFields: [numCol], yAgg: 'SUM' };
          // 3. Date → MAX
          const dateCol = qcols.find(c => sniffType(c) === 'date');
          if (dateCol) return { yField: dateCol, yFields: [dateCol], yAgg: 'MAX' };
          const fb = qcols[1] || qcols[0] || '';
          return { yField: fb, yFields: fb ? [fb] : [], yAgg: '' };
        })();
        const _initFieldAggs = _smartY.yAgg ? { [_smartY.yField]: _smartY.yAgg } : {};

        const widget = {
          id,
          type: widgetType,
          title: getDefaultTitle(widgetType),
          showTitle: true,
          showHeaders: true,
          widthPct: 45,
          heightVh: 30,
          fields: fields || (DataLaVistaState.queryColumns.length ? (widgetType === 'kpi' ? [DataLaVistaState.queryColumns[0]] : DataLaVistaState.queryColumns.slice(0, 8)) : []),
          xField: (fields && fields.length > 0) ? fields[0] : DataLaVistaState.queryColumns[0] || '',
          yField: _smartY.yField,  // legacy compat
          yFields: _smartY.yFields,
          aggregation: '',
          fieldAggs: _initFieldAggs,
          conditions: [],
          sorts: [],
          fillColor: '#0078d4',
          widgetBackgroundColor: '#fefefe',
          chartBackgroundColor: '#fefefe',
          titleBackgroundColor: '#fefefe',
          titleFontSize: 14,
          titleFontColor: '#323130',
          headersBackgroundColor: '#f3f2f1',
          headersFontSize: 12,
          headersFontColor: '#323130',
          borderColor: '#edebe9',
          borderSize: 1,
          fontSize: 13,
          fontColor: '#323130',
          kpiMetricFontSize: 36,
          kpiLabelFontSize: 13,
          kpiLabelOverride: '',
          textContent: 'Enter text or HTML here...',
          imageUrl: '',
          filters: [],
          stacked: false,
          showTrendLine: false,
          ySeriesTypes: {},
          bubbleSizeField: '',
          bubbleColorField: ''
        };

        // Normalize yFields from legacy yField
        if (!Array.isArray(widget.yFields)) {
          widget.yFields = widget.yField ? [widget.yField] : [];
        }

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
      function getWidgetContentHTML(w) {
        if (w.type === 'text') return `<div class="text-widget" style="font-size:${w.fontSize}px;color:${w.fontColor}">${w.textContent}</div>`;
        if (w.type === 'placeholder') return '';
        if (w.type === 'kpi') return renderKPIContent(w);
        if (w.type === 'table') return renderTableContent(w);
        if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) return `<div id="chart-${w.id}" style="width:100%;height:100%;min-height:200px"></div>`;
        return '';
      }
	  
	  
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
        el.style.cssText = `width:${w.widthPct}%;height:${w.heightVh}vh;min-height:120px;border-color:${w.borderColor};border-width:${w.borderSize}px;background:${w.widgetBackgroundColor||'#fefefe'}`;

        const actions = `<div class="widget-actions">
      <button class="btn btn-ghost btn-icon btn-sm" onclick="moveWidget('${w.id}', -1)" title="Move left">←</button>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="moveWidget('${w.id}', 1)" title="Move right">→</button>
      <button class="btn btn-danger btn-icon btn-sm" onclick="deleteWidget('${w.id}')" title="Delete">✕</button></div>`;

        const titleStyle = `background:${w.titleBackgroundColor||'#fefefe'};font-size:${w.titleFontSize||14}px;color:${w.titleFontColor||'#323130'}`;
		el.innerHTML = `<div class="widget-header" style="${titleStyle}"><span class="widget-title">${w.title || ''}</span>${actions}</div>
  <div class="widget-content" id="wcontent-${w.id}">${getWidgetContentHTML(w)}</div><div class="widget-resize-handle"></div>`;
		// Set hidden via DOM property — safe from SharePoint HTML sanitizer
		if (w.showTitle === false) {
		  el.querySelector('.widget-header').hidden = true;
		}
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

      // ============================================================
      // PER-WIDGET DATA BUILDER
      // Applies widget-level fieldAggs, conditions, and sorts via AlaSQL
      // on top of the (possibly globally-transformed) base dataset.
      // ============================================================
      function buildWidgetData(w) {
        // Prefer a named AlaSQL view if one was registered by the preview runner.
        // [dlv_active] exists when a global filter bar filter is active (sits on top
        // of [dlv_results]); [dlv_results] is the base view wrapping the user's SQL.
        // Falling back to the in-memory array keeps the Design tab working before any
        // preview run has been executed.
        const hasActive  = !!(alasql.tables && alasql.tables['dlv_active']);
        const hasResults = !!(alasql.tables && alasql.tables['dlv_results']);
        const fromSrc    = hasActive ? '[dlv_active]' : hasResults ? '[dlv_results]' : null;

        const base = getDesignData();
        if (!fromSrc && (!base || !base.length)) return [];

        // Determine the set of columns this widget cares about.
        // When using a named view we don't have a base[0] to introspect, so we
        // rely on the widget's own field config (cols will be validated by SQL).
        let cols;
        if (w.type === 'table') {
          cols = fromSrc
            ? (w.fields || [])
            : (w.fields || []).filter(f => Object.prototype.hasOwnProperty.call(base[0], f));
        } else if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
          const _yfs = (Array.isArray(w.yFields) && w.yFields.length) ? w.yFields : (w.yField ? [w.yField] : []);
          cols = [...new Set([w.xField, ..._yfs].filter(Boolean))];
        } else if (w.type === 'kpi') {
          cols = (w.fields || []).slice(0, 1);
        } else {
          return base;
        }
        if (!cols.length) return base;

        // Ensure state arrays exist (handles widgets created before this version)
        const fieldAggs  = w.fieldAggs  || {};
        const conditions = (w.conditions || []).filter(c => c.field);
        const sorts      = (w.sorts     || []).filter(s => s.field);
        const anyAgg     = cols.some(c => fieldAggs[c]);

        // DISTINCT applies for non-aggregated table/bar/line/pie
        const needsDistinct = !anyAgg && ['table', 'bar', 'line', 'pie'].includes(w.type);

        if (!conditions.length && !sorts.length && !anyAgg) {
          if (!needsDistinct) return base;
          // Only DISTINCT needed — build minimal query
          const from2 = fromSrc || '?';
          const selD = cols.map(col => `[${col}]`);
          const sqlD = `SELECT DISTINCT ${selD.join(', ')} FROM ${from2}`;
          try {
            const rd = fromSrc ? alasql(sqlD) : alasql(sqlD, [base]);
            return Array.isArray(rd) ? rd : base;
          } catch (e) {
            console.warn('buildWidgetData DISTINCT error:', e.message);
            return base;
          }
        }

        // SELECT — preserve column name via AS so downstream code keeps working
        const selParts = cols.map(col => {
          const agg = fieldAggs[col];
          if (!agg) return `[${col}]`;
          if (agg === 'COUNT_DISTINCT') return `COUNT(DISTINCT [${col}]) AS [${col}]`;
          return `${agg}([${col}]) AS [${col}]`;
        });

        // WHERE — same logic as applyDesignTransforms / AQB node conditions
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

        // GROUP BY — auto-derived from non-aggregated columns when any agg is active
        const groupParts = anyAgg ? cols.filter(c => !fieldAggs[c]).map(c => `[${c}]`) : [];

        // ORDER BY
        const orderParts = sorts.map(s => `[${s.field}] ${s.dir || 'ASC'}`);

        // Use named view when available (no array binding needed); fall back to ?
        const from = fromSrc || '?';
        const selectKw = (needsDistinct && !anyAgg) ? 'SELECT DISTINCT' : 'SELECT';
        let sql = `${selectKw} ${selParts.join(', ')} FROM ${from}`;
        if (whereParts.length) sql += ` WHERE ${whereParts.join(' ')}`;
        if (groupParts.length) sql += ` GROUP BY ${groupParts.join(', ')}`;
        if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;

        try {
          const result = fromSrc ? alasql(sql) : alasql(sql, [base]);
          return Array.isArray(result) ? result : base;
        } catch (e) {
          console.warn('buildWidgetData error:', e.message, '|', sql);
          return base;
        }
      }

      function renderKPIContent(w) {
        let value = '—';
        const field = (w.fields && w.fields[0]) || '';
        const kpiData = buildWidgetData(w);
        if (kpiData && kpiData.length && field) {
          const fieldAgg = (w.fieldAggs || {})[field];
          if (fieldAgg) {
            value = kpiData[0][field] ?? '—';
          } else {
            const agg = w.aggregation || 'SUM';
            const vals = kpiData.map(r => parseFloat(r[field]) || 0);
            if (agg === 'COUNT') value = kpiData.length;
            else if (agg === 'SUM') value = vals.reduce((a, b) => a + b, 0).toLocaleString();
            else if (agg === 'AVG') value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—';
            else value = kpiData[0][field] ?? '—';
          }
        }
        const metricSize  = w.kpiMetricFontSize || 36;
        const labelSize   = w.kpiLabelFontSize  || 13;
        const labelText   = (w.kpiLabelOverride && w.kpiLabelOverride.trim()) ? w.kpiLabelOverride : field;
        return `<div class="kpi-card"><div class="kpi-value" style="color:${w.fillColor};font-size:${metricSize}px">${value}</div><div class="kpi-label" style="font-size:${labelSize}px">${labelText}</div></div>`;
      }


      function renderTableContent(w) {
        const tableData = buildWidgetData(w);
        if (!tableData || !tableData.length) {
          return '<div class="text-muted text-sm" style="padding:12px">No data — run a query first</div>';
        }
        const allCols = Object.keys(tableData[0]);
        const cols = w.fields.filter(f => allCols.includes(f));
        if (!cols.length) return '<div class="text-muted text-sm" style="padding:12px">No fields selected — add columns in the properties panel</div>';
        const hdrStyle = `background:${w.headersBackgroundColor||'#f3f2f1'};font-size:${w.headersFontSize||12}px;color:${w.headersFontColor||'#323130'}`;
        const thHtml = cols.map(c => `<th style="${hdrStyle}">${c}</th>`).join('');
        const theadHtml = w.showHeaders === false ? '' : `<thead><tr>${thHtml}</tr></thead>`;
        const drillField = cols[0];
        let html = `<div style="overflow:auto;max-height:100%"><table class="widget-table">${theadHtml}<tbody>`;
        for (const row of tableData) {
          const drillVal = String(row[drillField] ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
          html += `<tr style="cursor:pointer" title="Click to filter by ${drillField}" onclick="applyDrillFilter('${drillField.replace(/'/g,"\\'")}','${drillVal}')">`;
          html += cols.map(c => '<td>' + (row[c] != null ? row[c] : '') + '</td>').join('');
          html += '</tr>';
        }
        html += '</tbody></table></div>';
        return html;
      }


      // Linear regression (indexed x)
      function _chartOptLinReg(ys) {
  const n = ys.length;
  if (n < 2) return ys.map(function() { return null; });
  const sumX  = (n * (n - 1)) / 2;
  const sumY  = ys.reduce(function(a, b) { return a + b; }, 0);
  const sumXY = ys.reduce(function(s, y, i) { return s + i * y; }, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const denom = n * sumX2 - sumX * sumX;
  if (!denom) return ys.map(function() { return sumY / n; });
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return ys.map(function(unused, i) { return parseFloat((slope * i + intercept).toFixed(6)); });
}

  // Linear regression (numeric x values) for scatter
  function _chartOptLinRegXY(xs, ys) {
    const n = xs.length;
    if (n < 2) return [];
    const sumX  = xs.reduce(function(a, b) { return a + b; }, 0);
    const sumY  = ys.reduce(function(a, b) { return a + b; }, 0);
    const sumXY = xs.reduce(function(s, x, i) { return s + x * ys[i]; }, 0);
    const sumX2 = xs.reduce(function(s, x) { return s + x * x; }, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (!denom) return [];
    const slope     = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const minX = xs.reduce(function(a, b) { return a < b ? a : b; });
    const maxX = xs.reduce(function(a, b) { return a > b ? a : b; });
    return [
      [minX, parseFloat((slope * minX + intercept).toFixed(6))],
      [maxX, parseFloat((slope * maxX + intercept).toFixed(6))]
    ];
  }

function _buildChartOption(w, chartData) {
  if (!chartData || !chartData.length) return null;
  const allCols = Object.keys(chartData[0]);
  const xField  = w.xField || allCols[0] || '';

  const yFields = (Array.isArray(w.yFields) && w.yFields.length)
    ? w.yFields
    : (w.yField ? [w.yField] : (allCols.slice(1) || []));

  const colors = [
    w.fillColor || '#0078d4',
    '#e9950d','#107c10','#d13438','#8764b8',
    '#038387','#0078d4','#ff8c00','#e3008c','#00b7c3'
  ];

  const stacked       = !!w.stacked;
  const showTrendLine = !!w.showTrendLine;
  const ySeriesTypes  = w.ySeriesTypes || {};

  // ── BAR / LINE ────────────────────────────────────────────────────────────
  if (w.type === 'bar' || w.type === 'line') {
    var barSeries = [];

    for (var bi = 0; bi < yFields.length; bi++) {
      var byf = yFields[bi];
      var bst = ySeriesTypes[byf] || w.type;
      var bs  = {
        name      : byf,
        type      : bst,
        data      : chartData.map(function(r) { return parseFloat(r[byf]) || 0; }),
        itemStyle : { color: colors[bi % colors.length] }
      };
      if (bst === 'line') bs.smooth = true;
      if (stacked) bs.stack = 'total';
      barSeries.push(bs);

      if (showTrendLine) {
        var bvals  = chartData.map(function(r) { return parseFloat(r[byf]) || 0; });
        var bn     = bvals.length;
        var bsumX  = (bn * (bn - 1)) / 2;
        var bsumY  = 0;
        var bsumXY = 0;
        var bsumX2 = (bn * (bn - 1) * (2 * bn - 1)) / 6;
        for (var bti = 0; bti < bn; bti++) {
          bsumY  += bvals[bti];
          bsumXY += bti * bvals[bti];
        }
        var bdenom     = bn * bsumX2 - bsumX * bsumX;
        var btrendData = [];
        if (!bdenom || bn < 2) {
          for (var bti2 = 0; bti2 < bn; bti2++) {
            btrendData.push(bn > 0 ? bsumY / bn : 0);
          }
        } else {
          var bslope     = (bn * bsumXY - bsumX * bsumY) / bdenom;
          var bintercept = (bsumY - bslope * bsumX) / bn;
          for (var bti3 = 0; bti3 < bn; bti3++) {
            btrendData.push(parseFloat((bslope * bti3 + bintercept).toFixed(6)));
          }
        }
        barSeries.push({
          name      : byf + ' trend',
          type      : 'line',
          data      : btrendData,
          smooth    : false,
          symbol    : 'none',
          lineStyle : { type: 'dashed', color: colors[bi % colors.length], width: 2, opacity: 0.8 },
          itemStyle : { color: colors[bi % colors.length] },
          zlevel    : 10
        });
      }
    }

    var barHasLegend = yFields.length > 1 || showTrendLine;
    return {
      tooltip : { trigger: 'axis' },
      legend  : barHasLegend ? { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } } : undefined,
      xAxis   : { type: 'category', data: chartData.map(function(r) { return r[xField]; }), axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis   : { type: 'value' },
      series  : barSeries,
      grid    : { left: 40, right: 20, top: 20, bottom: barHasLegend ? 80 : 60 }
    };
  }

  // ── PIE ───────────────────────────────────────────────────────────────────
  if (w.type === 'pie') {
    if (yFields.length === 1) {
      return {
        tooltip : { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series  : [{
          type   : 'pie',
          data   : chartData.map(function(r) {
            return { name: String(r[xField] != null ? r[xField] : ''), value: parseFloat(r[yFields[0]]) || 0 };
          }),
          radius : ['30%', '65%'],
          label  : { fontSize: 11 }
        }]
      };
    }
    var pieStep = Math.floor(100 / yFields.length);
    return {
      tooltip : { trigger: 'item', formatter: '{a}<br/>{b}: {c} ({d}%)' },
      series  : yFields.map(function(pyf, pi) {
        return {
          name   : pyf,
          type   : 'pie',
          radius : ['20%', '40%'],
          center : [Math.round(pieStep * pi + pieStep / 2) + '%', '50%'],
          data   : chartData.map(function(r) {
            return { name: String(r[xField] != null ? r[xField] : ''), value: parseFloat(r[pyf]) || 0 };
          }),
          label  : { fontSize: 10, formatter: '{b}' }
        };
      })
    };
  }

  // ── SCATTER / BUBBLE ──────────────────────────────────────────────────────
  if (w.type === 'scatter') {
    var szField   = w.bubbleSizeField  || '';
    var clrField  = w.bubbleColorField || '';
    var hasBubble = szField  !== '';
    var hasClrFld = clrField !== '';

    // Bubble size scale
    var sizeVals = [];
    var maxSz    = 1;
    if (hasBubble) {
      for (var svi = 0; svi < chartData.length; svi++) {
        var sv = Math.abs(parseFloat(chartData[svi][szField]) || 0);
        sizeVals.push(sv);
        if (sv > maxSz) maxSz = sv;
      }
    }

    // Color field values for visualMap range
    var clrVals = [];
    var minC = 0;
    var maxC = 1;
    if (hasClrFld) {
      for (var cvi = 0; cvi < chartData.length; cvi++) {
        var cv = parseFloat(chartData[cvi][clrField]) || 0;
        clrVals.push(cv);
      }
      if (clrVals.length) {
        minC = clrVals[0];
        maxC = clrVals[0];
        for (var cvi2 = 1; cvi2 < clrVals.length; cvi2++) {
          if (clrVals[cvi2] < minC) minC = clrVals[cvi2];
          if (clrVals[cvi2] > maxC) maxC = clrVals[cvi2];
        }
      }
    }

    var scatterSeries = [];

    for (var sci = 0; sci < yFields.length; sci++) {
      var scyf    = yFields[sci];
      var scData  = [];
      for (var sdi = 0; sdi < chartData.length; sdi++) {
        var xv = parseFloat(chartData[sdi][xField])  || 0;
        var yv = parseFloat(chartData[sdi][scyf])    || 0;
        var szv = hasBubble  ? (sizeVals[sdi] || 0)                        : 0;
        var cv2  = hasClrFld ? (parseFloat(chartData[sdi][clrField]) || 0) : 0;
        if (hasBubble || hasClrFld) {
          scData.push([xv, yv, szv, cv2]);
        } else {
          scData.push([xv, yv]);
        }
      }

      var scSeries = {
        name      : scyf,
        type      : 'scatter',
        data      : scData,
        itemStyle : { color: colors[sci % colors.length], opacity: 0.75 }
      };

      if (hasBubble) {
        var scMaxSz = maxSz;
        scSeries.symbolSize = function(d) {
          return Math.max(6, Math.sqrt(Math.abs(d[2]) / scMaxSz) * 60);
        };
      } else {
        scSeries.symbolSize = 8;
      }

      scatterSeries.push(scSeries);

      if (showTrendLine) {
        var sxs  = [];
        var sys2 = [];
        for (var sti2 = 0; sti2 < chartData.length; sti2++) {
          sxs.push(parseFloat(chartData[sti2][xField]) || 0);
          sys2.push(parseFloat(chartData[sti2][scyf])  || 0);
        }
        var sn = sxs.length;
        if (sn >= 2) {
          var ssumX = 0, ssumY = 0, ssumXY = 0, ssumX2 = 0;
          for (var sti3 = 0; sti3 < sn; sti3++) {
            ssumX  += sxs[sti3];
            ssumY  += sys2[sti3];
            ssumXY += sxs[sti3] * sys2[sti3];
            ssumX2 += sxs[sti3] * sxs[sti3];
          }
          var sdenom = sn * ssumX2 - ssumX * ssumX;
          if (sdenom) {
            var sslope     = (sn * ssumXY - ssumX * ssumY) / sdenom;
            var sintercept = (ssumY - sslope * ssumX) / sn;
            var sminX = sxs[0];
            var smaxX = sxs[0];
            for (var smi = 1; smi < sn; smi++) {
              if (sxs[smi] < sminX) sminX = sxs[smi];
              if (sxs[smi] > smaxX) smaxX = sxs[smi];
            }
            scatterSeries.push({
              name      : scyf + ' trend',
              type      : 'line',
              data      : [
                [sminX, parseFloat((sslope * sminX + sintercept).toFixed(6))],
                [smaxX, parseFloat((sslope * smaxX + sintercept).toFixed(6))]
              ],
              smooth    : false,
              symbol    : 'none',
              lineStyle : { type: 'dashed', color: colors[sci % colors.length], width: 2, opacity: 0.8 },
              itemStyle : { color: colors[sci % colors.length] }
            });
          }
        }
      }
    }

    // Remove per-series itemStyle colors when visualMap controls coloring
    if (hasClrFld) {
      for (var vsi = 0; vsi < scatterSeries.length; vsi++) {
        if (scatterSeries[vsi].type === 'scatter') {
          delete scatterSeries[vsi].itemStyle;
        }
      }
    }

    var scHasLegend = yFields.length > 1 || showTrendLine;
    var scOption = {
      tooltip : { trigger: 'item' },
      legend  : scHasLegend ? { bottom: 0, textStyle: { fontSize: 11 } } : undefined,
      xAxis   : { type: 'value', name: xField, nameLocation: 'middle', nameGap: 28 },
      yAxis   : { type: 'value' },
      series  : scatterSeries,
      grid    : { left: 50, right: hasClrFld ? 80 : 20, top: 20, bottom: scHasLegend ? 60 : 40 }
    };

    if (hasClrFld) {
      var vmDimension = hasBubble ? 3 : 2;
      scOption.visualMap = {
        type      : 'continuous',
        min       : minC,
        max       : maxC,
        text      : [String(maxC), String(minC)],
        dimension : vmDimension,
        right     : 0,
        top       : 'middle',
        inRange   : { color: ['#91c7ae', '#d48265', '#ca8622'] },
        textStyle : { fontSize: 10 },
        itemWidth : 14
      };
    }

    return scOption;
  }

  return null;
}

      function renderChart(w) {
  const chartEl = document.getElementById('chart-' + w.id);
  if (!chartEl) return;
  if (DataLaVistaState.charts[w.id]) { try { DataLaVistaState.charts[w.id].dispose(); } catch(e){} }
  const chart = echarts.init(chartEl, null, { renderer: 'canvas' });
  DataLaVistaState.charts[w.id] = chart;
  const chartData = buildWidgetData(w);
  const option = _buildChartOption(w, chartData);
  if (!option) {
    chart.setOption({ backgroundColor: w.chartBackgroundColor || 'transparent', title: { text: 'No data', left: 'center', top: 'middle', textStyle: { color: '#a19f9d', fontSize: 13 } } });
    return;
  }
  option.backgroundColor = w.chartBackgroundColor || 'transparent';
  chart.setOption(option);
  // Cross-widget click filter
  chart.on('click', (params) => {
    if (params.componentType !== 'series') return;
    const filterField = w.xField;
    let filterValue = params.name; // works for bar/line/pie
    if (w.type === 'scatter' && Array.isArray(params.data)) filterValue = String(params.data[0]);
    if (filterField && filterValue != null) applyDrillFilter(filterField, String(filterValue));
  });
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
      // ============================================================
      // PER-WIDGET PROPERTY HANDLERS
      // Mirror the AQB advNode* functions, scoped to a widget.
      // ============================================================

      /** Re-renders both the properties panel and the widget canvas content. */
      function _widgetRefresh(wid) {
        renderWidgetProperties(wid);
        updateWidgetContent(wid);
      }

      function _renderYFieldsHTML(w, wid, cols) {
        const yfs = (Array.isArray(w.yFields) && w.yFields.length) ? w.yFields : (w.yField ? [w.yField] : []);
				
								   
        const isMixed = w.type === 'bar' || w.type === 'line';
        const yst = w.ySeriesTypes || {};
        let returnVal;

        if (!yfs.length) {
          returnVal = '<div style="font-size:11px;color:var(--text-disabled);padding:4px 0">No Y fields — click + Add</div>';
        } else {

            returnVal = yfs.map((yf, yi) => {
            const ti = DataLaVistaCore.FIELD_TYPE_ICONS[sniffType(yf)] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
												  
            const agg = (w.fieldAggs || {})[yf] || '';
            const escapedYf = yf.replace(/'/g, "\\'");

            const colOptions = cols.map(c => 
              '<option value="' + c + '"' + (c === yf ? ' selected' : '') + '>' + c + '</option>'
            ).join('');

            let mixedSelect = '';
            if (isMixed) {
              mixedSelect = '<select class="form-input" style="width:52px;height:22px;font-size:10px" title="Series type"'
                + ' onchange="widgetUpdateYSeriesType(\'' + wid + '\',\'' + escapedYf + '\',this.value)">'
                + '<option value=""' + (!yst[yf] ? ' selected' : '') + '>auto</option>'
                + '<option value="bar"' + (yst[yf] === 'bar' ? ' selected' : '') + '>bar</option>'
                + '<option value="line"' + (yst[yf] === 'line' ? ' selected' : '') + '>line</option>'
                + '</select>';
            }

            return '<div class="adv-field-row selected">'
              + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
              + '<select class="form-input" style="flex:1;height:22px;font-size:11px"'
              + ' onchange="widgetUpdateYField(\'' + wid + '\',' + yi + ',this.value)">'
              + colOptions + '</select>'
              + mixedSelect
              + '<button class="adv-agg-btn' + (agg ? ' has-agg' : '') + '" title="' + (agg || 'No aggregate') + '"'
              + ' onclick="event.stopPropagation();showWidgetFieldAggPopup(\'' + wid + '\',\'' + escapedYf + '\',this)">'
              + (agg ? getAggIcon(agg) : '∑') + '</button>'
              + '<button class="btn btn-ghost btn-sm btn-icon" style="padding:0 4px"'
              + ' onclick="widgetRemoveYField(\'' + wid + '\',' + yi + ')">✕</button>'
              + '</div>';
          }).join('');
        }

        return returnVal;
      }

function _renderScatterOptionsHTML(w, wid, cols) {
  if (w.type !== 'scatter') return '';
  const _scatterFieldRow = (label, propName, currentField) => {
    const opts = cols.map(c => '<option value="' + c + '"' + (c === currentField ? ' selected' : '') + '>' + c + '</option>').join('');
    const agg  = currentField ? ((w.fieldAggs || {})[currentField] || '') : '';
    const aggBtn = currentField
      ? '<button class="adv-agg-btn' + (agg ? ' has-agg' : '') + '" title="' + (agg || 'No aggregate') + '"'
        + ' onclick="event.stopPropagation();showWidgetFieldAggPopup(\'' + wid + '\',\'' + currentField.replace(/'/g, "\\'") + '\',this)">'
        + (agg ? getAggIcon(agg) : '∑') + '</button>'
      : '';
    return '<div class="props-row"><label>' + label + '</label>'
      + '<div style="display:flex;gap:4px;flex:1">'
      + '<select class="form-input" style="flex:1;height:22px;font-size:11px"'
      + ' onchange="updateWidgetProp(\'' + wid + '\',\'' + propName + '\',this.value);renderWidgetProperties(\'' + wid + '\')">'
      + '<option value="">(none)</option>' + opts + '</select>'
      + aggBtn + '</div></div>';
  };
  return '<div class="adv-node-section-hdr" style="margin-top:8px"><span>BUBBLE / COLOR</span></div>'
    + _scatterFieldRow('Size field',  'bubbleSizeField',  w.bubbleSizeField)
    + _scatterFieldRow('Color field', 'bubbleColorField', w.bubbleColorField)
    + '<div class="props-row"><label>Trend lines</label>'
    + '<input type="checkbox"' + (w.showTrendLine ? ' checked' : '') + ' onchange="updateWidgetProp(\'' + wid + '\',\'showTrendLine\',this.checked)"/></div>';
}

function _renderBarLineOptionsHTML(w, wid) {
  if (w.type !== 'bar' && w.type !== 'line') return '';
  return '<div class="adv-node-section-hdr" style="margin-top:8px"><span>CHART OPTIONS</span></div>'
    + '<div class="props-row"><label>Stacked</label>'
    + '<input type="checkbox"' + (w.stacked ? ' checked' : '') + ' onchange="updateWidgetProp(\'' + wid + '\',\'stacked\',this.checked)"/></div>'
    + '<div class="props-row"><label>Trend lines</label>'
    + '<input type="checkbox"' + (w.showTrendLine ? ' checked' : '') + ' onchange="updateWidgetProp(\'' + wid + '\',\'showTrendLine\',this.checked)"/></div>';
}

      /** Opens an aggregate-picker popup anchored to btn, for a specific widget field. */
      function showWidgetFieldAggPopup(wid, field, btn) {
        document.querySelectorAll('.adv-agg-popup').forEach(p => p.remove());
        const dt = sniffType(field);
        const aggs = aggsForType(dt);
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        const current = w ? ((w.fieldAggs || {})[field] || '') : '';
        const popup = document.createElement('div');
        popup.className = 'adv-agg-popup';
        popup.innerHTML = aggs.map(a =>
          `<div class="agg-opt${a.val === current ? ' selected' : ''}"
            onclick="setWidgetFieldAgg('${wid}','${field.replace(/'/g,"\\'")}','${a.val}');document.querySelectorAll('.adv-agg-popup').forEach(p=>p.remove())">${a.label}</div>`
        ).join('');
        document.body.appendChild(popup);
        const rect = btn.getBoundingClientRect();
        popup.style.top  = (rect.bottom + 2) + 'px';
        popup.style.left = Math.max(0, rect.left - popup.offsetWidth + rect.width) + 'px';
        setTimeout(() => {
          document.addEventListener('click', function close(e) {
            if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', close); }
          });
        }, 10);
      }

      /** Sets (or clears) a per-field aggregate on a widget, then refreshes. */
      function setWidgetFieldAgg(wid, field, agg) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        if (!w.fieldAggs) w.fieldAggs = {};
        if (agg) w.fieldAggs[field] = agg;
        else delete w.fieldAggs[field];
        _widgetRefresh(wid);
      }

      // ── Per-widget conditions ────────────────────────────────────────────

      function widgetAddCond(wid) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !DataLaVistaState.queryColumns.length) return;
        if (!w.conditions) w.conditions = [];
        w.conditions.push({ conj: 'AND', field: DataLaVistaState.queryColumns[0], op: '=', value: '' });
        renderWidgetProperties(wid);
      }

      function widgetRemoveCond(wid, idx) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w.conditions.splice(idx, 1);
        _widgetRefresh(wid);
      }

      function widgetUpdateCond(wid, idx, prop, val) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !w.conditions[idx]) return;
        w.conditions[idx][prop] = val;
        if (prop === 'op') renderWidgetProperties(wid); // re-render to toggle value input
        else updateWidgetContent(wid);
      }

      // ── Per-widget sorts ─────────────────────────────────────────────────

      function widgetAddSort(wid) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !DataLaVistaState.queryColumns.length) return;
        if (!w.sorts) w.sorts = [];
        w.sorts.push({ field: DataLaVistaState.queryColumns[0], dir: 'ASC' });
        renderWidgetProperties(wid);
      }

      function widgetRemoveSort(wid, idx) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w.sorts.splice(idx, 1);
        _widgetRefresh(wid);
      }

      function widgetUpdateSort(wid, idx, prop, val) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !w.sorts[idx]) return;
        w.sorts[idx][prop] = val;
        updateWidgetContent(wid);
      }

      function renderWidgetProperties(wid) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const section = document.getElementById('props-section');

        const isChart = ['bar', 'line', 'pie', 'scatter'].includes(w.type);
        const isKPI   = w.type === 'kpi';
        const isTable = w.type === 'table';
        const isText  = w.type === 'text';
        const isData  = isChart || isKPI || isTable;

        const cols       = DataLaVistaState.queryColumns;
        const fieldAggs  = w.fieldAggs  || {};
        const conditions = w.conditions || [];
        const sorts      = w.sorts      || [];

        // ── Field row: type-icon + label + field-selector + ∑ agg button ──
        const fieldRow = (roleLabel, fieldVal, onChangeExpr) => {
          const dt  = sniffType(fieldVal || '');
          const ti  = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const agg = fieldAggs[fieldVal] || '';
          return `
            <div class="adv-field-row selected">
              <span class="field-type-icon ${ti.cls}">${ti.icon}</span>
              <span style="font-size:11px;color:var(--text-disabled);flex-shrink:0;min-width:16px">${roleLabel}</span>
              <select class="form-input" style="flex:1;height:22px;font-size:11px" onchange="${onChangeExpr}">
                ${cols.map(c => `<option value="${c}" ${c === fieldVal ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <button class="adv-agg-btn${agg ? ' has-agg' : ''}" title="${agg || 'No aggregate'}"
                onclick="event.stopPropagation();showWidgetFieldAggPopup('${wid}','${(fieldVal||'').replace(/'/g,"\\'")}',this)">${agg ? getAggIcon(agg) : '∑'}</button>
            </div>`;
        };

        // ── Table column row: type-icon + name + ∑ agg button + remove ──
        const tableFieldRow = (fieldName, idx) => {
          const dt  = sniffType(fieldName);
          const ti  = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const agg = fieldAggs[fieldName] || '';
          return `
            <div class="adv-field-row selected">
              <span class="field-type-icon ${ti.cls}">${ti.icon}</span>
              <span class="field-name" style="flex:1">${fieldName}</span>
              <button class="adv-agg-btn${agg ? ' has-agg' : ''}" title="${agg || 'No aggregate'}"
                onclick="event.stopPropagation();showWidgetFieldAggPopup('${wid}','${fieldName.replace(/'/g,"\\'")}',this)">${agg ? getAggIcon(agg) : '∑'}</button>
              <button class="btn btn-ghost btn-sm btn-icon" style="padding:0 4px" onclick="removeWidgetField('${wid}',${idx})">✕</button>
            </div>`;
        };

        // ── Filter conditions ────────────────────────────────────────────
        const renderConditions = () => {
          if (!conditions.length)
            return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No filters — click + Add</div>';
          return conditions.map((c, ci) => {
            const isDate = sniffType(c.field) === 'date';
            const ops    = isDate ? [...QB_OPS, ...DataLaVistaCore.DATE_MACRO_OPS] : QB_OPS;
            const isMacro    = DataLaVistaCore.DATE_MACRO_VALS.has(c.op);
            const macroMeta  = DataLaVistaCore.DATE_MACRO_OPS.find(o => o.val === c.op);
            const needsValue = c.op !== 'NULL' && c.op !== 'NOTNULL' && !(isMacro && !macroMeta?.hasInput);
            return `<div class="qb-condition-row">
              ${ci === 0
                ? `<span class="qb-where-badge">WHERE</span>`
                : `<select class="form-input qb-conj-select" onchange="widgetUpdateCond('${wid}',${ci},'conj',this.value)">
                    <option ${c.conj==='AND'?'selected':''}>AND</option>
                    <option ${c.conj==='OR'?'selected':''}>OR</option></select>`}
              <select class="form-input qb-field-select" onchange="widgetUpdateCond('${wid}',${ci},'field',this.value)">
                ${cols.map(col=>`<option value="${col}" ${col===c.field?'selected':''}>${col}</option>`).join('')}
              </select>
              <select class="form-input qb-op-select" style="width:${isDate?'150px':'112px'}!important"
                onchange="widgetUpdateCond('${wid}',${ci},'op',this.value)">
                ${ops.map(o=>`<option value="${o.val}" ${o.val===c.op?'selected':''}>${o.label}</option>`).join('')}
              </select>
              ${needsValue
                ? `<input type="${isMacro?'number':'text'}" class="form-input qb-val-input" value="${(c.value||'').replace(/"/g,'&quot;')}"
                     oninput="widgetUpdateCond('${wid}',${ci},'value',this.value)"/>`
                : `<span class="qb-val-blank"></span>`}
              <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="widgetRemoveCond('${wid}',${ci})">✕</button>
            </div>`;
          }).join('');
        };

        // ── Sort rows ────────────────────────────────────────────────────
        const renderSorts = () => {
          if (!sorts.length)
            return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No sorts — click + Add</div>';
          return sorts.map((s, si) => `
            <div class="qb-sort-row">
              <select class="form-input qb-field-select" onchange="widgetUpdateSort('${wid}',${si},'field',this.value)">
                ${cols.map(col=>`<option value="${col}" ${col===s.field?'selected':''}>${col}</option>`).join('')}
              </select>
              <select class="form-input qb-dir-select" onchange="widgetUpdateSort('${wid}',${si},'dir',this.value)">
                <option ${s.dir==='ASC'?'selected':''}>ASC</option>
                <option ${s.dir==='DESC'?'selected':''}>DESC</option>
              </select>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="widgetRemoveSort('${wid}',${si})">✕</button>
            </div>`).join('');
        };

        // ── Group-by (auto-derived, read-only display) ───────────────────
        const activeCols  = isChart ? [w.xField, w.yField].filter(Boolean) : (w.fields || []);
        const anyAgg      = activeCols.some(f => fieldAggs[f]);
        const nonAggCols  = activeCols.filter(f => !fieldAggs[f]);
        const renderGroupBy = () => {
          if (!anyAgg) return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Set aggregates on fields above to enable grouping</div>';
          if (!nonAggCols.length) return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All fields aggregated — no GROUP BY needed</div>';
          return `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${nonAggCols.join(', ')}</div>`;
        };

        section.innerHTML = `
          <div class="adv-node-section">
            <div class="adv-node-section-hdr">GENERAL</div>
            <div class="props-row"><label>Title</label>
              <input type="text" class="form-input" value="${w.title.replace(/"/g,'&quot;')}" oninput="updateWidgetProp('${wid}','title',this.value)"/></div>
            <div class="props-row"><label>Show title</label>
              <input type="checkbox" ${w.showTitle!==false?'checked':''} onchange="updateWidgetProp('${wid}','showTitle',this.checked)"/></div>
            ${isTable ? `<div class="props-row"><label>Show headers</label>
              <input type="checkbox" ${w.showHeaders!==false?'checked':''} onchange="updateWidgetProp('${wid}','showHeaders',this.checked)"/></div>` : ''}
            <div class="props-row"><label>Type</label>
              <select class="form-input" onchange="changeWidgetType('${wid}',this.value)">
                ${WIDGET_TYPES.map(t=>`<option value="${t.id}" ${t.id===w.type?'selected':''}>${t.label}</option>`).join('')}
              </select></div>
            <div class="props-row"><label>Width %</label>
              <input type="number" class="form-input" min="10" max="100" value="${w.widthPct}" oninput="updateWidgetProp('${wid}','widthPct',+this.value)"/></div>
            <div class="props-row"><label>Height vh</label>
              <input type="number" class="form-input" min="5" max="100" value="${w.heightVh}" oninput="updateWidgetProp('${wid}','heightVh',+this.value)"/></div>
          </div>

          <div class="adv-node-section">
            <div class="adv-node-section-hdr">APPEARANCE</div>
            <div class="props-row"><label>Widget bg</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.widgetBackgroundColor||'#fefefe'}" oninput="updateWidgetProp('${wid}','widgetBackgroundColor',this.value)"/>
                <input type="text" class="form-input" value="${w.widgetBackgroundColor||'#fefefe'}" oninput="updateWidgetProp('${wid}','widgetBackgroundColor',this.value)"/>
              </div></div>
            <div class="props-row"><label>Title bg</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.titleBackgroundColor||'#fefefe'}" oninput="updateWidgetProp('${wid}','titleBackgroundColor',this.value)"/>
                <input type="text" class="form-input" value="${w.titleBackgroundColor||'#fefefe'}" oninput="updateWidgetProp('${wid}','titleBackgroundColor',this.value)"/>
              </div></div>
            <div class="props-row"><label>Title font</label>
              <div class="color-input-wrap">
                <input type="number" class="form-input" min="8" max="48" value="${w.titleFontSize||14}" oninput="updateWidgetProp('${wid}','titleFontSize',+this.value)" style="width:50px" title="Title font size"/>
                <input type="color" value="${w.titleFontColor||'#323130'}" oninput="updateWidgetProp('${wid}','titleFontColor',this.value)" title="Title font color"/>
                <input type="text" class="form-input" value="${w.titleFontColor||'#323130'}" oninput="updateWidgetProp('${wid}','titleFontColor',this.value)"/>
              </div></div>
            <div class="props-row"><label>Fill/Accent</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.fillColor}" oninput="updateWidgetProp('${wid}','fillColor',this.value)"/>
                <input type="text" class="form-input" value="${w.fillColor}" oninput="updateWidgetProp('${wid}','fillColor',this.value)"/>
              </div></div>
            <div class="props-row"><label>Border</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.borderColor}" oninput="updateWidgetProp('${wid}','borderColor',this.value)"/>
                <input type="number" class="form-input" value="${w.borderSize}" min="0" max="10" oninput="updateWidgetProp('${wid}','borderSize',+this.value)" style="width:50px"/>
              </div></div>
            ${isChart ? `<div class="props-row"><label>Chart bg</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.chartBackgroundColor||'#fefefe'}" oninput="updateWidgetProp('${wid}','chartBackgroundColor',this.value)"/>
                <input type="text" class="form-input" value="${w.chartBackgroundColor||'#fefefe'}" oninput="updateWidgetProp('${wid}','chartBackgroundColor',this.value)"/>
              </div></div>` : ''}
            ${isTable ? `
            <div class="props-row"><label>Header bg</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.headersBackgroundColor||'#f3f2f1'}" oninput="updateWidgetProp('${wid}','headersBackgroundColor',this.value)"/>
                <input type="text" class="form-input" value="${w.headersBackgroundColor||'#f3f2f1'}" oninput="updateWidgetProp('${wid}','headersBackgroundColor',this.value)"/>
              </div></div>
            <div class="props-row"><label>Header font</label>
              <div class="color-input-wrap">
                <input type="number" class="form-input" min="8" max="32" value="${w.headersFontSize||12}" oninput="updateWidgetProp('${wid}','headersFontSize',+this.value)" style="width:50px" title="Header font size"/>
                <input type="color" value="${w.headersFontColor||'#323130'}" oninput="updateWidgetProp('${wid}','headersFontColor',this.value)" title="Header font color"/>
                <input type="text" class="form-input" value="${w.headersFontColor||'#323130'}" oninput="updateWidgetProp('${wid}','headersFontColor',this.value)"/>
              </div></div>
            ` : ''}
            ${isText ? `
            <div class="props-row"><label>Font size</label>
              <input type="number" class="form-input" min="8" max="72" value="${w.fontSize}" oninput="updateWidgetProp('${wid}','fontSize',+this.value)"/></div>
            <div class="props-row"><label>Font color</label>
              <div class="color-input-wrap">
                <input type="color" value="${w.fontColor}" oninput="updateWidgetProp('${wid}','fontColor',this.value)"/>
                <input type="text" class="form-input" value="${w.fontColor}" oninput="updateWidgetProp('${wid}','fontColor',this.value)"/>
              </div></div>
            <div class="props-row" style="flex-direction:column;align-items:flex-start"><label>Content</label>
              <textarea class="form-input" rows="4" oninput="updateWidgetProp('${wid}','textContent',this.value)">${w.textContent}</textarea></div>
            ` : ''}
          </div>

          ${isData ? `
          <div class="adv-node-section">
            <div class="adv-node-section-hdr">
              <span>FIELDS</span>
            </div>
						 
            ${isChart ? fieldRow('X', w.xField, `updateWidgetProp('${wid}','xField',this.value);renderWidgetProperties('${wid}')`)
          + '<div class="adv-node-section-hdr" style="margin-top:6px"><span>Y FIELDS</span>'
						 
          + '<button class="btn btn-ghost btn-sm" onclick="widgetAddYField(\'' + wid + '\')">+ Add</button></div>'
          + _renderYFieldsHTML(w, wid, cols)
          + _renderBarLineOptionsHTML(w, wid)
          + _renderScatterOptionsHTML(w, wid, cols)
        : ''}
							 
											  
																																																													   
																				
																	   
																								   
					 
																																
																																															
																			   
																	   
						   
																												 
	   
	   
            ${isKPI ? fieldRow('', w.fields[0] || cols[0] || '', `updateWidgetProp('${wid}','fields',[this.value]);renderWidgetProperties('${wid}')`)
              + `<div class="adv-node-section-hdr" style="margin-top:8px"><span>KPI DISPLAY</span></div>
              <div class="props-row"><label>Metric size</label>
                <input type="number" class="form-input" min="8" max="120" value="${w.kpiMetricFontSize||36}" oninput="updateWidgetProp('${wid}','kpiMetricFontSize',+this.value)" style="width:60px"/></div>
              <div class="props-row"><label>Label size</label>
                <input type="number" class="form-input" min="8" max="48" value="${w.kpiLabelFontSize||13}" oninput="updateWidgetProp('${wid}','kpiLabelFontSize',+this.value)" style="width:60px"/></div>
              <div class="props-row"><label>Label text</label>
                <input type="text" class="form-input" value="${(w.kpiLabelOverride||'').replace(/"/g,'&quot;')}" placeholder="${(w.fields[0]||'field name').replace(/"/g,'&quot;')}" oninput="updateWidgetProp('${wid}','kpiLabelOverride',this.value)"/></div>`
            : ''}
            ${isTable ? (w.fields.length
                ? w.fields.map((f,i) => tableFieldRow(f,i)).join('')
                : `<div style="font-size:11px;color:var(--text-disabled);padding:4px 0">Drop fields from the left panel</div>`) : ''}
            ${isTable ? `
            <div class="adv-drop-zone" style="margin-top:4px;text-align:center;padding:5px;font-size:11px"
              ondragover="event.preventDefault();this.classList.add('drag-over')"
              ondragleave="this.classList.remove('drag-over')"
              ondrop="onDropFieldToWidget('${wid}',event)">Drop field to add column</div>
            ` : ''}
          </div>

          <div class="adv-node-section">
            <div class="adv-node-section-hdr">
              <span>FILTER CONDITIONS</span>
              <button class="btn btn-ghost btn-sm" onclick="widgetAddCond('${wid}')">+ Add</button>
            </div>
            <div>${renderConditions()}</div>
          </div>

          <div class="adv-node-section">
            <div class="adv-node-section-hdr">
              <span>SORT ORDER</span>
              <button class="btn btn-ghost btn-sm" onclick="widgetAddSort('${wid}')">+ Add</button>
            </div>
            <div>${renderSorts()}</div>
          </div>

          <div class="adv-node-section">
            <div class="adv-node-section-hdr"><span>GROUP BY</span></div>
            <div>${renderGroupBy()}</div>
          </div>
          ` : ''}
        `;
      }


      function updateWidgetProp(wid, prop, value) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        w[prop] = value;
        // Live-update element
        const el = document.getElementById('widget-' + wid);
        if (!el) return;
        const hdr = el.querySelector('.widget-header');
        const titleEl = el.querySelector('.widget-title');

        if (prop === 'title' && titleEl) titleEl.textContent = value;
        if (prop === 'showTitle' && hdr) { hdr.hidden = !value; hdr.style.opacity = value ? '' : '0.3'; }
        if (prop === 'widthPct') el.style.width = value + '%';
        if (prop === 'heightVh') { el.style.height = value + 'vh'; if (DataLaVistaState.charts[wid]) DataLaVistaState.charts[wid].resize(); }
        if (prop === 'borderColor') el.style.borderColor = value;
        if (prop === 'borderSize') el.style.borderWidth = value + 'px';
        if (prop === 'widgetBackgroundColor') el.style.background = value;
        if (prop === 'titleBackgroundColor' && hdr) hdr.style.background = value;
        if (prop === 'titleFontSize' && hdr) hdr.style.fontSize = value + 'px';
        if (prop === 'titleFontColor' && hdr) hdr.style.color = value;
        if (prop === 'textContent' && w.type === 'text') el.querySelector('.text-widget').innerHTML = value;
        if (prop === 'fontSize' && w.type === 'text') el.querySelector('.text-widget').style.fontSize = value + 'px';
        if (prop === 'fontColor' && w.type === 'text') el.querySelector('.text-widget').style.color = value;
        // Table-specific: re-render for header style / visibility changes
        if (['showHeaders','headersBackgroundColor','headersFontSize','headersFontColor','fields'].includes(prop) && w.type === 'table')
          el.querySelector('.widget-content').innerHTML = renderTableContent(w);
        if (['xField', 'yField', 'yFields', 'aggregation', 'fieldAggs', 'fillColor', 'fields',
             'stacked', 'showTrendLine', 'ySeriesTypes', 'bubbleSizeField', 'bubbleColorField',
             'chartBackgroundColor'].includes(prop) && ['bar', 'line', 'pie', 'scatter'].includes(w.type)) renderChart(w);
        if (['xField', 'yField', 'aggregation', 'fieldAggs', 'fillColor', 'fields',
             'kpiMetricFontSize', 'kpiLabelFontSize', 'kpiLabelOverride'].includes(prop) && w.type === 'kpi')
          el.querySelector('.widget-content').innerHTML = renderKPIContent(w);
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
          if (alasql.tables && alasql.tables['dlv_results']) {
            uniqueVals = [...new Set(alasql('SELECT * FROM [dlv_results]').map(r => r[f.field]).filter(v => v !== null && v !== undefined))].sort();
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
        // Append any active drill filter chips
        _renderDrillChipsIn('filter-drop-zone');
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
        const hasView = !!(alasql.tables && alasql.tables['dlv_results']);
        if (hasView) {
          const allFilters = { ...(DataLaVistaState.previewFilters || {}), ...(DataLaVistaState.drillFilters || {}) };
          const whereClauses = Object.entries(allFilters).map(([f, v]) => `[${f}] = '${String(v).replace(/'/g, "''")}'`);
          alasql('DROP VIEW IF EXISTS [dlv_active]');
          const where = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';
          alasql(`CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results]${where}`);
          DataLaVistaState.design.previewFilteredData = null;
        } else {
          DataLaVistaState.design.previewFilteredData = null;
        }
        DataLaVistaState.design.widgets.forEach(w => updateWidgetContent(w.id));
      }

      // ============================================================
      // CROSS-WIDGET DRILL FILTER (click-to-filter)
      // ============================================================

      /** Apply a drill filter from a chart/table click, rebuild active view, re-render all widgets. */
      function applyDrillFilter(field, value) {
        if (!DataLaVistaState.drillFilters) DataLaVistaState.drillFilters = {};
        DataLaVistaState.drillFilters[field] = value;
        _rebuildActiveView();
        _renderAllDrillChips();
        DataLaVistaState.design.widgets.forEach(w => updateWidgetContent(w.id));
        // Also update preview canvas if it's populated
        _refreshPreviewCanvasWidgets();
      }

      function clearDrillFilter(field) {
        if (DataLaVistaState.drillFilters) delete DataLaVistaState.drillFilters[field];
        _rebuildActiveView();
        _renderAllDrillChips();
        DataLaVistaState.design.widgets.forEach(w => updateWidgetContent(w.id));
        _refreshPreviewCanvasWidgets();
      }

      function clearAllDrillFilters() {
        DataLaVistaState.drillFilters = {};
        _rebuildActiveView();
        _renderAllDrillChips();
        DataLaVistaState.design.widgets.forEach(w => updateWidgetContent(w.id));
        _refreshPreviewCanvasWidgets();
      }

      /** Rebuild [dlv_active] using combined previewFilters + drillFilters. */
      function _rebuildActiveView() {
        if (!(alasql.tables && alasql.tables['dlv_results'])) return;
        const allFilters = { ...(DataLaVistaState.previewFilters || {}), ...(DataLaVistaState.drillFilters || {}) };
        alasql('DROP VIEW IF EXISTS [dlv_active]');
        const whereClauses = Object.entries(allFilters).map(([f, v]) => `[${f}] = '${String(v).replace(/'/g, "''")}'`);
        const where = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';
        alasql(`CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results]${where}`);
        DataLaVistaState.design.previewFilteredData = null;
      }

      /** Render drill chips into both design and preview filter bars. */
      function _renderAllDrillChips() {
        _renderDrillChipsIn('filter-drop-zone');
        _renderDrillChipsIn('preview-filter-bar');
      }

      function _renderDrillChipsIn(barId) {
        const bar = document.getElementById(barId);
        if (!bar) return;
        // Remove stale drill chips
        bar.querySelectorAll('.dlv-drill-chip').forEach(el => el.remove());
        const drills = Object.entries(DataLaVistaState.drillFilters || {});
        if (!drills.length) return;
        bar.classList.remove('hidden');
        for (const [field, value] of drills) {
          const chip = document.createElement('div');
          chip.className = 'filter-pill dlv-drill-chip';
          chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:var(--accent-light,#deecf9);border:1px solid var(--accent,#0078d4);padding:4px 8px;border-radius:var(--radius,4px)';
          const safeField = field.replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const safeValue = String(value).replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const escField  = field.replace(/'/g,"\\'");
          chip.innerHTML = `<span style="font-size:10px">🔍</span>`
            + `<span style="font-size:12px;font-weight:600;color:var(--accent,#0078d4)">${safeField}</span>`
            + `<span style="font-size:11px;color:var(--text-secondary)">=</span>`
            + `<span style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safeValue}">${safeValue}</span>`
            + `<button class="btn btn-ghost btn-sm btn-icon" style="padding:0 2px;font-size:10px" title="Clear drill filter for ${safeField}" onclick="clearDrillFilter('${escField}')">✕</button>`;
          bar.appendChild(chip);
        }
        // Show "clear all" if >1 drill
        if (drills.length > 1) {
          const clearAll = document.createElement('button');
          clearAll.className = 'btn btn-ghost btn-sm dlv-drill-chip';
          clearAll.style.cssText = 'font-size:11px;color:var(--accent,#0078d4)';
          clearAll.textContent = 'Clear all filters';
          clearAll.onclick = () => clearAllDrillFilters();
          bar.appendChild(clearAll);
        }
      }

      /** Re-render preview canvas widgets in-place after a drill filter change. */
      function _refreshPreviewCanvasWidgets() {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas || !canvas.querySelector('.widget')) return;
        const widgetEls = canvas.querySelectorAll('.widget');
        DataLaVistaState.design.widgets.forEach((w, i) => {
          const el = widgetEls[i];
          if (!el) return;
          const content = el.querySelector('.widget-content');
          if (!content) return;
          content.innerHTML = getPrevWidgetContent(w);
          if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
            requestAnimationFrame(() => renderPreviewChart(w));
          }
        });
      }

      function widgetAddYField(wid) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w || !DataLaVistaState.queryColumns.length) return;
  if (!Array.isArray(w.yFields)) w.yFields = w.yField ? [w.yField] : [];
  // Default to first numeric col not already added
  const next = DataLaVistaState.queryColumns.find(c =>
    sniffType(c) === 'number' && !w.yFields.includes(c)
  ) || DataLaVistaState.queryColumns.find(c => !w.yFields.includes(c))
    || DataLaVistaState.queryColumns[0];
  if (next) w.yFields.push(next);
  _widgetRefresh(wid);
}

function widgetUpdateYField(wid, idx, val) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w || !Array.isArray(w.yFields)) return;
  w.yFields[idx] = val;
  _widgetRefresh(wid);
}

function widgetRemoveYField(wid, idx) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w || !Array.isArray(w.yFields)) return;
  w.yFields.splice(idx, 1);
  _widgetRefresh(wid);
}

function widgetUpdateYSeriesType(wid, fieldName, seriesType) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w) return;
  if (!w.ySeriesTypes) w.ySeriesTypes = {};
  if (seriesType) w.ySeriesTypes[fieldName] = seriesType;
  else delete w.ySeriesTypes[fieldName];
  _widgetRefresh(wid);
}