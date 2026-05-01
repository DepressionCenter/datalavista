/* ============================================================
This file is part of DataLaVista™
60-design.js: Design canvas, widget rendering, data transforms, and widget properties.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
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

  // ============================================================
  // HTML SANITIZER  (strip scripts / event handlers; allow safe markup)
  // Used for dashboard title tooltip which accepts user-supplied HTML.
  // ============================================================
  function sanitizeHTML(html) {
    if (!html) return '';
    let doc;
    try {
      doc = (new DOMParser()).parseFromString('<div>' + html + '</div>', 'text/html');
    } catch (e) {
      return '';
    }
    const ALLOWED = new Set(['p','br','b','i','strong','em','span','div','ul','ol','li',
      'a','h1','h2','h3','h4','h5','h6','code','pre','hr','table','tr','td','th',
      'thead','tbody','small','sup','sub','mark','blockquote']);
    const BLOCKED = new Set(['script','iframe','object','embed','form','input','button',
      'style','link','meta','base','frame','frameset','noscript','template']);
    const SAFE_ATTRS = new Set(['href','title','target','class','style','rel',
      'colspan','rowspan','width','height','alt','id']);

    function clean(node) {
      if (node.nodeType === 3) return document.createTextNode(node.textContent);
      if (node.nodeType !== 1) return null;
      const tag = node.tagName.toLowerCase();
      if (BLOCKED.has(tag)) return null;
      const out = document.createElement(ALLOWED.has(tag) ? tag : 'span');
      for (const attr of Array.from(node.attributes)) {
        const n = attr.name.toLowerCase();
        if (n.startsWith('on')) continue;
        if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(attr.value)) continue;
        if (SAFE_ATTRS.has(n)) out.setAttribute(n, attr.value);
      }
      // Force links to open safely
      if (tag === 'a') { out.setAttribute('target', '_blank'); out.setAttribute('rel', 'noopener noreferrer'); }
      for (const child of Array.from(node.childNodes)) {
        const c = clean(child);
        if (c) out.appendChild(c);
      }
      return out;
    }

    const root = doc.body.firstChild;
    if (!root) return '';
    const cleaned = clean(root);
    return cleaned ? cleaned.innerHTML : '';
  }

  // ============================================================
  // DASHBOARD TITLE PROPERTIES PANEL
  // Shown when the user clicks the title-input element in design mode.
  // ============================================================

  /** Update an inline info-icon next to title-input when a tooltip is configured. */
  function updateDashboardTitleTooltipIcon() {
    const titleBar = document.getElementById('title-bar');
    if (!titleBar) return;
    let icon = document.getElementById('dlv-title-tooltip-icon');
    const tip = DataLaVistaState.design.dashboardTitleTooltip || '';
    if (!tip.trim()) {
      if (icon) icon.remove();
      return;
    }
    if (!icon) {
      icon = document.createElement('span');
      icon.id = 'dlv-title-tooltip-icon';
      icon.style.cssText = 'font-size:11px;cursor:help;vertical-align:super;margin-left:4px;user-select:none;opacity:0.7';
      icon.textContent = 'ℹ️';
      const inp = document.getElementById('title-input');
      if (inp) inp.parentNode.insertBefore(icon, inp.nextSibling);
      else titleBar.appendChild(icon);
    }
    dlvTooltip.update(icon, sanitizeHTML(tip), { placement: 'bottom', maxWidth: '400px', delay: 200 });
    dlvTooltip.attach(icon, sanitizeHTML(tip), { placement: 'bottom', maxWidth: '400px', delay: 200 });
  }

  function updateDashboardTitleProp(prop, value) {
    if (prop === 'showDashboardTitle') {
      DataLaVistaState.design.showDashboardTitle = value;
    } else if (prop === 'title') {
      DataLaVistaState.design.title = value;
      const inp = document.getElementById('title-input');
      if (inp && inp.value !== value) inp.value = value;
    } else if (prop === 'dashboardTitleTooltip') {
      DataLaVistaState.design.dashboardTitleTooltip = value;
      updateDashboardTitleTooltipIcon();
    } else if (prop === 'interactionMode') {
      DataLaVistaState.design.interactionMode = value;
    } else if (prop === 'themePaletteColor') {
      // value = { index, color }
      if (!DataLaVistaState.design.theme) DataLaVistaState.design.theme = { palette: [], fontFamily: '', fontSize: null, backgroundColor: '' };
      while (DataLaVistaState.design.theme.palette.length <= value.index) DataLaVistaState.design.theme.palette.push('');
      DataLaVistaState.design.theme.palette[value.index] = value.color;
      DataLaVistaState.design.widgets.forEach(function(w) { if (isEChartsWidget(w.type)) updateWidgetContent(w.id); });
    } else if (prop === 'themePaletteReset') {
      if (DataLaVistaState.design.theme) DataLaVistaState.design.theme.palette = [];
      DataLaVistaState.design.widgets.forEach(function(w) { if (isEChartsWidget(w.type)) updateWidgetContent(w.id); });
    } else if (prop === 'themeFontFamily') {
      if (!DataLaVistaState.design.theme) DataLaVistaState.design.theme = { palette: [], fontFamily: '', fontSize: null, backgroundColor: '' };
      DataLaVistaState.design.theme.fontFamily = value;
      DataLaVistaState.design.widgets.forEach(function(w) { if (isEChartsWidget(w.type)) updateWidgetContent(w.id); });
    } else if (prop === 'themeBackgroundColor') {
      if (!DataLaVistaState.design.theme) DataLaVistaState.design.theme = { palette: [], fontFamily: '', fontSize: null, backgroundColor: '' };
      DataLaVistaState.design.theme.backgroundColor = value;
      var _bgEl = document.getElementById('canvas-drop-zone');
      if (_bgEl) _bgEl.style.background = value || '';
      var _pcEl = document.getElementById('preview-canvas');
      if (_pcEl) _pcEl.style.background = value || '';
    }
    renderDashboardTitleProperties();
  }

  function insertTitleToken(/** @type {DragEvent} */ event) {
    event.preventDefault();
    const data = safeDragParse(event);
    if (!data) return;
    const field = data.field || data.alias;
    if (!field) return;
    const inp = /** @type {HTMLInputElement|null} */ (document.getElementById('title-input'));
    const propInp = /** @type {HTMLInputElement|null} */ (event.target instanceof HTMLInputElement ? event.target : null);
    const target = propInp || inp;
    if (!target) return;
    const token = '{{FIRST(' + field + ')}}';
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    target.value = target.value.slice(0, start) + token + target.value.slice(end);
    target.setSelectionRange(start + token.length, start + token.length);
    updateDashboardTitleProp('title', target.value);
    if (inp && inp !== target) inp.value = target.value;
  }

  function renderDashboardTitleProperties() {
    const section = document.getElementById('props-section');
    if (!section) return;
    const show    = DataLaVistaState.design.showDashboardTitle !== false;
    const intMode = DataLaVistaState.design.interactionMode || 'cross-filter';
    const fontFam = (DataLaVistaState.design.theme && DataLaVistaState.design.theme.fontFamily) || '';
    const bgColor = (DataLaVistaState.design.theme && DataLaVistaState.design.theme.backgroundColor) || '';
    const titleTpl = (DataLaVistaState.design.title || '').replace(/"/g, '&quot;');

    section.innerHTML = [
      '<div class="adv-node-section">',
      '  <div class="adv-node-section-hdr">DASHBOARD TITLE</div>',
      '  <div class="props-row">',
      '    <label>Show title bar</label>',
      '    <input type="checkbox" ' + (show ? 'checked' : '') + ' onchange="updateDashboardTitleProp(\'showDashboardTitle\',this.checked)"/>',
      '  </div>',
      '  <div class="props-row" style="flex-direction:column;align-items:flex-start;gap:4px">',
      '    <label>Title</label>',
      '    <input class="form-input" style="width:100%" value="' + titleTpl + '"',
      '      placeholder="DataLaVista Report"',
      '      ondragover="event.preventDefault()"',
      '      ondrop="insertTitleToken(event)"',
      '      oninput="DataLaVistaState.design.title=this.value"',
      '      onblur="updateDashboardTitleProp(\'title\',this.value)">',
      '    <div style="font-size:10px;color:var(--text-secondary)">Drop a field to embed <code>{{FIRST(Field)}}</code>. Supports any aggregate: <code>{{SUM(Field)}}</code>, <code>{{COUNT(Field)}}</code>, etc.</div>',
      (DataLaVistaState.design.title && DataLaVistaState.design.title.includes('{{'))
        ? '    <div style="font-size:10px;color:var(--accent)">→ ' + resolveTitleTemplate(DataLaVistaState.design.title) + '</div>'
        : '',
      '  </div>',
      '</div>',
      '<div class="adv-node-section">',
      '  <div class="adv-node-section-hdr">TITLE TOOLTIP</div>',
      '  <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;padding:0 2px">Optional HTML shown as ℹ️ next to the title. JavaScript is not allowed.</div>',
      '  <div class="props-row" style="flex-direction:column;align-items:flex-start">',
      '    <label style="margin-bottom:4px">Tooltip HTML</label>',
      '    <textarea class="form-input" rows="5" style="width:100%;font-size:11px;font-family:monospace"',
      '      placeholder="<b>About this dashboard:</b><br>..."',
      '      onblur="updateDashboardTitleProp(\'dashboardTitleTooltip\',this.value)">' + (DataLaVistaState.design.dashboardTitleTooltip || '').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</textarea>',
      '  </div>',
      '</div>',
      '<div class="adv-node-section">',
      '  <div class="adv-node-section-hdr">REPORT SETTINGS</div>',
      '  <div class="props-row">',
      '    <label>Chart interaction</label>',
      '    <select class="form-input" style="width:140px" onchange="updateDashboardTitleProp(\'interactionMode\',this.value)">',
      '      <option value="cross-filter"    ' + (intMode==='cross-filter'    ? 'selected' : '') + '>Cross-filter</option>',
      '      <option value="cross-highlight" ' + (intMode==='cross-highlight' ? 'selected' : '') + '>Cross-highlight</option>',
      '      <option value="none"            ' + (intMode==='none'            ? 'selected' : '') + '>None</option>',
      '    </select>',
      '  </div>',
      '  <div class="props-row">',
      '    <label>Canvas background</label>',
      '    <input type="color" value="' + (bgColor || '#f5f5f5') + '" style="width:36px;height:24px;padding:1px;border:1px solid #ccc;border-radius:3px;cursor:pointer"',
      '      onchange="updateDashboardTitleProp(\'themeBackgroundColor\',this.value)">',
      '  </div>',
      '  <div class="props-row">',
      '    <label>Font family</label>',
      '    <input class="form-input" style="width:160px" value="' + fontFam.replace(/"/g,'&quot;') + '" placeholder="e.g. Segoe UI, sans-serif"',
      '      onblur="updateDashboardTitleProp(\'themeFontFamily\',this.value)">',
      '  </div>',
      '</div>'
    ].join('\n');

    document.querySelectorAll('.widget').forEach(w => w.classList.remove('selected'));
    DataLaVistaState.currentWidgetId = null;
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

    // ── Virtual "Count" row — always COUNT(*) in SQL ──────────────────────
    const countRow = document.createElement('div');
    countRow.className = 'design-field-row';
    countRow.draggable = true;
    countRow.style.cssText = 'border-bottom:1px solid var(--border);margin-bottom:2px;padding-bottom:4px';
    countRow.innerHTML = `
      <span class="field-type-icon" style="font-size:10px;color:var(--accent);font-weight:700">#</span>
      <span class="field-label" title="Count of rows — becomes COUNT(*) in SQL">✦ Count</span>
    `;
    countRow.addEventListener('dragstart', e => {
      safeDragSet(e, { type: 'result-field', field: '__dlv_count__', dataType: 'number' });
    });
    secFields.appendChild(countRow);

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
      const m = (/** @type {Record<string,any>} */ (DataLaVistaState.queryColumnMeta))[col];
      if (m) {
        const parts = [];
        if (m.sourceDataSource) parts.push('<div><strong>Data Source:</strong> ' + m.sourceDataSource + '</div>');
        if (m.sourceTableName)  parts.push('<div><strong>Table:</strong> ' + m.sourceTableName + '</div>');
        if (m.viewName)         parts.push('<div><strong>View:</strong> ' + m.viewName + '</div>');
        const srcField = m.sourceDisplayName || m.sourceInternalName || col;
        const intSuffix = m.sourceInternalName && m.sourceInternalName !== srcField ? ' [' + m.sourceInternalName + ']' : '';
        parts.push('<div><strong>Source field:</strong> ' + srcField + intSuffix + '</div>');
        if (m.agg) parts.push('<div><strong>Aggregate:</strong> ' + m.agg + '</div>');
        if (m.sourceFieldDescription) parts.push('<div style="margin-top:4px;font-style:italic;opacity:.85">' + m.sourceFieldDescription + '</div>');
        const tipHtml = '<div style="font-size:11px;line-height:1.9;min-width:180px">'
          + '<div style="font-weight:700;margin-bottom:5px;font-size:12px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.25)">' + col + '</div>'
          + parts.join('')
          + '</div>';
        dlvTooltip.attach(row, tipHtml, { html: true, placement: 'right', delay: 400 });
      }
      secFields.appendChild(row);
    }
    body.appendChild(secFields);
  }

  /** Returns the active dataset for widget rendering.
   *  Priority: previewFilteredData → [dlv_active] view → empty. */
  function getDesignData() {
    if (DataLaVistaState.design.previewFilteredData)  return DataLaVistaState.design.previewFilteredData;
    if (alasql.tables && alasql.tables['dlv_active']) return alasql('SELECT * FROM [dlv_active]');
    return [];
  }

      // ============================================================
      // WIDGET TYPES — defined in DataLaVistaCore.WIDGET_TYPES (10-constants.js)
      // ============================================================

      function initToolbox() {
        const grid = document.getElementById('widget-types-grid');
        if(grid) {
            grid.innerHTML = '';
            for (const wt of DataLaVistaCore.WIDGET_TYPES) {
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

      function onDropToCanvas(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        if (data.type === 'existing-widget') {
          // Un-parent widget from container → back to canvas
          _removeWidgetFromContainer(data.widgetId);
          return;
        }
        if (data.type === 'widget-type') {
          if (data.widgetType === 'table') {
            addWidgetToCanvas('table', null, data.table);
          } else if (data.widgetType === 'pie') {
            const _qcP = /** @type {string[]} */ (DataLaVistaState.queryColumns);
            const _xPie = _qcP.find(c => /(type|status)$/i.test(c))
              || _qcP.find(c => /year$/i.test(c))
              || _qcP.find(c => sniffType(c) === 'boolean')
              || _qcP.find(c => sniffType(c) === 'user')
              || _qcP.find(c => sniffType(c) === 'lookup')
              || _qcP.find(c => sniffType(c) === 'date')
              || _qcP.find(c => sniffType(c) === 'text' && !/^title$/i.test(c))
              || _qcP[0] || '';
            addWidgetToCanvas('pie', [_xPie, '__dlv_count__'], null);
          } else if (data.widgetType === 'bar') {
            const _qcB = /** @type {string[]} */ (DataLaVistaState.queryColumns);
            const _xBar = _qcB.find(c => /(type|status)$/i.test(c))
              || _qcB.find(c => /year$/i.test(c))
              || _qcB.find(c => sniffType(c) === 'boolean')
              || _qcB.find(c => sniffType(c) === 'text' && !/^title$/i.test(c))
              || _qcB.find(c => sniffType(c) === 'date')
              || _qcB[0] || '';
            addWidgetToCanvas('bar', [_xBar], null);
          } else if (data.widgetType === 'line') {
            const _qcL = /** @type {string[]} */ (DataLaVistaState.queryColumns);
            const _xLine = _qcL.find(c => sniffType(c) === 'date')
              || _qcL.find(c => /year$/i.test(c))
              || _qcL.find(c => /(type|status)$/i.test(c))
              || _qcL.find(c => sniffType(c) === 'text' && !/^title$/i.test(c))
              || _qcL[0] || '';
            addWidgetToCanvas('line', [_xLine], null);
          } else {
            addWidgetToCanvas(data.widgetType, null, null);
          }
        }
        else if (data.type === 'table') addWidgetToCanvas('table', null, data.table);

        if(data.type === 'result-field' || data.type === 'field') {
          switch (data.dataType) {
            case 'number': {
              const _qcN = /** @type {string[]} */ (DataLaVistaState.queryColumns);
              const _xBar = _qcN.find(c => c !== data.field && /year$/i.test(c))
                || _qcN.find(c => c !== data.field && /(type|status)$/i.test(c))
                || _qcN.find(c => c !== data.field && sniffType(c) === 'boolean')
                || _qcN.find(c => c !== data.field && sniffType(c) === 'text' && !/^title$/i.test(c))
                || _qcN.find(c => c !== data.field && sniffType(c) === 'date')
                || _qcN.find(c => c !== data.field)
                || data.field;
              addWidgetToCanvas('bar', [_xBar, data.field], null);
              break;
            }
            case 'date':
              addWidgetToCanvas('line', [data.field, ...DataLaVistaState.queryColumns.filter(c => c !== data.field && sniffType(c) === 'number')], null); break;
            case 'boolean':
              addWidgetToCanvas('pie', [data.field, '__dlv_count__'], null); break;
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
        if (/Data$|Ids$/.test(field)) { toast('Cannot filter on raw lookup data fields', 'warning'); return; }
        if (DataLaVistaState.design.filters.find(f => f.field === field)) { toast('Filter for ' + field + ' already added', 'warning'); return; }
        DataLaVistaState.design.filters.push({ field, label: field, position: 'bar' });
        renderFilterBar();
      }

      function addWidgetToCanvas(widgetType, fields, tableName, containerId) {
        const id = 'w_' + Date.now();

        // Smart default Y field for chart widgets
        const _smartY = (() => {
          if (fields && fields.length > 1) {
            const _yf = fields[1];
            const _yAgg = _yf === '__dlv_count__' ? ''
              : (/^id$/i.test(_yf) || /Id$/.test(_yf)) ? 'COUNT_DISTINCT'
              : sniffType(_yf) === 'number' ? 'SUM'
              : '';
            return { yField: _yf, yFields: [_yf], yAgg: _yAgg };
          }
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
          return { yField: fb, yFields: fb ? [fb] : [], yAgg: 'COUNT_DISTINCT' };
        })();
        // Build initial seriesProps — one entry per Y field for charts, one per column for table/KPI
        const _isChartWidget = isEChartsWidget(widgetType);
        // Candidate columns: prefer the dropped table's own field aliases, fall back to queryColumns.
        const _candidates = (() => {
          const t = tableName && DataLaVistaState.tables[tableName];
          return (t && t.fields && t.fields.length)
            ? t.fields.filter(f => !f.isAutoId && !f.isLookupRaw).map(f => f.alias)
            : DataLaVistaState.queryColumns;
        })();
        const _initFields = fields || (() => {
          if (!_candidates.length) return [];
          if (widgetType === 'kpi') {
            const _kpiNum = _candidates.find(c => sniffType(c) === 'number');
            const _kpiId  = _candidates.find(c => /^id$/i.test(c));
            return [(_kpiNum || _kpiId || _candidates[0])];
          }
          if (widgetType === 'table') {
            // Pick one meaningful default field rather than dumping all columns.
            // Priority: ID/Id → Title/Name/Label → first text field → first field.
            const f = _candidates.find(c => /^id$/i.test(c))
                   || _candidates.find(c => /^(title|name|label)$/i.test(c))
                   || _candidates.find(c => sniffType(c) === 'text')
                   || _candidates[0];
            return f ? [f] : [];
          }
          return DataLaVistaState.queryColumns.slice(0, 8);
        })();
        let _initSeriesProps;
        if (_isChartWidget) {
          _initSeriesProps = _smartY.yFields.map(yf => ({
            field: yf, agg: _smartY.yAgg || '', label: '', color: '',
            seriesType: '', lineWidth: null, opacity: null, smooth: null,
            axisSide: '', conditions: []
          }));
        } else if (widgetType === 'kpi') {
          const _kpiDefaultAgg = (_initFields[0] && /^id$/i.test(_initFields[0])) ? 'COUNT_DISTINCT'
            : (sniffType(_initFields[0] || '') === 'number') ? 'SUM' : 'COUNT_DISTINCT';
          _initSeriesProps = _initFields.slice(0,1).map(f => ({
            field: f, agg: _kpiDefaultAgg, label: '', color: '',
            seriesType: '', lineWidth: null, opacity: null, smooth: null,
            axisSide: '', conditions: []
          }));
        } else if (widgetType === 'table') {
          _initSeriesProps = _initFields.map(f => ({
            field: f, agg: '', label: '', color: '',
            seriesType: '', lineWidth: null, opacity: null, smooth: null,
            axisSide: '', conditions: []
          }));
        } else {
          _initSeriesProps = [];
        }

        const widget = {
          id,
          type: widgetType,
          title: getDefaultTitle(widgetType),
          showTitle: (widgetType === 'placeholder' || widgetType === 'container') ? false : true,
          showHeaders: true,
          widthPct: 45,
          heightVh: 30,
          parentContainerId: containerId || null,
          minHeightVh: 30,
          containerGap: 8,
          containerPadding: 8,
          containerAlign: 'top',
          fields: _initFields,
          xField: (fields && fields.length > 0) ? fields[0] : (() => {
            const _qc = /** @type {string[]} */ (DataLaVistaState.queryColumns);
            if (widgetType === 'line' || widgetType === 'area') {
              return _qc.find(c => sniffType(c) === 'date')
                  || _qc.find(c => /year$/i.test(c))
                  || _qc.find(c => /(type|status)$/i.test(c))
                  || _qc.find(c => sniffType(c) === 'text' && !/^title$/i.test(c))
                  || _qc[0] || '';
            }
            return _qc.find(c => /(type|status)$/i.test(c))
                || _qc.find(c => /year$/i.test(c))
                || _qc.find(c => sniffType(c) === 'date')
                || _qc.find(c => sniffType(c) === 'text' && !/^title$/i.test(c))
                || _qc[0] || '';
          })(),
          yField: _smartY.yField,  // legacy compat
          yFields: _smartY.yFields,
          aggregation: '',
          seriesProps: _initSeriesProps,
          fieldAggs: {},   // kept for backward compat (not written to by new code)
          conditions: [],
          sorts: [],
          fillColor: '#0078d4',
          widgetBackgroundColor: widgetType === 'container' ? '' : '#fefefe',
          chartBackgroundColor: '#fefefe',
          titleBackgroundColor: '#fefefe',
          titleFontSize: 14,
          titleFontColor: '#323130',
          headersBackgroundColor: '#f3f2f1',
          headersFontSize: 12,
          headersFontColor: '#323130',
          borderColor: '#edebe9',
          borderSize: widgetType === 'container' ? 0 : 1,
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
          ySeriesProps: {},   // kept for backward compat (not written to by new code)
          bubbleSizeField: '',
          bubbleColorField: ''
        };

        // Normalize yFields from legacy yField
        if (!Array.isArray(widget.yFields)) {
          widget.yFields = widget.yField ? [widget.yField] : [];
        }

        if (tableName && DataLaVistaState.tables[tableName]) {
          widget.fields = DataLaVistaState.tables[tableName].fields.filter(f => !f.isAutoId && !f.isLookupRaw).map(f => f.alias).slice(0, 8);
        }

        DataLaVistaState.design.widgets.push(widget);
        renderDesignCanvas();
        selectWidget(id);
        document.getElementById('canvas-empty-hint').style.display = 'none';
      }

      function getDefaultTitle(type) {
        const wt = DataLaVistaCore.WIDGET_TYPES.find(function(x) { return x.id === type; });
        return wt ? wt.defaultTitle : 'Widget';
      }

      // ============================================================
      // DESIGN CANVAS RENDERING
      // ============================================================
      function getWidgetContentHTML(w) {
        if (w.type === 'text') return '<div class="text-widget" style="font-size:' + w.fontSize + 'px;color:' + w.fontColor + '">' + w.textContent + '</div>';
        if (w.type === 'placeholder') return '';
        if (w.type === 'container') return renderContainerContent(w);
        if (w.type === 'kpi') return renderKPIContent(w);
        if (w.type === 'table') return renderTableContent(w);
        if (isEChartsWidget(w.type)) return '<div id="chart-' + w.id + '" style="width:100%;height:100%;min-height:200px"></div>';
        return '';
      }


      /** Renders a placeholder drop-hint inside a container in design mode. */
      function renderContainerContent(w) {
        var children = DataLaVistaState.design.widgets.filter(function(cw) { return cw.parentContainerId === w.id; });
        if (!children.length) {
          return '<div style="padding:16px;text-align:center;color:var(--text-disabled);font-size:12px;border:1px dashed var(--border);border-radius:4px;margin:4px">'
            + 'Drag widgets here to add them to this container'
            + '</div>';
        }
        // Children are rendered by renderDesignCanvas; return empty string here so they are not double-rendered
        return '';
      }

/** Move an existing widget into a container. Prevents container nesting. */
      function _dropWidgetIntoContainer(widgetId, containerId) {
        if (widgetId === containerId) return;
        var dragged = DataLaVistaState.design.widgets.find(function(x) { return x.id === widgetId; });
        if (!dragged || dragged.type === 'container') return; // no nesting
        dragged.parentContainerId = containerId;
        renderDesignCanvas();
        selectWidget(widgetId);
      }

      /** Remove a widget from its container (un-parent to canvas). */
      function _removeWidgetFromContainer(widgetId) {
        var w = DataLaVistaState.design.widgets.find(function(x) { return x.id === widgetId; });
        if (!w) return;
        w.parentContainerId = null;
        renderDesignCanvas();
        selectWidget(widgetId);
      }

      function renderDesignCanvas() {
        const canvas = document.getElementById('canvas-drop-zone');
        const hint = document.getElementById('canvas-empty-hint');

        // Apply canvas background from theme
        if (canvas) canvas.style.background = (DataLaVistaState.design.theme && DataLaVistaState.design.theme.backgroundColor) || '';

        // Remove existing widgets (but not hint or drop zone controls)
        canvas.querySelectorAll('.widget').forEach(w => w.remove());

        // Destroy old chart instances
        for (const [id, chart] of Object.entries(DataLaVistaState.charts)) {
          try { chart.dispose(); } catch (e) { }
        }
        DataLaVistaState.charts = {};

        if (!DataLaVistaState.design.widgets.length) {
          hint.style.display = 'flex';
          if (!DataLaVistaState.currentWidgetId) renderDashboardTitleProperties();
          return;
        }
        hint.style.display = 'none';

        for (const w of DataLaVistaState.design.widgets) {
          // Only render top-level widgets here; children are injected into their container below
          if (w.parentContainerId) continue;
          const el = createWidgetElement(w);
          canvas.appendChild(el);
        }

        // Inject child widgets into their containers
        for (const w of DataLaVistaState.design.widgets) {
          if (!w.parentContainerId) continue;
          const containerContent = document.getElementById('wcontent-' + w.parentContainerId);
          if (!containerContent) continue;
          const childEl = createWidgetElement(w);
          containerContent.appendChild(childEl);
        }

        // Render charts after DOM
        requestAnimationFrame(() => {
          for (const w of DataLaVistaState.design.widgets) {
            if (isEChartsWidget(w.type)) {
              renderChart(w);
            }
          }
        });

        if (!DataLaVistaState.currentWidgetId) renderDashboardTitleProperties();
      }

      function createWidgetElement(w) {
        const el = document.createElement('div');
        el.className = 'widget';
        el.id = 'widget-' + w.id;

        // Width: children always 100%; top-level use widthPct
        var widthValue;
        if (w.parentContainerId) {
          widthValue = '100%';
        } else {
          widthValue = w.widthPct + '%';
        }
        // Height: containers use min-height + auto; others use fixed heightVh
        var heightStyle;
        if (w.type === 'container') {
          heightStyle = 'min-height:' + (w.minHeightVh || 30) + 'vh;height:auto';
        } else {
          heightStyle = 'height:' + w.heightVh + 'vh';
        }
        var _isContainerEl = (w.type === 'container');
        var _minHtEl = _isContainerEl ? '' : ';min-height:120px';
        var _ovfEl   = _isContainerEl ? ';overflow:visible' : '';
        el.style.cssText = 'width:' + widthValue + ';' + heightStyle + _minHtEl + ';border-color:' + w.borderColor + ';border-width:' + w.borderSize + 'px;background:' + (w.widgetBackgroundColor || 'transparent') + _ovfEl;

        const actions = '<div class="widget-actions">'
          + '<button class="btn btn-ghost btn-icon btn-sm" onclick="moveWidget(\'' + w.id + '\', -1)" title="Move left">\u2190</button>'
          + '<button class="btn btn-ghost btn-icon btn-sm" onclick="moveWidget(\'' + w.id + '\', 1)" title="Move right">\u2192</button>'
          + '<button class="btn btn-danger btn-icon btn-sm" onclick="deleteWidget(\'' + w.id + '\')" title="Delete">\u2715</button>'
          + '</div>';

        const titleHdrStyle  = 'background:' + (w.titleBackgroundColor || '#fefefe');
        const titleSpanStyle = 'font-size:' + (w.titleFontSize || 14) + 'px;color:' + (w.titleFontColor || '#323130');
        const isChartWidget = isEChartsWidget(w.type);
        var contentClass = 'widget-content';
        if (isChartWidget) { contentClass += ' widget-content-chart'; }

        // Container content gets flex column styling
        var contentStyle = '';
        if (w.type === 'container') {
          var alignMap = { 'top': 'flex-start', 'space-between': 'space-between', 'stretch': 'stretch' };
          var justifyVal = alignMap[w.containerAlign || 'top'] || 'flex-start';
          contentStyle = ' style="display:flex;flex-direction:column;gap:' + (w.containerGap || 8) + 'px;padding:' + (w.containerPadding || 8) + 'px;justify-content:' + justifyVal + ';flex-wrap:wrap;height:auto;overflow:visible"';
        }

        el.innerHTML = '<div class="widget-header" style="' + titleHdrStyle + '"><span class="widget-title" style="' + titleSpanStyle + '">' + (w.title || '') + '</span>' + actions + '</div>'
          + '<div class="' + contentClass + '" id="wcontent-' + w.id + '"' + contentStyle + '>' + getWidgetContentHTML(w) + '</div>'
          + '<div class="widget-resize-handle"></div>';

        // Context-aware title visibility
        if (w.showTitle === false) {
          const hdr = el.querySelector('.widget-header');
          if (DataLaVistaState.activeTab === 'design') {
            hdr.style.opacity = '0.3';
          } else {
            hdr.hidden = true;
          }
        }
        el.addEventListener('click', function(e) {
          if (!e.target.closest('button')) {
            // Child widget inside a container: stop bubble so container's handler doesn't fire
            if (w.parentContainerId) { e.stopPropagation(); }
            // Container widget: only select if click didn't originate from an inner child widget
            if (w.type === 'container') {
              var _innerWidget = e.target.closest('.widget');
              if (_innerWidget && _innerWidget !== el) return;
            }
            selectWidget(w.id);
          }
        });
        // Drop fields from panel onto widget (non-container)
        el.addEventListener('dragover', e => {
          if (!_wPropsDrag.type) { e.preventDefault(); el.classList.add('drag-over'); }
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop', function(e) {
          e.stopPropagation();
          el.classList.remove('drag-over');
          if (!_wPropsDrag.type) {
            var _dd = safeDragParse(e);
            if (_dd && _dd.type === 'existing-widget') {
              // Drop existing widget into this widget — only containers accept this
              if (w.type === 'container') {
                _dropWidgetIntoContainer(_dd.widgetId, w.id);
              }
            } else if (_dd && _dd.type === 'widget-type' && w.type === 'container') {
              // Drop new widget type from toolbox directly into container
              addWidgetToCanvas(_dd.widgetType, null, null, w.id);
            } else if (_dd && _dd.type === 'table' && w.type === 'container') {
              // Drop table from panel directly into container
              addWidgetToCanvas('table', null, _dd.table, w.id);
            } else {
              onDropFieldToWidget(w.id, e);
            }
          }
        });
        // Widget header drag — for reparenting to containers
        const hdrEl = el.querySelector('.widget-header');
        if (hdrEl) {
          hdrEl.setAttribute('draggable', 'true');
          hdrEl.addEventListener('dragstart', e => {
            safeDragSet(e, { type: 'existing-widget', widgetId: w.id });
            e.stopPropagation();
          });
        }
        // Resize handle
        const rh = el.querySelector('.widget-resize-handle');
        rh.addEventListener('mousedown', e => startWidgetResize(e, w.id, el));
        return el;
      }

      function getWidgetContentHTML(w) {
        if (w.type === 'text') return '<div class="text-widget" style="font-size:' + w.fontSize + 'px;color:' + w.fontColor + '">' + w.textContent + '</div>';
        if (w.type === 'placeholder') return '';
        if (w.type === 'container') return renderContainerContent(w);
        if (w.type === 'kpi') return renderKPIContent(w);
        if (w.type === 'table') return renderTableContent(w);
        if (isEChartsWidget(w.type)) return '<div id="chart-' + w.id + '" style="width:100%;height:100%;min-height:200px"></div>';
        return '';
      }

      // ============================================================

      // ============================================================
      // PER-WIDGET SQL BUILDER & DATA EXECUTOR
      // ============================================================

      /** Converts a single condition object to a SQL fragment (no leading conjunction). */
      function _condToSQLFrag(c) {
        return condToSQL(c, `[${c.field}]`, sniffType(c.field));
      }

      /** Converts conditions array to a WHERE-clause body string (no WHERE keyword). */
      function _condsToWhereBody(conditions) {
        return conditions.map((c, i) => {
          const conj = i === 0 ? '' : (c.conj || 'AND') + ' ';
          return conj + _condToSQLFrag(c);
        }).join(' ');
      }

      /**
       * Builds the SQL string for a widget. Returns { sql, fromSrc }.
       * fromSrc is null when falling back to in-memory array binding (?).
       */
      /**
       * Returns the canonical seriesProps array for a widget, normalizing legacy
       * fieldAggs + ySeriesProps into the unified format if seriesProps is absent.
       * For chart widgets: each entry = one Y series.
       * For table/KPI widgets: each entry = one column.
       */
      function _getSeriesProps(w) {
        if (Array.isArray(w.seriesProps) && w.seriesProps.length) {
          // For table/kpi, seriesProps must reflect w.fields. If there's no overlap
          // (e.g. leftover chart seriesProps after a type switch), fall through to
          // reconstruct from w.fields so the correct columns are used.
          if (w.type === 'table' || w.type === 'kpi') {
            const fieldSet = new Set(w.fields || []);
            const filtered = w.seriesProps.filter(sp => fieldSet.has(sp.field));
            if (filtered.length) return filtered;
            // No overlap — fall through to reconstruct below
          } else {
            return w.seriesProps;
          }
        }
        // Legacy migration: reconstruct from ySeriesProps (index-keyed) + fieldAggs (field-keyed)
        const _isChart = isEChartsWidget(w.type);
        if (_isChart) {
          const yfs = (Array.isArray(w.yFields) && w.yFields.length)
            ? w.yFields : (w.yField ? [w.yField] : []);
          return yfs.map((yf, yi) => {
            const legacy = (w.ySeriesProps || {})[String(yi)] || (w.ySeriesProps || {})[yf] || {};
            return {
              field:      yf,
              agg:        legacy.agg || (w.fieldAggs || {})[yf] || '',
              label:      legacy.label      || '',
              color:      legacy.color      || '',
              seriesType: legacy.seriesType || '',
              lineWidth:  legacy.lineWidth  != null ? legacy.lineWidth  : null,
              opacity:    legacy.opacity    != null ? legacy.opacity    : null,
              smooth:     legacy.smooth     != null ? legacy.smooth     : null,
              axisSide:   legacy.axisSide   || '',
              conditions: (legacy.conditions || []).map(c => Object.assign({}, c))
            };
          });
        }
        // table / kpi
        const fields = (w.type === 'kpi') ? (w.fields || []).slice(0,1) : (w.fields || []);
        return fields.map(f => ({
          field:      f,
          agg:        (w.fieldAggs || {})[f] || '',
          label:      '',
          color:      '',
          seriesType: '',
          lineWidth:  null,
          opacity:    null,
          smooth:     null,
          axisSide:   '',
          conditions: []
        }));
      }

      function buildWidgetSQL(w) {
        const hasActive  = !!(alasql.tables && alasql.tables['dlv_active']);
        const hasResults = !!(alasql.tables && alasql.tables['dlv_results']);
        const fromSrc    = hasActive ? '[dlv_active]' : hasResults ? '[dlv_results]' : null;
        const from       = fromSrc || '?';

        const base = getDesignData();

        // Snapshot available columns from live data so stale widget field refs
        // (fields removed from the query) are silently filtered out rather than
        // producing broken SQL / wrong GROUP BY / "too many rows" fallbacks.
        let availCols = null;
        if (fromSrc) {
          try {
            const _s = alasql(`SELECT * FROM ${fromSrc} LIMIT 1`);
            if (_s && _s.length) availCols = new Set(Object.keys(_s[0]));
          } catch(e) {}
        }
        if (!availCols && base && base.length) availCols = new Set(Object.keys(base[0]));
        const _isVirtCount = (f) => f === '__dlv_count__';
        const _inCols = (f) => _isVirtCount(f) || !availCols || availCols.has(f);

        const _isChartType = isEChartsWidget(w.type);

        // seriesProps is the unified source of truth (replaces both fieldAggs and ySeriesProps).
        // Fall back to reconstructing from legacy fieldAggs + ySeriesProps for old configs
        // that haven't been through loadConfig migration yet (e.g. mid-session).
        const seriesProps = _getSeriesProps(w);

        const conditions   = (w.conditions  || []).filter(c => c.field && _inCols(c.field));
        const sorts        = (w.sorts       || []).filter(s => s.field && _inCols(s.field));

        // Helper: aggregate for series at index i
        const _getAgg = (i) => (seriesProps[i] || {}).agg || '';

        let dims = /** @type {string[]} */ ([]), yFields = /** @type {string[]} */ ([]);
        let cols;
        if (w.type === 'table') {
          // For table, seriesProps[i].field is the column — but respect w.fields order
          const tableFields = seriesProps.length ? seriesProps.map(s => s.field).filter(Boolean) : (w.fields || []);
          cols = tableFields.filter(f => _inCols(f) && (!fromSrc || true) && (fromSrc || (base && base.length && Object.prototype.hasOwnProperty.call(base[0], f))));
        } else if (_isChartType) {
          // dimensions[] is the new multi-dim array; fall back to xField for old configs
          const rawDims = /** @type {string[]} */ ((Array.isArray(w.dimensions) && w.dimensions.length) ? w.dimensions : (w.xField ? [w.xField] : []));
          dims    = rawDims.filter(d => d && _inCols(d));
          yFields = seriesProps.length
            ? seriesProps.map(s => s.field).filter(f => f && _inCols(f))
            : ((Array.isArray(w.yFields) && w.yFields.length) ? w.yFields.filter(f => _inCols(f)) : (w.yField && _inCols(w.yField) ? [w.yField] : []));
          cols    = [...dims, ...yFields].filter(Boolean);
        } else if (w.type === 'kpi') {
          cols = (seriesProps.length
            ? seriesProps.slice(0,1).map(s => s.field).filter(Boolean)
            : (w.fields || []).slice(0, 1)).filter(f => _inCols(f));
        } else {
          return null;
        }
        if (!cols.length) return null;

        const anyAgg       = _isChartType
          ? yFields.some((yf, i) => _isVirtCount(yf) || _getAgg(i))
          : cols.some((col, i) => _isVirtCount(col) || _getAgg(i));
        const needsDistinct = !anyAgg && DataLaVistaCore.DISTINCT_WIDGET_IDS.has(w.type);

        let selParts;
        if (_isChartType && dims.length) {
          // All dimensions go into SELECT (multi-dim support); yFields follow with __dlvy_N aliases
          const dimParts = dims.map(d => `[${d}]`);
          const yParts = yFields.map((yf, yi) => {
            const agg     = _getAgg(yi);
            const spEntry = seriesProps[yi] || {};
            const sConds  = (spEntry.conditions || []).filter(c => c.field);
            const alias   = `__dlvy_${yi}`;

            // Virtual count field — always COUNT(*)
            if (_isVirtCount(yf)) return `COUNT(*) AS [${alias}]`;

            if (!agg) return `[${yf}] AS [${alias}]`;

            if (!sConds.length) {
              return aggToSQL(agg, `[${yf}]`, alias);
            }
            // Conditions-filtered aggregates — transpile user-friendly vals to SQL ops for CASE patterns
            const sqlOp = { EARLIEST:'MIN', FIRST_ALPHA:'MIN', LATEST:'MAX', LAST_ALPHA:'MAX',
              LIST:'GROUP_CONCAT', GROUP_CONCAT:'GROUP_CONCAT' }[agg] || agg;
            const caseWhen = _condsToWhereBody(sConds);
            if (sqlOp === 'SUM')           return `SUM(CASE WHEN ${caseWhen} THEN 1 ELSE 0 END) AS [${alias}]`;
            if (sqlOp === 'COUNT')         return `COUNT(CASE WHEN ${caseWhen} THEN 1 ELSE NULL END) AS [${alias}]`;
            if (sqlOp === 'COUNT_DISTINCT') return `COUNT(DISTINCT CASE WHEN ${caseWhen} THEN [${yf}] ELSE NULL END) AS [${alias}]`;
            return `${sqlOp}(CASE WHEN ${caseWhen} THEN [${yf}] ELSE NULL END) AS [${alias}]`;
          });
          selParts = [...dimParts, ...yParts];
        } else {
          // table / kpi — use seriesProps for agg; alias stays as field name for table compat
          selParts = cols.map((col, i) => {
            if (_isVirtCount(col)) return `COUNT(*) AS [__dlv_count__]`;
            const agg = _getAgg(i);
            if (!agg) return `[${col}]`;
            return aggToSQL(agg, `[${col}]`, col);
          });
        }

        const whereParts = conditions.map((c, i) => {
          const conj = i === 0 ? '' : (c.conj || 'AND') + ' ';
          return conj + _condToSQLFrag(c);
        });

        let groupParts;
        if (_isChartType && anyAgg) {
          // All dimensions go into GROUP BY; non-aggregated Y fields also group
          groupParts = dims.map(d => `[${d}]`);
          yFields.forEach((yf, yi) => {
            if (!_isVirtCount(yf) && !_getAgg(yi)) groupParts.push(`[${yf}]`);
          });
          groupParts = [...new Set(groupParts)];
        } else if (!_isChartType && anyAgg) {
          groupParts = cols.filter((col, i) => !_isVirtCount(col) && !_getAgg(i)).map(c => `[${c}]`);
        } else {
          groupParts = [];
        }

        const orderParts = sorts.map(s => `[${s.field}] ${s.dir || 'ASC'}`);

        const selectKw = (needsDistinct && !anyAgg) ? 'SELECT DISTINCT' : 'SELECT';
        let sql = `${selectKw} ${selParts.join(', ')} FROM ${from}`;
        if (whereParts.length) sql += ` WHERE ${whereParts.join(' ')}`;
        if (groupParts.length) sql += ` GROUP BY ${groupParts.join(', ')}`;
        if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;

        return { sql, fromSrc };
      }

      /**
       * Executes buildWidgetSQL and returns the result rows.
       * Falls back to getDesignData() on error or when no SQL can be built.
       */
      function buildWidgetData(w) {
        const base = getDesignData();
        const hasActive  = !!(alasql.tables && alasql.tables['dlv_active']);
        const hasResults = !!(alasql.tables && alasql.tables['dlv_results']);
        const fromSrc    = hasActive ? '[dlv_active]' : hasResults ? '[dlv_results]' : null;

        if (!fromSrc && (!base || !base.length)) return [];

        const conditions = (w.conditions || []).filter(c => c.field);
        const sorts      = (w.sorts     || []).filter(s => s.field);

        if (w.type !== 'table' && w.type !== 'kpi' && !isEChartsWidget(w.type)) return base;

        const built = buildWidgetSQL(w);
        if (!built) return base;

        const { sql } = built;

        const _isChart2 = isEChartsWidget(w.type);
        const sp2 = _getSeriesProps(w);
        const anyAgg = sp2.some(s => s.agg);
        const needsDistinct = !anyAgg && DataLaVistaCore.DISTINCT_WIDGET_IDS.has(w.type);

        // Check if we have any relevant fields at all
        const hasCols = _isChart2
          ? sp2.some(s => s.field)
          : (w.type === 'kpi' ? !!(w.fields && w.fields[0]) : !!(w.fields && w.fields.length));
        if (!hasCols) return base;

        if (!conditions.length && !sorts.length && !anyAgg) {
          if (!needsDistinct) return base;
          try {
            const rd = fromSrc ? alasql(preprocessSQL(sql)) : alasql(preprocessSQL(sql), [base]);
            return Array.isArray(rd) ? rd : base;
          } catch (e) {
            console.warn('buildWidgetData DISTINCT error:', e.message);
            return base;
          }
        }

        try {
          const result = fromSrc ? alasql(preprocessSQL(sql)) : alasql(preprocessSQL(sql), [base]);
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
          const sp = _getSeriesProps(w);
          const fieldAgg = (sp[0] || {}).agg || '';
          if (fieldAgg) {
            value = kpiData[0][field] != null ? kpiData[0][field] : '—';
          } else {
            const agg = w.aggregation || 'SUM';
            const vals = kpiData.map(r => parseFloat(r[field]) || 0);
            if (agg === 'COUNT') value = kpiData.length;
            else if (agg === 'SUM') value = vals.reduce((a, b) => a + b, 0).toLocaleString();
            else if (agg === 'AVG') value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—';
            else value = kpiData[0][field] != null ? kpiData[0][field] : '—';
          }
        }
        const metricSize  = w.kpiMetricFontSize || 36;
        const labelSize   = w.kpiLabelFontSize  || 13;
        const labelText   = (w.kpiLabelOverride && w.kpiLabelOverride.trim()) ? w.kpiLabelOverride : field;
        return `<div class="kpi-card"><div class="kpi-value" style="color:${w.fillColor};font-size:${metricSize}px">${value}</div><div class="kpi-label" style="font-size:${labelSize}px">${labelText}</div></div>`;
      }


      function renderTableContent(w) {
        var tableData = buildWidgetData(w);
        if (!tableData || !tableData.length) {
          return '<div class="text-muted text-sm" style="padding:12px">No data — run a query first</div>';
        }
        var allCols = Object.keys(tableData[0]);
        var cols = w.fields.filter(function(/** @type {string} */ f) { return allCols.includes(f); });
        if (!cols.length) return '<div class="text-muted text-sm" style="padding:12px">No fields selected — add columns in the properties panel</div>';
        var hdrStyle = 'background:' + (w.headersBackgroundColor || '#f3f2f1') + ';font-size:' + (w.headersFontSize || 12) + 'px;color:' + (w.headersFontColor || '#323130');
        var _sp = _getSeriesProps(w);
        var thHtml = '';
        for (var _thi = 0; _thi < cols.length; _thi++) {
          var _thc = cols[_thi];
          var _thsp = null;
          for (var _spj = 0; _spj < _sp.length; _spj++) { if (_sp[_spj].field === _thc) { _thsp = _sp[_spj]; break; } }
          var _thlabel;
          if (_thsp && _thsp.label) { _thlabel = _thsp.label; }
          else if (_thc === '__dlv_count__') { _thlabel = '✦ Count'; }
          else { _thlabel = _thc; }
          thHtml += '<th style="' + hdrStyle + '">' + _thlabel + '</th>';
        }
        var theadHtml = w.showHeaders === false ? '' : '<thead><tr>' + thHtml + '</tr></thead>';
        var _tblMode = (w.interactionMode) || (DataLaVistaState.design && DataLaVistaState.design.interactionMode) || 'cross-filter';
        var _hl = /** @type {any} */ (DataLaVistaState.drillHighlight);
        var html = '<div style="overflow:auto;max-height:100%"><table class="widget-table">' + theadHtml + '<tbody>';
        for (var _tri = 0; _tri < tableData.length; _tri++) {
          var _trow = tableData[_tri];
          // Row highlight: yellow background if drillHighlight matches any displayed column
          var _isHlRow = false;
          if (_hl) {
            for (var _hci = 0; _hci < cols.length; _hci++) {
              if (cols[_hci] === _hl.field && _trow[cols[_hci]] != null && String(_trow[cols[_hci]]) === String(_hl.value)) {
                _isHlRow = true; break;
              }
            }
          }
          html += _isHlRow ? '<tr style="background:#fff4ce">' : '<tr>';
          // Each cell is individually clickable using its own column + value
          for (var _tci = 0; _tci < cols.length; _tci++) {
            var _col = cols[_tci];
            var _cellRaw = _trow[_col] != null ? _trow[_col] : '';
            var _cellStr = String(_cellRaw);
            var _cellEsc = _cellStr.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            var _colEsc  = _col.replace(/'/g, "\\'");
            var _cellFn = _tblMode === 'cross-highlight'
              ? '_applyDrillHighlight(\'' + _colEsc + '\',\'' + _cellEsc + '\')'
              : 'applyDrillFilter(\'' + _colEsc + '\',\'' + _cellEsc + '\')';
            var _cellAction = _tblMode === 'cross-highlight' ? 'highlight' : 'filter';
            html += '<td style="cursor:pointer" title="Click to ' + _cellAction + ' by ' + _col + '" onclick="' + _cellFn + '">' + _cellStr + '</td>';
          }
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

// ── CHART COLORS ─────────────────────────────────────────────────────────────
// Reads report-level theme palette first, falls back to widget fillColor + defaults.
function _getChartColors(w) {
  var p = DataLaVistaState.design && DataLaVistaState.design.theme && DataLaVistaState.design.theme.palette;
  if (p && p.length) return [w.fillColor || p[0]].concat(p.slice(1));
  return [w.fillColor || '#0078d4', '#e9950d', '#107c10', '#d13438', '#8764b8', '#038387', '#ff8c00', '#e3008c', '#00b7c3'];
}

// ── INLINE TREND LINE (index-based, for bar/line charts) ──────────────────────
// Returns a trend-line series using inline data (not dataset), suitable for
// appending alongside dataset-based series.
function _buildIndexTrendSeries(rows, yAlias, yField, label, color) {
  var vals = rows.map(function(r) { return parseFloat(r[yAlias] !== undefined ? r[yAlias] : r[yField]) || 0; });
  var n    = vals.length;
  if (n < 2) return null;
  var sumX  = (n * (n - 1)) / 2;
  var sumY  = 0, sumXY = 0;
  var sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  for (var i = 0; i < n; i++) { sumY += vals[i]; sumXY += i * vals[i]; }
  var denom     = n * sumX2 - sumX * sumX;
  var trendData = [];
  if (!denom) {
    var avg = sumY / n;
    for (var j = 0; j < n; j++) trendData.push(avg);
  } else {
    var slope     = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;
    for (var k = 0; k < n; k++) trendData.push(parseFloat((slope * k + intercept).toFixed(6)));
  }
  return {
    name      : label + ' trend',
    type      : 'line',
    data      : trendData,
    smooth    : false,
    symbol    : 'none',
    lineStyle : { type: 'dashed', color: color, width: 2, opacity: 0.8 },
    itemStyle : { color: color },
    zlevel    : 10
  };
}

// ── DATASET OPTION BUILDER (bar / line / pie) ────────────────────────────────
// Standard ECharts 6 dataset + encode pattern. Rows are pre-aggregated by AlaSQL.
// Y-field aliases (__dlvy_N) from buildWidgetSQL are the encode targets.
function _buildDatasetOption(w, rows) {
  var sp   = _getSeriesProps(w);
  var dims = (Array.isArray(w.dimensions) && w.dimensions.length) ? w.dimensions : (w.xField ? [w.xField] : []);
  var xDim = dims[0] || '';
  var colors = _getChartColors(w);

  // Pie with single Y: use dataset + encode for clean data binding
  if (w.type === 'pie' && sp.length <= 1) {
    return {
      dataset : { source: rows },
      tooltip : { trigger: 'item', formatter: /** @param {any} p */ function(p) {
        var raw = p.data ? p.data[xDim] : p.name;
        var name = raw == null ? '' : typeof raw === 'object'
          ? (raw.Title || raw.title || raw.name || raw.Name || raw.label || raw.Label || String(raw))
          : String(raw);
        var val = p.data && p.data['__dlvy_0'] != null ? p.data['__dlvy_0'] : '';
        return name + ': ' + val + ' (' + p.percent.toFixed(1) + '%)';
      } },
      series  : [{ type: 'pie', encode: { itemName: xDim, value: '__dlvy_0' }, radius: ['30%', '65%'], label: { fontSize: 11 }, emphasis: { focus: 'self' }, blur: { itemStyle: { opacity: 0.15 } } }]
    };
  }

  // Pie with multiple Y fields: polar rose — polar bar doesn't support dataset in ECharts 6, use inline data
  if (w.type === 'pie' && sp.length > 1) {
    var categories = rows.map(function(r) { return String(r[xDim] != null ? r[xDim] : ''); });
    return {
      tooltip  : { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend   : { show: true, bottom: 0 },
      polar    : { radius: ['15%', '75%'] },
      angleAxis: { type: 'category', data: categories, startAngle: 90 },
      radiusAxis: { type: 'value' },
      series   : sp.map(function(spe, pi) {
        var yf   = spe.field;
        var bkey = '__dlvy_' + pi;
        return {
          name             : spe.label || yf,
          type             : 'bar',
          coordinateSystem : 'polar',
          stack            : 'total',
          data             : rows.map(function(r) { return parseFloat(r[bkey] !== undefined ? r[bkey] : r[yf]) || 0; }),
          emphasis         : { focus: 'self' },
          blur             : { itemStyle: { opacity: 0.15 } }
        };
      })
    };
  }

  // Bar / Line — dataset + encode with dual-axis and trend line support
  var seriesList   = [];
  var hasRightAxis = sp.some(function(s) { return s.axisSide === 'right'; });

  for (var i = 0; i < sp.length; i++) {
    var spe   = sp[i];
    var alias = '__dlvy_' + i;
    var st    = spe.seriesType || w.type;
    var color = spe.color || colors[i % colors.length];
    var s = /** @type {any} */ ({
      name      : spe.label || spe.field,
      type      : st,
      encode    : { x: xDim, y: alias },
      itemStyle : { color: color, opacity: spe.opacity != null ? spe.opacity : 1 },
      emphasis  : { focus: 'self' },
      blur      : { itemStyle: { opacity: 0.15 }, lineStyle: { opacity: 0.15 } }
    });
    if (st === 'line') {
      s.smooth = spe.smooth != null ? !!spe.smooth : true;
      if (spe.lineWidth != null) s.lineStyle = { width: spe.lineWidth };
    }
    if (w.stacked) s.stack = 'total';
    if (spe.axisSide === 'right') s.yAxisIndex = 1;
    seriesList.push(s);

    if (w.showTrendLine) {
      var trend = _buildIndexTrendSeries(rows, alias, spe.field, spe.label || spe.field, color);
      if (trend) seriesList.push(trend);
    }
  }

  var yAxis    = hasRightAxis ? [{ type: 'value' }, { type: 'value', position: 'right' }] : { type: 'value' };
  var hasLegend = sp.length > 1 || !!w.showTrendLine;
  return {
    dataset : { source: rows },
    tooltip : { trigger: 'axis' },
    legend  : hasLegend ? { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } } : undefined,
    xAxis   : { type: 'category', axisLabel: { rotate: 45, fontSize: 11, hideOverlap: true, overflow: 'truncate', width: 100 } },
    yAxis   : yAxis,
    series  : seriesList,
    grid    : { left: 40, right: hasRightAxis ? 60 : 20, top: 20, bottom: hasLegend ? 80 : 60 }
  };
}

// ── SCATTER / BUBBLE option builder ──────────────────────────────────────────
// Uses dataset + encode. Bubble size and color dimensions stay as named columns.
// symbolSize function reads raw field from dataset row. visualMap refs by field name.
function _buildScatterOption(w, rows, sp) {
  if (!sp) sp = _getSeriesProps(w);
  var dims     = (Array.isArray(w.dimensions) && w.dimensions.length) ? w.dimensions : (w.xField ? [w.xField] : []);
  var xDim     = dims[0] || '';
  var colors   = _getChartColors(w);
  var szField  = (w.typeConfig && w.typeConfig.bubbleSizeField)  || w.bubbleSizeField  || '';
  var clrField = (w.typeConfig && w.typeConfig.bubbleColorField) || w.bubbleColorField || '';
  var hasBubble = szField  !== '';
  var hasClrFld = clrField !== '';

  // Pre-compute bubble size scale for normalization
  var maxSz = 1;
  if (hasBubble) {
    for (var si = 0; si < rows.length; si++) {
      var sv = Math.abs(parseFloat(rows[si][szField]) || 0);
      if (sv > maxSz) maxSz = sv;
    }
  }

  // Pre-compute color field range for visualMap
  var minC = 0, maxC = 1;
  if (hasClrFld) {
    var clrVals = rows.map(function(r) { return parseFloat(r[clrField]) || 0; });
    if (clrVals.length) {
      minC = maxC = clrVals[0];
      for (var ci = 1; ci < clrVals.length; ci++) {
        if (clrVals[ci] < minC) minC = clrVals[ci];
        if (clrVals[ci] > maxC) maxC = clrVals[ci];
      }
    }
  }

  var seriesList = [];
  var capturedMaxSz = maxSz;

  for (var i = 0; i < sp.length; i++) {
    var spe   = sp[i];
    var alias = '__dlvy_' + i;
    var color = spe.color || colors[i % colors.length];
    var encode = { x: xDim, y: alias };
    var scSeries = /** @type {any} */ ({
      name      : spe.label || spe.field,
      type      : 'scatter',
      encode    : encode,
      itemStyle : hasClrFld ? undefined : { color: color, opacity: 0.75 }
    });
    if (hasBubble) {
      var capturedSzField = szField;
      var capturedMax     = capturedMaxSz;
      scSeries.symbolSize = function(data) {
        return Math.max(6, Math.sqrt(Math.abs(parseFloat(data[capturedSzField]) || 0) / capturedMax) * 60);
      };
    } else {
      scSeries.symbolSize = 8;
    }
    seriesList.push(scSeries);

    if (w.showTrendLine) {
      // Scatter trend: actual x/y regression (not index-based)
      var xVals = rows.map(function(r) { return parseFloat(r[xDim]) || 0; });
      var yVals = rows.map(function(r) { var k = alias; return parseFloat(r[k] !== undefined ? r[k] : r[spe.field]) || 0; });
      var n = xVals.length;
      if (n >= 2) {
        var ssumX = 0, ssumY = 0, ssumXY = 0, ssumX2 = 0;
        for (var ti = 0; ti < n; ti++) {
          ssumX += xVals[ti]; ssumY += yVals[ti];
          ssumXY += xVals[ti] * yVals[ti]; ssumX2 += xVals[ti] * xVals[ti];
        }
        var sdenom = n * ssumX2 - ssumX * ssumX;
        if (sdenom) {
          var sslope     = (n * ssumXY - ssumX * ssumY) / sdenom;
          var sintercept = (ssumY - sslope * ssumX) / n;
          var sminX = Math.min.apply(null, xVals);
          var smaxX = Math.max.apply(null, xVals);
          seriesList.push({
            name      : (spe.label || spe.field) + ' trend',
            type      : 'line',
            data      : [[sminX, parseFloat((sslope * sminX + sintercept).toFixed(6))], [smaxX, parseFloat((sslope * smaxX + sintercept).toFixed(6))]],
            smooth    : false, symbol: 'none',
            lineStyle : { type: 'dashed', color: color, width: 2, opacity: 0.8 },
            itemStyle : { color: color }
          });
        }
      }
    }
  }

  var hasLegend = sp.length > 1 || !!w.showTrendLine;
  var option = /** @type {any} */ ({
    dataset : { source: rows },
    tooltip : { trigger: 'item' },
    legend  : hasLegend ? { bottom: 0, textStyle: { fontSize: 11 } } : undefined,
    xAxis   : { type: 'value', name: xDim, nameLocation: 'middle', nameGap: 28 },
    yAxis   : { type: 'value' },
    series  : seriesList,
    grid    : { left: 50, right: hasClrFld ? 80 : 20, top: 20, bottom: hasLegend ? 60 : 40 }
  });

  if (hasClrFld) {
    option.visualMap = {
      type      : 'continuous',
      min       : minC,
      max       : maxC,
      text      : [String(maxC), String(minC)],
      dimension : clrField,
      right     : 0,
      top       : 'middle',
      inRange   : { color: ['#91c7ae', '#d48265', '#ca8622'] },
      textStyle : { fontSize: 10 },
      itemWidth : 14
    };
  }
  return option;
}

// ── VIOLIN (via @echarts-x/custom-violin) ────────────────────────────────────
// xField/dimensions[0] = category grouping; seriesProps[0].field = numeric value
// Groups raw rows by category then passes arrays to the violin series.
function _buildViolinOption(w, rows, sp) {
  if (!sp) sp = _getSeriesProps(w);
  var colors  = _getChartColors(w);
  var dims    = (Array.isArray(w.dimensions) && w.dimensions.length) ? w.dimensions : (w.xField ? [w.xField] : []);
  var xDim    = dims[0] || '';
  var yField  = (sp[0] && sp[0].field) || (Array.isArray(w.yFields) && w.yFields[0]) || '';
  var violinGroups = /** @type {Record<string,number[]>} */ ({});
  for (var i = 0; i < rows.length; i++) {
    var r    = rows[i];
    var cat  = String(r[xDim] != null ? r[xDim] : '');
    var bkey = '__dlvy_0';
    var val  = parseFloat(r[bkey] !== undefined ? r[bkey] : r[yField]);
    if (!violinGroups[cat]) violinGroups[cat] = [];
    if (!isNaN(val)) violinGroups[cat].push(val);
  }
  var cats = Object.keys(violinGroups);
  return {
    tooltip : { trigger: 'item' },
    xAxis   : { type: 'category', data: cats, axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis   : { type: 'value' },
    grid    : { left: 50, right: 20, top: 20, bottom: 60 },
    series  : [{ type: 'violin', itemStyle: { color: colors[0] }, data: cats.map(function(c) { return { name: c, value: violinGroups[c] }; }) }]
  };
}


// ── CHART OPTION DISPATCHER ───────────────────────────────────────────────────
// Routes to the appropriate option builder based on the widget type registry.
// Standard ECharts types with supportsDataset=true go through _buildDatasetOption.
// Types with optionBuilder defined call that named function directly.
function _buildChartOption(w, rows) {
  if (!rows || !rows.length) return null;
  var wtDef = DataLaVistaCore.WIDGET_TYPES.find(function(t) { return t.id === w.type; });
  if (!wtDef) return null;
  if (wtDef.optionBuilder && typeof (/** @type {any} */ (window))[wtDef.optionBuilder] === 'function') {
    return (/** @type {any} */ (window))[wtDef.optionBuilder](w, rows, _getSeriesProps(w));
  }
  if (wtDef.supportsDataset) return _buildDatasetOption(w, rows);
  return null;
}

      function renderChart(w) {
  const chartEl = document.getElementById('chart-' + w.id);
  if (!chartEl) return;
  if (DataLaVistaState.charts[w.id]) { try { DataLaVistaState.charts[w.id].dispose(); } catch(e){} }
  // Disconnect any prior ResizeObserver for this widget
  if (DataLaVistaState._chartROs && DataLaVistaState._chartROs[w.id]) {
    try { DataLaVistaState._chartROs[w.id].disconnect(); } catch(e) {}
  }
  const chart = echarts.init(chartEl, null, { renderer: 'canvas' });
  DataLaVistaState.charts[w.id] = chart;
  // Resize chart whenever its container changes size (window, drag-handle, iframe, panel, etc.)
  if (typeof ResizeObserver !== 'undefined') {
    if (!DataLaVistaState._chartROs) DataLaVistaState._chartROs = {};
    const ro = new ResizeObserver(() => { try { chart.resize(); } catch(e) {} });
    ro.observe(chartEl);
    DataLaVistaState._chartROs[w.id] = ro;
  }
  const chartData = buildWidgetData(w);
  const option = _buildChartOption(w, chartData);
  if (!option) {
    chart.setOption({ backgroundColor: w.chartBackgroundColor || 'transparent', title: { text: 'No data', left: 'center', top: 'middle', textStyle: { color: '#a19f9d', fontSize: 13 } } });
    return;
  }
  (/** @type {any} */ (option)).backgroundColor = w.chartBackgroundColor || 'transparent';
  chart.setOption(option);
  // Cross-widget click: filter or highlight depending on interactionMode
  chart.on('click', (params) => {
    if (params.componentType !== 'series') return;
    const dims = (Array.isArray(w.dimensions) && w.dimensions.length) ? w.dimensions : (w.xField ? [w.xField] : []);
    const filterField = dims[0];
    let filterValue = params.name;
    if (w.type === 'scatter' && Array.isArray(params.data)) filterValue = String(params.data[0]);
    if (!filterField || filterValue == null) return;
    const mode = w.interactionMode || (DataLaVistaState.design && DataLaVistaState.design.interactionMode) || 'cross-filter';
    if (mode === 'cross-filter') {
      applyDrillFilter(filterField, String(filterValue));
    } else if (mode === 'cross-highlight') {
      const _hl = DataLaVistaState.drillHighlight;
      if (_hl && _hl.field === filterField && String(_hl.value) === String(filterValue)) {
        _clearDrillHighlight();
      } else {
        _applyDrillHighlight(filterField, String(filterValue));
      }
    }
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
          if (!w.parentContainerId) {
            w.widthPct = Math.max(20, Math.min(100, ((startW + dx) / containerW) * 100));
            el.style.width = w.widthPct + '%';
          }
          if (w.type === 'container') {
            w.minHeightVh = Math.max(10, (startH + dy) / window.innerHeight * 100);
            el.style.minHeight = w.minHeightVh + 'vh';
          } else {
            w.heightVh = Math.max(10, (startH + dy) / window.innerHeight * 100);
            el.style.height = w.heightVh + 'vh';
          }
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
        var deletedW = DataLaVistaState.design.widgets.find(w => w.id === wid);
        // If deleting a container, orphan its children back to canvas
        if (deletedW && deletedW.type === 'container') {
          DataLaVistaState.design.widgets.forEach(function(cw) {
            if (cw.parentContainerId === wid) { cw.parentContainerId = null; }
          });
        }
        DataLaVistaState.design.widgets = DataLaVistaState.design.widgets.filter(w => w.id !== wid);
        if (DataLaVistaState.charts[wid]) { try { DataLaVistaState.charts[wid].dispose(); } catch (e) { } delete DataLaVistaState.charts[wid]; }
        if (DataLaVistaState._chartROs && DataLaVistaState._chartROs[wid]) { try { DataLaVistaState._chartROs[wid].disconnect(); } catch(e) {} delete DataLaVistaState._chartROs[wid]; }
        document.getElementById('widget-' + wid)?.remove();
        if (DataLaVistaState.currentWidgetId === wid) {
          DataLaVistaState.currentWidgetId = null;
          renderDashboardTitleProperties();
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

      // ── Widget properties drag-to-reorder ──────────────────────────────────
      const _wPropsDrag = { type: null, wid: null, idx: null };

      function _wpDragStart(type, wid, idx, event) {
        _wPropsDrag.type = type; _wPropsDrag.wid = wid; _wPropsDrag.idx = idx;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(idx));
        event.currentTarget.addEventListener('dragend', () => { _wPropsDrag.type = null; _wPropsDrag.wid = null; _wPropsDrag.idx = null; }, { once: true });
      }

      function _wpDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
      }

      function _wpDragLeave(event) {
        event.currentTarget.classList.remove('drag-over');
      }

      /** Handles drops from the fields panel onto a named section in the properties panel. */
      function _wpDropFieldToSection(wid, role, event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('drag-over');
        const data = safeDragParse(event);
        if (!data) return;
        const field = data.field || data.alias;
        if (!field) return;
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        if (role === 'x') {
          w.xField = field;
          _widgetRefresh(wid);
        } else if (role === 'y') {
          widgetAddYField(wid, field);
        } else if (role === 'cond') {
          widgetAddCond(wid, field);
        } else if (role === 'sort') {
          widgetAddSort(wid, field);
        }
      }

      function _wpDrop(type, wid, toIdx, event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        if (_wPropsDrag.type !== type || _wPropsDrag.wid !== wid) return;
        const from = _wPropsDrag.idx;
        if (from === toIdx) return;
        if (type === 'field')  widgetReorderField(wid, from, toIdx);
        if (type === 'yfield') widgetReorderYField(wid, from, toIdx);
        if (type === 'cond')   widgetReorderCond(wid, from, toIdx);
        if (type === 'sort')   widgetReorderSort(wid, from, toIdx);
      }

      function _arrMove(arr, from, to) {
        const item = arr.splice(from, 1)[0];
        arr.splice(to, 0, item);
      }

      function widgetReorderField(wid, from, to) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !w.fields) return;
        _arrMove(w.fields, from, to);
        if (Array.isArray(w.seriesProps) && w.seriesProps.length) _arrMove(w.seriesProps, from, to);
        _widgetRefresh(wid);
      }

      function widgetReorderYField(wid, from, to) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !Array.isArray(w.yFields)) return;
        if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
        _arrMove(w.yFields, from, to);
        _arrMove(w.seriesProps, from, to);
        _widgetRefresh(wid);
      }

      function widgetReorderCond(wid, from, to) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !w.conditions) return;
        _arrMove(w.conditions, from, to);
        _widgetRefresh(wid);
      }

      function widgetReorderSort(wid, from, to) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !w.sorts) return;
        _arrMove(w.sorts, from, to);
        _widgetRefresh(wid);
      }

      /** Opens a simplified advanced-props popup for non-series fields (table cols, X field). */
      function openWidgetFieldAdvProps(wid, fieldName, idx, role) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        // For 'x' role, read/write from w.xProps to avoid colliding with seriesProps[0] (Y[0])
        const isXRole = role === 'x';
        if (!isXRole) {
          if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
        }
        const existing = isXRole ? (w.xProps || {}) : (w.seriesProps[idx] || {});
        const local = { label: existing.label || '', color: existing.color || '' };
        const esc = (s) => (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const _fa = {};
        _fa.prop = (k, v) => { local[k] = v; };
        _fa.apply = () => {
          if (isXRole) {
            w.xProps = Object.assign(w.xProps || {}, { label: local.label, color: local.color });
          } else {
            if (!Array.isArray(w.seriesProps)) w.seriesProps = _getSeriesProps(w);
            if (!w.seriesProps[idx]) w.seriesProps[idx] = { field: fieldName, agg: '', label: '', color: '', conditions: [] };
            w.seriesProps[idx].label = local.label;
            w.seriesProps[idx].color = local.color;
          }
          const ov = document.getElementById('_wfa-overlay');
          if (ov) ov.remove();
          _widgetRefresh(wid);
        };
        _fa.close = () => { const ov = document.getElementById('_wfa-overlay'); if (ov) ov.remove(); };
        /** @type {any} */ (window)._wfa = _fa;

        const overlay = document.createElement('div');
        overlay.id = '_wfa-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:80px';
        overlay.addEventListener('click', e => { if (e.target === overlay) _fa.close(); });

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:320px;max-width:calc(100vw - 40px);overflow-y:auto;animation:popIn 200ms ease';
        dialog.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
            <span style="font-weight:600;font-size:13px">${esc(fieldName)} — Field Properties</span>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="_wfa.close()">✕</button>
          </div>
          <div style="padding:12px 16px">
            <div class="adv-node-section-hdr">GENERAL</div>
            <div class="props-row"><label>Display label</label>
              <input type="text" class="form-input" id="_wfa-label" value="${esc(local.label)}"
                placeholder="${esc(fieldName)}" oninput="_wfa.prop('label',this.value)"/></div>
            <div class="adv-node-section-hdr" style="margin-top:10px">APPEARANCE</div>
            <div class="props-row"><label>Color</label>
              <div class="color-input-wrap">
                <input type="color" value="${local.color || '#323130'}" oninput="_wfa.prop('color',this.value);document.getElementById('_wfa-colortxt').value=this.value"/>
                <input type="text" class="form-input" id="_wfa-colortxt" value="${esc(local.color)}" oninput="_wfa.prop('color',this.value)"/>
              </div></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
              <button class="btn btn-ghost" onclick="_wfa.close()">Cancel</button>
              <button class="btn btn-primary" onclick="_wfa.apply()">Apply</button>
            </div>
          </div>`;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
      }

      function _renderYFieldsHTML(w, wid, cols) {
        const sp  = _getSeriesProps(w);
        const yfs = sp.length ? sp.map(s => s.field).filter(Boolean)
          : ((Array.isArray(w.yFields) && w.yFields.length) ? w.yFields : (w.yField ? [w.yField] : []));
        let returnVal;

        if (!yfs.length) {
          returnVal = '<div style="font-size:11px;color:var(--text-disabled);padding:4px 0">No Y fields — click + Add</div>';
        } else {
          returnVal = yfs.map((yf, yi) => {
            const ti = DataLaVistaCore.FIELD_TYPE_ICONS[sniffType(yf)] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
            const spEntry = sp[yi] || {};
            const agg = spEntry.agg || '';
            const escapedYf = yf.replace(/'/g, "\\'");
            const colOptions = '<option value="__dlv_count__"' + (yf === '__dlv_count__' ? ' selected' : '') + '>✦ Count</option>'
              + cols.map(c =>
                '<option value="' + c + '"' + (c === yf ? ' selected' : '') + '>' + c + '</option>'
              ).join('');
            const hasSeriesConds = !!(spEntry.conditions && spEntry.conditions.length);

            return '<div class="adv-field-row selected" draggable="true"'
              + ' ondragstart="_wpDragStart(\'yfield\',\'' + wid + '\',' + yi + ',event)"'
              + ' ondragover="_wpDragOver(event)"'
              + ' ondragleave="_wpDragLeave(event)"'
              + ' ondrop="_wpDrop(\'yfield\',\'' + wid + '\',' + yi + ',event)">'
              + '<span style="cursor:grab;padding:0 4px;color:var(--text-disabled)" title="Drag to reorder">⠿</span>'
              + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
              + '<select class="form-input" style="flex:1;height:22px;font-size:11px"'
              + ' onchange="widgetUpdateYField(\'' + wid + '\',' + yi + ',this.value)">'
              + colOptions + '</select>'
              + '<button class="btn btn-ghost btn-sm btn-icon' + (hasSeriesConds ? ' has-agg' : '') + '" title="Series properties" style="padding:0 4px"'
              + ' onclick="event.stopPropagation();openSeriesAdvancedProps(\'' + wid + '\',\'' + escapedYf + '\',' + yi + ')">⚙️</button>'
              + '<button class="adv-agg-btn' + (agg ? ' has-agg' : '') + '" title="' + (agg || 'No aggregate') + '"'
              + ' onclick="event.stopPropagation();showWidgetFieldAggPopup(\'' + wid + '\',\'' + escapedYf + '\',this,' + yi + ')">'
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

      /**
       * Opens an aggregate-picker popup anchored to btn.
       * yi: Y-field index (chart/table widgets). When provided, agg is stored in seriesProps[yi].agg.
       *     Pass -1 or omit for non-Y-field uses (scatter bubble/color fields, xField).
       */
      function showWidgetFieldAggPopup(wid, field, btn, yi) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const yIdx = (yi != null && yi >= 0) ? yi : -1;
        const dt = sniffType(field);
        const current = yIdx >= 0
          ? (_getSeriesProps(w)[yIdx] || {}).agg || ''
          : (w.fieldAggs || {})[field] || '';
        showAggPopup(btn, dt, current, agg => setWidgetFieldAgg(wid, field, agg, yIdx));
      }

      /** Sets (or clears) a per-field aggregate on a widget, then refreshes. */
      function setWidgetFieldAgg(wid, field, agg, yi) {
        const w    = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const yIdx = (yi != null && yi >= 0) ? yi : -1;
        if (yIdx >= 0) {
          // Ensure seriesProps is populated (may be absent on legacy-loaded widgets)
          if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
          if (!w.seriesProps[yIdx]) w.seriesProps[yIdx] = { field, agg: '', label: '', color: '', seriesType: '', lineWidth: null, opacity: null, smooth: null, axisSide: '', conditions: [] };
          w.seriesProps[yIdx].agg = agg || '';
        } else {
          // fieldAggs used for non-series fields (scatter bubble/color, xField)
          if (!w.fieldAggs) w.fieldAggs = {};
          if (agg) w.fieldAggs[field] = agg;
          else delete w.fieldAggs[field];
        }
        _widgetRefresh(wid);
      }


      // ── Series advanced properties modal ────────────────────────────────

      function openSeriesAdvancedProps(wid, fieldName, yi) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        // Ensure seriesProps is populated (may be absent on legacy-loaded widgets)
        if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);

        const spIdx = yi != null ? yi : 0;
        const existing = w.seriesProps[spIdx] || {};
        const agg = existing.agg || '';
        const cols = DataLaVistaState.queryColumns;
        const enrichedSeriesCols = cols.map(alias => {
          const tk = findTableKeyForAlias(alias);
          const f  = tk && DataLaVistaState.tables[tk] && DataLaVistaState.tables[tk].fields
            ? DataLaVistaState.tables[tk].fields.find(x => x.alias === alias)
            : null;
          return { alias, displayType: sniffType(alias), tableKey: 'dlv_results', fieldInternalName: f ? f.internalName : '' };
        });

        // Work on a local copy until Apply
        let local = {
          label:      existing.label      || '',
          color:      existing.color      || '',
          seriesType: existing.seriesType || '',
          lineWidth:  existing.lineWidth  != null ? existing.lineWidth : 2,
          opacity:    existing.opacity    != null ? existing.opacity   : 1,
          smooth:     existing.smooth     != null ? !!existing.smooth  : true,
          conditions: (existing.conditions || []).map(c => Object.assign({}, c))
        };

        // All handlers live on a single namespace object to avoid TS window-property errors
        /** @type {any} */
        const _s = {};

        _s.prop = (k, v) => { local[k] = v; };

        _s.rerender = () => {
          const dlg = document.getElementById('series-adv-dialog');
          if (dlg) dlg.innerHTML = _s.renderHeader() + _s.renderBody();
        };

        _s.condAdd = () => {
          if (!cols.length) return;
          local.conditions.push({ conj: 'AND', field: cols[0], op: '=', value: sniffType(cols[0]) === 'boolean' ? 'true' : '' });
          _s.rerender();
        };
        _s.condRemove = (ci) => { local.conditions.splice(ci, 1); _s.rerender(); };
        _s.condUpdate = (ci, prop, val) => {
          if (!local.conditions[ci]) return;
          local.conditions[ci][prop] = val;
          // Reset op/value when switching fields or element keys to avoid stale ops/values
          if (prop === 'field') { local.conditions[ci].op = '='; local.conditions[ci].value = sniffType(local.conditions[ci].field) === 'boolean' ? 'true' : ''; local.conditions[ci].value2 = ''; local.conditions[ci].elementKey = ''; }
          if (prop === 'elementKey') { local.conditions[ci].op = '='; local.conditions[ci].value = ''; local.conditions[ci].value2 = ''; }
          if (prop === 'op' || prop === 'field' || prop === 'elementKey') _s.rerender();
        };
        _s.clearAll = () => {
          local = { label: '', color: '', seriesType: '', lineWidth: 2, opacity: 1, smooth: true, conditions: [] };
          // agg is not part of local — lives directly in seriesProps[spIdx].agg
          _s.rerender();
        };
        _s.apply = () => {
          // Preserve agg (managed by the agg popup, not this modal)
          const prevAgg = (w.seriesProps[spIdx] || {}).agg;
          w.seriesProps[spIdx] = Object.assign({}, local, { field: (w.seriesProps[spIdx] || {}).field || fieldName, conditions: local.conditions.map(c => Object.assign({}, c)) });
          if (prevAgg) w.seriesProps[spIdx].agg = prevAgg;
          _s.close();
          _widgetRefresh(wid);
        };
        _s.close = () => {
          const ov = document.getElementById('series-adv-overlay');
          if (ov) ov.remove();
          delete window['_dlvSeries'];
        };

        // Expose single handle on window for inline HTML handlers
        window['_dlvSeries'] = _s;

        const isLineType = () => !local.seriesType || local.seriesType === 'line' || (local.seriesType === '' && w.type === 'line');

        _s.renderHeader = () => {
          const aggLabel = agg ? (agg === 'COUNT_DISTINCT' ? 'COUNT DISTINCT' : agg) : 'RAW';
          return `<div class="popup-header panel-header">
            <h3 style="font-size:15px;font-weight:600;margin:0">Advanced Properties</h3>
            <button class="btn btn-ghost btn-icon" onclick="_dlvSeries.close()">✕</button>
          </div>
          <span class="toolbox-section-label" style="display:block;padding:8px 20px 4px">
            Series: ${aggLabel} of ${fieldName}
          </span>`;
        };

        _s.renderBody = function() {
          var lineOpts = isLineType();
          var condRows = renderConditionRows(
            local.conditions, enrichedSeriesCols,
            (ci, v) => `_dlvSeries.condUpdate(${ci},'conj',${v})`,
            (ci, v) => `_dlvSeries.condUpdate(${ci},'field',${v})`,
            (ci, v) => `_dlvSeries.condUpdate(${ci},'op',${v})`,
            (ci, v) => `_dlvSeries.condUpdate(${ci},'value',${v})`,
            (ci)    => `_dlvSeries.condRemove(${ci})`,
            null,
            (ci, v) => `_dlvSeries.condUpdate(${ci},'value2',${v})`,
            (ci, v) => `_dlvSeries.condUpdate(${ci},'elementKey',${v})`
          );
          var _lineWidthHTML = '';
          if (lineOpts) {
            _lineWidthHTML = '<div class="props-row"><label>Line width</label>'
              + '<input type="number" class="form-input" min="1" max="10" style="width:60px"'
              + ' value="' + local.lineWidth + '" oninput="_dlvSeries.prop(\'lineWidth\',+this.value)"/></div>';
          }
          var _smoothHTML = '';
          if (lineOpts) {
            var _smoothChecked = local.smooth ? 'checked' : '';
            _smoothHTML = '<div class="props-row"><label>Smooth</label>'
              + '<input type="checkbox" ' + _smoothChecked
              + ' onchange="_dlvSeries.prop(\'smooth\',this.checked)"/></div>';
          }
          var _stAutoSel  = !local.seriesType ? 'selected' : '';
          var _stBarSel   = local.seriesType === 'bar'  ? 'selected' : '';
          var _stLineSel  = local.seriesType === 'line' ? 'selected' : '';
          var _localLabelEsc = local.label.replace(/"/g, '&quot;');
          var _localColor    = local.color || '#0078d4';
          var _localColorTxt = local.color || '';
          return '<div class="popup-body" style="padding-top:0;gap:10px">'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr">GENERAL</div>'
            + '<div class="props-row"><label>Display label</label>'
            + '<input type="text" class="form-input" value="' + _localLabelEsc + '"'
            + ' oninput="_dlvSeries.prop(\'label\',this.value)" placeholder="' + fieldName + '"/></div>'
            + '</div>'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr">APPEARANCE</div>'
            + '<div class="props-row"><label>Color</label>'
            + '<div class="color-input-wrap">'
            + '<input type="color" value="' + _localColor + '"'
            + ' oninput="_dlvSeries.prop(\'color\',this.value);this.nextElementSibling.value=this.value"/>'
            + '<input type="text" class="form-input" value="' + _localColorTxt + '"'
            + ' oninput="_dlvSeries.prop(\'color\',this.value);this.previousElementSibling.value=this.value||\'#000000\'" placeholder="(palette)"/>'
            + '</div></div>'
            + _lineWidthHTML
            + '<div class="props-row"><label>Opacity</label>'
            + '<input type="number" class="form-input" min="0" max="1" step="0.05" style="width:60px"'
            + ' value="' + local.opacity + '" oninput="_dlvSeries.prop(\'opacity\',+this.value)"/></div>'
            + _smoothHTML
            + '</div>'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr">'
            + '<span>FILTER CONDITIONS</span>'
            + '<button class="btn btn-ghost btn-sm" onclick="_dlvSeries.condAdd()">+ Add</button>'
            + '</div>'
            + '<div id="series-cond-rows">' + condRows + '</div>'
            + '</div>'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr">SERIES TYPE</div>'
            + '<div class="props-row"><label>Type</label>'
            + '<select class="form-input" onchange="_dlvSeries.prop(\'seriesType\',this.value);_dlvSeries.rerender()">'
            + '<option value="" ' + _stAutoSel + '>auto</option>'
            + '<option value="bar" ' + _stBarSel + '>bar</option>'
            + '<option value="line" ' + _stLineSel + '>line</option>'
            + '</select></div>'
            + '</div>'
            + '</div>'
            + '<div class="popup-footer" style="justify-content:space-between">'
            + '<button class="btn btn-ghost btn-sm" onclick="_dlvSeries.clearAll()">Clear All</button>'
            + '<button class="btn btn-primary btn-sm" onclick="_dlvSeries.apply()">Apply</button>'
            + '</div>';
        };

        // Build overlay
        const overlay = document.createElement('div');
        overlay.id = 'series-adv-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:60px';
        overlay.addEventListener('click', e => { if (e.target === overlay) _s.close(); });

        const dialog = document.createElement('div');
        dialog.id = 'series-adv-dialog';
        dialog.style.cssText = 'background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:560px;max-width:calc(100vw - 40px);max-height:calc(100vh - 120px);overflow-y:auto;animation:popIn 200ms ease';
        dialog.innerHTML = _s.renderHeader() + _s.renderBody();

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
      }

      /** Formats and peeks at the SQL for a widget via a tooltip. */
      function peekWidgetSQL(wid, btn) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const built = buildWidgetSQL(w);
        if (!built) {
          dlvTooltip.attach(btn, '<pre style="font-size:11px;margin:0">N/A for this widget type</pre>', { html: true, maxWidth: '500px', placement: 'top' });
          dlvTooltip.update(btn, '<pre style="font-size:11px;margin:0">N/A for this widget type</pre>', { html: true, maxWidth: '500px', placement: 'top' });
          return;
        }
        const formatted = built.sql
          .replace(/\b(SELECT DISTINCT|SELECT|FROM|WHERE|GROUP BY|ORDER BY)\b/g, '\n$1')
          .trim();
        const html = `<pre style="font-size:11px;margin:0;white-space:pre-wrap">${formatted.replace(/</g,'&lt;')}</pre>`;
        dlvTooltip.attach(btn, html, { html: true, maxWidth: '500px', placement: 'top', delay: 0 });
        dlvTooltip.update(btn, html, { html: true, maxWidth: '500px', placement: 'top', delay: 0 });
        // Force immediate show
        btn.dispatchEvent(new MouseEvent('mouseenter'));
      }

      // ── Per-widget conditions ────────────────────────────────────────────

      function widgetAddCond(wid, field) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !DataLaVistaState.queryColumns.length) return;
        if (!w.conditions) w.conditions = [];
        const useField = field || DataLaVistaState.queryColumns[0];
        const tk = findTableKeyForAlias(useField);
        const fieldMeta = tk && DataLaVistaState.tables[tk]
          ? DataLaVistaState.tables[tk].fields.find(f => f.alias === useField)
          : null;
        const defaultValue = fieldMeta && fieldMeta.displayType === 'boolean' ? 'true' : '';
        w.conditions.push({ conj: 'AND', field: useField, op: '=', value: defaultValue });
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
        // re-render to update ops / value input when field, op, or elementKey changes
        if (prop === 'op' || prop === 'field' || prop === 'elementKey') {
          if (prop === 'field' || prop === 'elementKey') {
            w.conditions[idx].op = '=';
            w.conditions[idx].value = (prop === 'field' && sniffType(w.conditions[idx].field) === 'boolean') ? 'true' : '';
            w.conditions[idx].value2 = '';
            if (prop === 'field') w.conditions[idx].elementKey = '';
          }
          renderWidgetProperties(wid);
        } else {
          updateWidgetContent(wid);
        }
      }

      // ── Per-widget sorts ─────────────────────────────────────────────────

      function widgetAddSort(wid, field) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w || !DataLaVistaState.queryColumns.length) return;
        if (!w.sorts) w.sorts = [];
        w.sorts.push({ field: field || DataLaVistaState.queryColumns[0], dir: 'ASC' });
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

      /** Build <option> HTML for a field-selector dropdown. No ternary in backtick. */
      function _fieldRowColOpts(cols, selectedVal) {
        var opts = '';
        for (var _frci = 0; _frci < cols.length; _frci++) {
          var _frcSel = (cols[_frci] === selectedVal) ? ' selected' : '';
          opts += '<option value="' + cols[_frci] + '"' + _frcSel + '>' + cols[_frci] + '</option>';
        }
        return opts;
      }

      function renderWidgetProperties(wid) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const section = document.getElementById('props-section');
        if (!section) return;
        const _wa = /** @type {any} */ (w); // type cast: widgets[] is inferred as never[] at the state declaration

        const isChart = isEChartsWidget(w.type);
        const isKPI   = w.type === 'kpi';
        const isTable = w.type === 'table';
        const isText  = w.type === 'text';
        const isContainer = w.type === 'container';
        const isData  = !isContainer && (isChart || isKPI || isTable);

        const cols       = DataLaVistaState.queryColumns;
        const enrichedCols = cols.map(alias => {
          if (alias === '__dlv_count__') return { alias, displayType: 'number', tableKey: 'dlv_results', fieldInternalName: '' };
          const tk = findTableKeyForAlias(alias);
          const f  = tk && DataLaVistaState.tables[tk] && DataLaVistaState.tables[tk].fields
            ? DataLaVistaState.tables[tk].fields.find(x => x.alias === alias)
            : null;
          return { alias, displayType: sniffType(alias), tableKey: 'dlv_results', fieldInternalName: f ? f.internalName : '' };
        });
        const conditions = w.conditions || [];
        const sorts      = w.sorts      || [];
        const _wsp       = _getSeriesProps(w);

        // ── Field row: type-icon + label + field-selector + ⚙️ + ∑ agg button ──
        // Used for singular non-series fields (X field, scatter xField, bubbleSizeField, etc.) — agg via fieldAggs
        const fieldRow = (roleLabel, fieldVal, onChangeExpr, gearIdx) => {
          const dt  = sniffType(fieldVal || '');
          const ti  = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const agg = (w.fieldAggs || {})[fieldVal] || '';
          const escapedFv = (fieldVal || '').replace(/'/g, "\\'");
          var _frGearBtn = '';
          if (gearIdx != null) {
            _frGearBtn = '<button class="btn btn-ghost btn-sm btn-icon" style="padding:0 4px" title="Field properties"'
              + ' onclick="event.stopPropagation();openWidgetFieldAdvProps(\'' + wid + '\',\'' + escapedFv + '\',' + gearIdx + ',\'x\')">⚙️</button>';
          }
          var _frAggClass = agg ? ' has-agg' : '';
          var _frAggIcon  = agg ? getAggIcon(agg) : '∑';
          return '<div class="adv-field-row selected">'
            + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
            + '<span style="font-size:11px;color:var(--text-disabled);flex-shrink:0;min-width:16px">' + roleLabel + '</span>'
            + '<select class="form-input" style="flex:1;height:22px;font-size:11px" onchange="' + onChangeExpr + '">'
            + _fieldRowColOpts(cols, fieldVal)
            + '</select>'
            + _frGearBtn
            + '<button class="adv-agg-btn' + _frAggClass + '" title="' + (agg || 'No aggregate') + '"'
            + ' onclick="event.stopPropagation();showWidgetFieldAggPopup(\'' + wid + '\',\'' + escapedFv + '\',this)">' + _frAggIcon + '</button>'
            + '</div>';
        };

        // ── Table column row: drag handle + type-icon + label/name + ⚙️ + ∑ + remove ──
        const tableFieldRow = (fieldName, idx) => {
          const dt  = sniffType(fieldName);
          const ti  = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
          const agg = (_wsp[idx] || {}).agg || '';
          const sp  = _wsp[idx] || {};
          var _tfLabel = sp.label || (fieldName === '__dlv_count__' ? '✦ Count' : fieldName);
          const escapedFn = fieldName.replace(/'/g, "\\'");
          var _tfAggClass = agg ? ' has-agg' : '';
          var _tfAggIcon  = agg ? getAggIcon(agg) : '∑';
          return '<div class="adv-field-row selected" draggable="true"'
            + ' ondragstart="_wpDragStart(\'field\',\'' + wid + '\',' + idx + ',event)"'
            + ' ondragover="_wpDragOver(event)"'
            + ' ondragleave="_wpDragLeave(event)"'
            + ' ondrop="_wpDrop(\'field\',\'' + wid + '\',' + idx + ',event)">'
            + '<span style="cursor:grab;padding:0 4px;color:var(--text-disabled)" title="Drag to reorder">⠿</span>'
            + '<span class="field-type-icon ' + ti.cls + '">' + ti.icon + '</span>'
            + '<span class="field-name" style="flex:1" title="' + escapedFn + '">' + _tfLabel + '</span>'
            + '<button class="btn btn-ghost btn-sm btn-icon" style="padding:0 4px" title="Field properties"'
            + ' onclick="event.stopPropagation();openWidgetFieldAdvProps(\'' + wid + '\',\'' + escapedFn + '\',' + idx + ',\'field\')">⚙️</button>'
            + '<button class="adv-agg-btn' + _tfAggClass + '" title="' + (agg || 'No aggregate') + '"'
            + ' onclick="event.stopPropagation();showWidgetFieldAggPopup(\'' + wid + '\',\'' + escapedFn + '\',this,' + idx + ')">' + _tfAggIcon + '</button>'
            + '<button class="btn btn-ghost btn-sm btn-icon" style="padding:0 4px" onclick="removeWidgetField(\'' + wid + '\',' + idx + ')">✕</button>'
            + '</div>';
        };

        // ── Filter conditions ────────────────────────────────────────────
        const renderConditions = () => renderConditionRows(
          conditions, enrichedCols,
          (ci, v) => `widgetUpdateCond('${wid}',${ci},'conj',${v})`,
          (ci, v) => `widgetUpdateCond('${wid}',${ci},'field',${v})`,
          (ci, v) => `widgetUpdateCond('${wid}',${ci},'op',${v})`,
          (ci, v) => `widgetUpdateCond('${wid}',${ci},'value',${v})`,
          (ci)    => `widgetRemoveCond('${wid}',${ci})`,
          (ci)    => `draggable="true" ondragstart="_wpDragStart('cond','${wid}',${ci},event)" ondragover="_wpDragOver(event)" ondragleave="_wpDragLeave(event)" ondrop="_wpDrop('cond','${wid}',${ci},event)"`,
          (ci, v) => `widgetUpdateCond('${wid}',${ci},'value2',${v})`,
          (ci, v) => `widgetUpdateCond('${wid}',${ci},'elementKey',${v})`
        );

        // ── Sort rows ────────────────────────────────────────────────────
        const renderSorts = () => renderSortRows(
          sorts, cols,
          (si, v) => `widgetUpdateSort('${wid}',${si},'field',${v})`,
          (si, v) => `widgetUpdateSort('${wid}',${si},'dir',${v})`,
          (si)    => `widgetRemoveSort('${wid}',${si})`,
          (si)    => `draggable="true" ondragstart="_wpDragStart('sort','${wid}',${si},event)" ondragover="_wpDragOver(event)" ondragleave="_wpDragLeave(event)" ondrop="_wpDrop('sort','${wid}',${si},event)"`
        );

        // ── Group-by (auto-derived, read-only display) ───────────────────
        const anyAgg = _wsp.some(sp => sp.agg);
        const renderGroupBy = () => {
          if (!anyAgg) return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Set aggregates on fields above to enable grouping</div>';
          if (isChart) {
            const nonAggY = _wsp.filter(sp => !sp.agg).map(sp => sp.field).filter(Boolean);
            const groupCols = [w.xField, ...nonAggY].filter(Boolean);
            const uniq = [...new Set(groupCols)];
            if (!uniq.length || (w.xField && uniq.length === 1 && _wsp.every(sp => sp.agg))) {
              return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All Y fields aggregated — grouping by X field only</div>';
            }
            return `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${uniq.join(', ')}</div>`;
          }
          const nonAggCols = _wsp.filter(sp => !sp.agg).map(sp => sp.field).filter(Boolean);
          if (!nonAggCols.length) return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">All fields aggregated — no GROUP BY needed</div>';
          return `<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">Auto: ${nonAggCols.join(', ')}</div>`;
        };

        const _wtypeOpts = DataLaVistaCore.WIDGET_TYPES.map(function(t) {
          return '<option value="' + t.id + '"' + (t.id === _wa.type ? ' selected' : '') + '>' + t.label + '</option>';
        }).join('');
        const _showHdrsRow = isTable
          ? '<div class="props-row"><label>Show headers</label>'
            + '<input type="checkbox" ' + (_wa.showHeaders!==false?'checked':'') + ' onchange="updateWidgetProp(\'' + wid + '\',\'showHeaders\',this.checked)"/></div>'
          : '';
        const _titleHint = (w.title && w.title.includes('{{')) ? ('→ ' + resolveTitleTemplate(w.title)) : '';
        var _interactionVals = ['','cross-filter','cross-highlight','none'];
        var _interactionLabels = ['(inherit report)','cross-filter','cross-highlight','none'];
        var _interactionOpts = '';
        for (var _ivi = 0; _ivi < _interactionVals.length; _ivi++) {
          var _ivSel = ((w.interactionMode || '') === _interactionVals[_ivi]) ? ' selected' : '';
          _interactionOpts += '<option value="' + _interactionVals[_ivi] + '"' + _ivSel + '>' + _interactionLabels[_ivi] + '</option>';
        }
        var _wtDef = (/** @type {any[]} */ (DataLaVistaCore.WIDGET_TYPES)).find(function(t) { return t.id === _wa.type; });
        var _interactionRow = (_wtDef && _wtDef.supportsInteraction)
          ? '<div class="props-row"><label>Interaction</label><select class="form-input" onchange="updateWidgetProp(\'' + wid + '\',\'interactionMode\',this.value)">' + _interactionOpts + '</select></div>'
          : '';
        // Width row: hidden for container children
        var _widthRow = w.parentContainerId
          ? ''
          : '<div class="props-row"><label>Width %</label><input type="number" class="form-input" min="10" max="100" step="0.25" value="' + w.widthPct + '" oninput="updateWidgetProp(\'' + wid + '\',\'widthPct\',Math.round(+this.value*4)/4)"/></div>';
        // Height row: containers use minHeightVh, others use heightVh
        var _heightRow;
        if (w.type === 'container') {
          _heightRow = '<div class="props-row"><label>Min Height vh</label><input type="number" class="form-input" min="5" max="200" step="0.25" value="' + (w.minHeightVh || 30) + '" oninput="updateWidgetProp(\'' + wid + '\',\'minHeightVh\',Math.round(+this.value*4)/4)"/></div>';
        } else {
          _heightRow = '<div class="props-row"><label>Height vh</label><input type="number" class="form-input" min="5" max="100" step="0.25" value="' + w.heightVh + '" oninput="updateWidgetProp(\'' + wid + '\',\'heightVh\',Math.round(+this.value*4)/4)"/></div>';
        }
        // Container-specific layout section
        var _containerSection = '';
        if (w.type === 'container') {
          var _alignOpts = '';
          var _alignVals = ['top','space-between','stretch'];
          for (var _aai = 0; _aai < _alignVals.length; _aai++) {
            var _aaSel = ((w.containerAlign || 'top') === _alignVals[_aai]) ? ' selected' : '';
            _alignOpts += '<option value="' + _alignVals[_aai] + '"' + _aaSel + '>' + _alignVals[_aai] + '</option>';
          }
          _containerSection = '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr">CONTAINER LAYOUT</div>'
            + '<div class="props-row"><label>Gap (px)</label><input type="number" class="form-input" min="0" max="64" value="' + (w.containerGap != null ? w.containerGap : 8) + '" oninput="updateWidgetProp(\'' + wid + '\',\'containerGap\',+this.value)"/></div>'
            + '<div class="props-row"><label>Padding (px)</label><input type="number" class="form-input" min="0" max="64" value="' + (w.containerPadding != null ? w.containerPadding : 8) + '" oninput="updateWidgetProp(\'' + wid + '\',\'containerPadding\',+this.value)"/></div>'
            + '<div class="props-row"><label>Align</label><select class="form-input" onchange="updateWidgetProp(\'' + wid + '\',\'containerAlign\',this.value)">' + _alignOpts + '</select></div>'
            + '<div style="font-size:11px;color:var(--text-secondary);padding:4px 0">Drag widget headers into this container. Drag out onto canvas to un-parent.</div>'
            + '</div>';
        }
        // Pre-compute conditional HTML blocks (no nested backtick or ternary in template)
        var _showTitleChecked = (w.showTitle !== false) ? 'checked' : '';
        var _wTitleEsc   = w.title.replace(/"/g, '&quot;');
        var _wWidgetBg              = w.widgetBackgroundColor || '#fefefe';
        var _wWidgetBgText          = w.widgetBackgroundColor || '';
        var _wWidgetBgIsTransparent = !w.widgetBackgroundColor;
        var _wTitleBg    = w.titleBackgroundColor  || '#fefefe';
        var _wTitleFs    = w.titleFontSize || 12;
        var _wTitleFc    = w.titleFontColor || '#323130';
        var _wFillColor  = w.fillColor;
        var _wBorderColor = w.borderColor;
        var _wBorderSize  = w.borderSize;
        var _chartBgRowHTML = '';
        if (isChart) {
          var _cbc = w.chartBackgroundColor || '#fefefe';
          _chartBgRowHTML = '<div class="props-row"><label>Chart bg</label>'
            + '<div class="color-input-wrap">'
            + '<input type="color" value="' + _cbc + '" oninput="updateWidgetProp(\'' + wid + '\',\'chartBackgroundColor\',this.value)"/>'
            + '<input type="text" class="form-input" value="' + _cbc + '" oninput="updateWidgetProp(\'' + wid + '\',\'chartBackgroundColor\',this.value)"/>'
            + '</div></div>';
        }
        var _tableHeaderRowsHTML = '';
        if (isTable) {
          var _hbc = w.headersBackgroundColor || '#f3f2f1';
          var _hfs = w.headersFontSize || 12;
          var _hfc = w.headersFontColor || '#323130';
          _tableHeaderRowsHTML = '<div class="props-row"><label>Header bg</label>'
            + '<div class="color-input-wrap">'
            + '<input type="color" value="' + _hbc + '" oninput="updateWidgetProp(\'' + wid + '\',\'headersBackgroundColor\',this.value)"/>'
            + '<input type="text" class="form-input" value="' + _hbc + '" oninput="updateWidgetProp(\'' + wid + '\',\'headersBackgroundColor\',this.value)"/>'
            + '</div></div>'
            + '<div class="props-row"><label>Header font</label>'
            + '<div class="color-input-wrap">'
            + '<input type="number" class="form-input" min="8" max="32" value="' + _hfs + '" oninput="updateWidgetProp(\'' + wid + '\',\'headersFontSize\',+this.value)" style="width:50px" title="Header font size"/>'
            + '<input type="color" value="' + _hfc + '" oninput="updateWidgetProp(\'' + wid + '\',\'headersFontColor\',this.value)" title="Header font color"/>'
            + '<input type="text" class="form-input" value="' + _hfc + '" oninput="updateWidgetProp(\'' + wid + '\',\'headersFontColor\',this.value)"/>'
            + '</div></div>';
        }
        var _textPropsHTML = '';
        if (isText) {
          _textPropsHTML = '<div class="props-row"><label>Font size</label>'
            + '<input type="number" class="form-input" min="8" max="72" value="' + w.fontSize + '" oninput="updateWidgetProp(\'' + wid + '\',\'fontSize\',+this.value)"/></div>'
            + '<div class="props-row"><label>Font color</label>'
            + '<div class="color-input-wrap">'
            + '<input type="color" value="' + w.fontColor + '" oninput="updateWidgetProp(\'' + wid + '\',\'fontColor\',this.value)"/>'
            + '<input type="text" class="form-input" value="' + w.fontColor + '" oninput="updateWidgetProp(\'' + wid + '\',\'fontColor\',this.value)"/>'
            + '</div></div>'
            + '<div class="props-row" style="flex-direction:column;align-items:flex-start"><label>Content</label>'
            + '<textarea class="form-input" rows="4" onblur="updateWidgetProp(\'' + wid + '\',\'textContent\',this.value)">' + w.textContent + '</textarea></div>';
        }
        var _dataSectionHTML = '';
        if (isData) {
          var _chartFieldsHTML = '';
          if (isChart) {
            var _xFVal = (Array.isArray(w.dimensions) && w.dimensions.length) ? w.dimensions[0] : (w.xField || '');
            _chartFieldsHTML = fieldRow('X', _xFVal, "updateWidgetProp('" + wid + "','dimensions',[this.value]);renderWidgetProperties('" + wid + "')", 0)
              + '<div class="adv-drop-zone" style="margin-top:2px;margin-bottom:4px;text-align:center;padding:4px;font-size:11px"'
              + ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')"'
              + ' ondrop="_wpDropFieldToSection(\'' + wid + '\',\'x\',event)">Drop to set X field</div>'
              + '<div class="adv-node-section-hdr" style="margin-top:6px"><span>Y FIELDS</span>'
              + '<button class="btn btn-ghost btn-sm" onclick="widgetAddYField(\'' + wid + '\')">+ Add</button></div>'
              + _renderYFieldsHTML(w, wid, cols)
              + '<div class="adv-drop-zone" style="margin-top:4px;text-align:center;padding:4px;font-size:11px"'
              + ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')"'
              + ' ondrop="_wpDropFieldToSection(\'' + wid + '\',\'y\',event)">Drop to add Y field</div>'
              + _renderBarLineOptionsHTML(w, wid)
              + _renderScatterOptionsHTML(w, wid, cols);
          }
          var _kpiFieldsHTML = '';
          if (isKPI) {
            var _kpiLabelEsc = (w.kpiLabelOverride || '').replace(/"/g, '&quot;');
            var _kpiPlaceholderEsc = (w.fields[0] || 'field name').replace(/"/g, '&quot;');
            _kpiFieldsHTML = fieldRow('', w.fields[0] || cols[0] || '', "updateWidgetProp('" + wid + "','fields',[this.value]);renderWidgetProperties('" + wid + "')")
              + '<div class="adv-node-section-hdr" style="margin-top:8px"><span>KPI DISPLAY</span></div>'
              + '<div class="props-row"><label>Metric size</label>'
              + '<input type="number" class="form-input" min="8" max="120" value="' + (w.kpiMetricFontSize || 36) + '" oninput="updateWidgetProp(\'' + wid + '\',\'kpiMetricFontSize\',+this.value)" style="width:60px"/></div>'
              + '<div class="props-row"><label>Label size</label>'
              + '<input type="number" class="form-input" min="8" max="48" value="' + (w.kpiLabelFontSize || 13) + '" oninput="updateWidgetProp(\'' + wid + '\',\'kpiLabelFontSize\',+this.value)" style="width:60px"/></div>'
              + '<div class="props-row"><label>Label text</label>'
              + '<input type="text" class="form-input" value="' + _kpiLabelEsc + '" placeholder="' + _kpiPlaceholderEsc + '" oninput="updateWidgetProp(\'' + wid + '\',\'kpiLabelOverride\',this.value)"/></div>';
          }
          var _tableFieldsHTML = '';
          if (isTable) {
            if (w.fields.length) {
              for (var _tfi = 0; _tfi < w.fields.length; _tfi++) {
                _tableFieldsHTML += tableFieldRow(w.fields[_tfi], _tfi);
              }
            } else {
              _tableFieldsHTML = '<div style="font-size:11px;color:var(--text-disabled);padding:4px 0">Drop fields from the left panel</div>';
            }
          }
          var _tableDropZoneHTML = '';
          if (isTable) {
            _tableDropZoneHTML = '<div class="adv-drop-zone" style="margin-top:4px;text-align:center;padding:5px;font-size:11px"'
              + ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"'
              + ' ondragleave="this.classList.remove(\'drag-over\')"'
              + ' ondrop="onDropFieldToWidget(\'' + wid + '\',event)">Drop field to add column</div>';
          }
          _dataSectionHTML = '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr"><span>FIELDS</span></div>'
            + _chartFieldsHTML
            + _kpiFieldsHTML
            + _tableFieldsHTML
            + _tableDropZoneHTML
            + '</div>'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr"><span>FILTER CONDITIONS</span>'
            + '<button class="btn btn-ghost btn-sm" onclick="widgetAddCond(\'' + wid + '\')">+ Add</button></div>'
            + '<div>' + renderConditions() + '</div>'
            + '<div class="adv-drop-zone" style="margin-top:4px;text-align:center;padding:4px;font-size:11px"'
            + ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"'
            + ' ondragleave="this.classList.remove(\'drag-over\')"'
            + ' ondrop="_wpDropFieldToSection(\'' + wid + '\',\'cond\',event)">Drop to add filter</div>'
            + '</div>'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr"><span>SORT ORDER</span>'
            + '<button class="btn btn-ghost btn-sm" onclick="widgetAddSort(\'' + wid + '\')">+ Add</button></div>'
            + '<div>' + renderSorts() + '</div>'
            + '<div class="adv-drop-zone" style="margin-top:4px;text-align:center;padding:4px;font-size:11px"'
            + ' ondragover="event.preventDefault();this.classList.add(\'drag-over\')"'
            + ' ondragleave="this.classList.remove(\'drag-over\')"'
            + ' ondrop="_wpDropFieldToSection(\'' + wid + '\',\'sort\',event)">Drop to add sort</div>'
            + '</div>'
            + '<div class="adv-node-section">'
            + '<div class="adv-node-section-hdr"><span>GROUP BY</span></div>'
            + '<div>' + renderGroupBy() + '</div>'
            + '</div>'
            + '<div style="display:flex;justify-content:flex-end;padding:4px 0 8px">'
            + '<button class="btn btn-ghost btn-sm" aria-label="Peek at SQL Code" onclick="peekWidgetSQL(\'' + wid + '\',this)">📜</button>'
            + '</div>';
        }
        section.innerHTML = '<div class="adv-node-section">'
          + '<div class="adv-node-section-hdr">GENERAL</div>'
          + '<div class="props-row"><label>Title</label>'
          + '<input type="text" class="form-input" value="' + _wTitleEsc + '" onblur="updateWidgetProp(\'' + wid + '\',\'title\',this.value)"/>'
          + '<div id="dlv-title-template-hint-' + wid + '" style="font-size:10px;color:var(--text-secondary,#605e5c);font-style:italic;margin-top:2px">' + _titleHint + '</div></div>'
          + '<div class="props-row"><label>Show title</label>'
          + '<input type="checkbox" ' + _showTitleChecked + ' onchange="updateWidgetProp(\'' + wid + '\',\'showTitle\',this.checked)"/></div>'
          + _showHdrsRow
          + '<div class="props-row"><label>Type</label>'
          + '<select class="form-input" onchange="changeWidgetType(\'' + wid + '\',this.value)">' + _wtypeOpts + '</select></div>'
          + _interactionRow
          + _widthRow
          + _heightRow
          + '</div>'
          + _containerSection
          + '<div class="adv-node-section">'
          + '<div class="adv-node-section-hdr">APPEARANCE</div>'
          + '<div class="props-row"><label>Widget bg</label>'
          + '<div class="color-input-wrap">'
          + (_wWidgetBgIsTransparent ? '' : '<input type="color" value="' + _wWidgetBg + '" oninput="updateWidgetProp(\'' + wid + '\',\'widgetBackgroundColor\',this.value)"/>')
          + '<input type="text" class="form-input" value="' + _wWidgetBgText + '" placeholder="transparent" oninput="updateWidgetProp(\'' + wid + '\',\'widgetBackgroundColor\',this.value)"/>'
          + '<button type="button" title="Set transparent" style="padding:0 4px;line-height:1;cursor:pointer" onclick="updateWidgetProp(\'' + wid + '\',\'widgetBackgroundColor\',\'\')">×</button>'
          + '</div></div>'
          + '<div class="props-row"><label>Title bg</label>'
          + '<div class="color-input-wrap">'
          + '<input type="color" value="' + _wTitleBg + '" oninput="updateWidgetProp(\'' + wid + '\',\'titleBackgroundColor\',this.value)"/>'
          + '<input type="text" class="form-input" value="' + _wTitleBg + '" oninput="updateWidgetProp(\'' + wid + '\',\'titleBackgroundColor\',this.value)"/>'
          + '</div></div>'
          + '<div class="props-row"><label>Title font</label>'
          + '<div class="color-input-wrap">'
          + '<input type="number" class="form-input" min="8" max="48" value="' + _wTitleFs + '" oninput="updateWidgetProp(\'' + wid + '\',\'titleFontSize\',+this.value)" style="width:50px" title="Title font size"/>'
          + '<input type="color" value="' + _wTitleFc + '" oninput="updateWidgetProp(\'' + wid + '\',\'titleFontColor\',this.value)" title="Title font color"/>'
          + '<input type="text" class="form-input" value="' + _wTitleFc + '" oninput="updateWidgetProp(\'' + wid + '\',\'titleFontColor\',this.value)"/>'
          + '</div></div>'
          + '<div class="props-row"><label>Fill/Accent</label>'
          + '<div class="color-input-wrap">'
          + '<input type="color" value="' + _wFillColor + '" oninput="updateWidgetProp(\'' + wid + '\',\'fillColor\',this.value)"/>'
          + '<input type="text" class="form-input" value="' + _wFillColor + '" oninput="updateWidgetProp(\'' + wid + '\',\'fillColor\',this.value)"/>'
          + '</div></div>'
          + '<div class="props-row"><label>Border</label>'
          + '<div class="color-input-wrap">'
          + '<input type="color" value="' + _wBorderColor + '" oninput="updateWidgetProp(\'' + wid + '\',\'borderColor\',this.value)"/>'
          + '<input type="number" class="form-input" value="' + _wBorderSize + '" min="0" max="10" oninput="updateWidgetProp(\'' + wid + '\',\'borderSize\',+this.value)" style="width:50px"/>'
          + '</div></div>'
          + _chartBgRowHTML
          + _tableHeaderRowsHTML
          + _textPropsHTML
          + '</div>'
          + _dataSectionHTML;
      }


      function updateWidgetProp(wid, prop, value) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;

        // dimensions: keep xField in sync for legacy compat
        if (prop === 'dimensions') {
          w.dimensions = Array.isArray(value) ? value : [value];
          w.xField = w.dimensions[0] || '';
        } else if (['kpiMetricFontSize','kpiLabelFontSize','kpiLabelOverride',
                    'bubbleSizeField','bubbleColorField',
                    'showHeaders','headersBackgroundColor','headersFontSize','headersFontColor'].includes(prop)) {
          if (!w.typeConfig) w.typeConfig = {};
          w.typeConfig[prop] = value;
          w[prop] = value; // legacy compat
        } else {
          w[prop] = value;
        }

        // Live-update element
        const el = document.getElementById('widget-' + wid);
        if (!el) return;
        const hdr = el.querySelector('.widget-header');
        const titleEl = el.querySelector('.widget-title');

        if (prop === 'title') {
          if (titleEl) titleEl.textContent = resolveTitleTemplate(value);
          // Update hint in properties panel
          const hintEl = document.getElementById('dlv-title-template-hint-' + wid);
          if (hintEl) hintEl.textContent = value && value.includes('{{') ? '→ ' + resolveTitleTemplate(value) : '';
        }
        if (prop === 'showTitle' && hdr) {
          if (value) {
            hdr.hidden = false;
            hdr.style.opacity = '';
          } else {
            if (DataLaVistaState.activeTab === 'design') {
              hdr.hidden = false;
              hdr.style.opacity = '0.3';
            } else {
              hdr.hidden = true;
              hdr.style.opacity = '';
            }
          }
        }
        if (prop === 'widthPct') el.style.width = value + '%';
        if (prop === 'heightVh') { el.style.height = value + 'vh'; if (DataLaVistaState.charts[wid]) DataLaVistaState.charts[wid].resize(); }
        if (prop === 'minHeightVh') { el.style.minHeight = value + 'vh'; }
        if (prop === 'containerGap' || prop === 'containerPadding' || prop === 'containerAlign') {
          var cContent = el.querySelector('.widget-content');
          if (cContent) {
            var w2 = DataLaVistaState.design.widgets.find(function(x) { return x.id === wid; });
            if (w2) {
              var alignMap2 = { 'top': 'flex-start', 'space-between': 'space-between', 'stretch': 'stretch' };
              var justifyVal2 = alignMap2[w2.containerAlign || 'top'] || 'flex-start';
              cContent.style.gap = (w2.containerGap || 8) + 'px';
              cContent.style.padding = (w2.containerPadding || 8) + 'px';
              cContent.style.justifyContent = justifyVal2;
            }
          }
        }
        if (prop === 'borderColor') el.style.borderColor = value;
        if (prop === 'borderSize') el.style.borderWidth = value + 'px';
        if (prop === 'widgetBackgroundColor') el.style.background = value || 'transparent';
        if (prop === 'titleBackgroundColor' && hdr) hdr.style.background = value;
        if (prop === 'titleFontSize' && titleEl instanceof HTMLElement) titleEl.style.fontSize = value + 'px';
        if (prop === 'titleFontColor' && titleEl instanceof HTMLElement) titleEl.style.color = value;
        if (prop === 'textContent' && w.type === 'text') el.querySelector('.text-widget').innerHTML = value;
        if (prop === 'fontSize' && w.type === 'text') el.querySelector('.text-widget').style.fontSize = value + 'px';
        if (prop === 'fontColor' && w.type === 'text') el.querySelector('.text-widget').style.color = value;
        // Table-specific: re-render for header style / visibility changes
        if (['showHeaders','headersBackgroundColor','headersFontSize','headersFontColor','fields'].includes(prop) && w.type === 'table')
          el.querySelector('.widget-content').innerHTML = renderTableContent(w);
        if (['xField', 'dimensions', 'yField', 'yFields', 'aggregation', 'fieldAggs', 'fillColor', 'fields',
             'stacked', 'showTrendLine', 'ySeriesProps', 'seriesProps', 'bubbleSizeField', 'bubbleColorField',
             'chartBackgroundColor'].includes(prop) && isEChartsWidget(w.type)) renderChart(w);
        if (['xField', 'dimensions', 'yField', 'aggregation', 'fieldAggs', 'fillColor', 'fields',
             'kpiMetricFontSize', 'kpiLabelFontSize', 'kpiLabelOverride'].includes(prop) && w.type === 'kpi')
          el.querySelector('.widget-content').innerHTML = renderKPIContent(w);
      }

      function changeWidgetType(wid, newType) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const prevIsChart = isEChartsWidget(w.type);
        const newIsChart  = isEChartsWidget(newType);
        w.type = newType;

        // Switching chart → table/kpi: chart seriesProps are stale for a table/kpi
        // which uses w.fields as its source of truth. Clear them so _getSeriesProps
        // reconstructs properly from w.fields.
        if (prevIsChart && !newIsChart) {
          w.seriesProps = [];
        }
        // Switching table/kpi → chart: seed xField + seriesProps from w.fields so
        // the chart has something to render immediately.
        if (!prevIsChart && newIsChart && w.fields && w.fields.length) {
          if (!w.xField) w.xField = w.fields[0] || '';
          if (!w.seriesProps || !w.seriesProps.length) {
            w.seriesProps = w.fields.slice(1).map(f => ({
              field: f, agg: '', label: '', color: '', seriesType: '', axisSide: '', conditions: []
            }));
          }
        }

        // Refresh the widget canvas and properties panel
        const el = document.getElementById('widget-' + wid);
        if (!el) return;
        const content = el.querySelector('.widget-content');
        content.innerHTML = getWidgetContentHTML(w);
        if (DataLaVistaState.charts[wid]) { try { DataLaVistaState.charts[wid].dispose(); } catch (e) { } delete DataLaVistaState.charts[wid]; }
        if (DataLaVistaState._chartROs && DataLaVistaState._chartROs[wid]) { try { DataLaVistaState._chartROs[wid].disconnect(); } catch(e) {} delete DataLaVistaState._chartROs[wid]; }
        if (newIsChart) {
          requestAnimationFrame(() => renderChart(w));
        }
        renderWidgetProperties(wid);
      }

      function removeWidgetField(wid, idx) {
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const removed = w.fields[idx];
        w.fields.splice(idx, 1);
        // Keep seriesProps in sync so the SQL stays consistent with the visible field list.
        if (removed && Array.isArray(w.seriesProps)) {
          w.seriesProps = w.seriesProps.filter(sp => sp.field !== removed);
        }
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
        if (!field) return;
        const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
        if (!w) return;
        const isChart = isEChartsWidget(w.type);
        const isKPI   = w.type === 'kpi';
        if (isChart) {
          // Add to Y fields with default agg (none for numbers, COUNT for others)
          if (!Array.isArray(w.yFields)) w.yFields = [];
          if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
          if (!w.yFields.includes(field)) {
            const defaultAgg = (field === '__dlv_count__' || sniffType(field) === 'number') ? '' : 'COUNT';
            w.yFields.push(field);
            w.seriesProps.push({ field, agg: defaultAgg, label: '', color: '', seriesType: '', lineWidth: null, opacity: null, smooth: null, axisSide: '', conditions: [] });
            _widgetRefresh(wid);
          }
        } else if (isKPI) {
          w.fields = [field];
          _widgetRefresh(wid);
        } else {
          // table — push to both w.fields and w.seriesProps so buildWidgetSQL sees the new column
          if (!w.fields.includes(field)) {
            w.fields.push(field);
            if (!Array.isArray(w.seriesProps)) w.seriesProps = _getSeriesProps(w);
            if (!w.seriesProps.some(sp => sp.field === field))
              w.seriesProps.push({ field, agg: '', label: '', color: '', seriesType: '', lineWidth: null, opacity: null, smooth: null, axisSide: '', conditions: [] });
            _widgetRefresh(wid);
          }
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
        var w = DataLaVistaState.design.widgets.find(function(x) { return x.id === wid; });
        if (!w) return;
        // Containers hold child widget DOM nodes directly; never wipe their innerHTML.
        // Child widgets are updated individually by subsequent iterations of the caller loop.
        if (w.type === 'container') return;
        var el = document.getElementById('wcontent-' + wid);
        if (!el) return;
        el.innerHTML = getWidgetContentHTML(w);
        if (isEChartsWidget(w.type)) requestAnimationFrame(function() { renderChart(w); });
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
          var _f = /** @type {*} */ (f);
          const fieldType = sniffType(_f.field);
          const isBoolean = fieldType === 'boolean';
          const isDate    = fieldType === 'date';

          const wrap = document.createElement('div');
          wrap.className = 'filter-pill';
          wrap.style.cssText = 'display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);padding:4px 8px;border-radius:var(--radius)';

          const lbl = document.createElement('span');
          lbl.style.cssText = 'font-size:12px;font-weight:600';
          lbl.innerText = _f.label || _f.field;

          var _pf = /** @type {*} */ (DataLaVistaState.previewFilters);
          let input;
          if (isBoolean) {
            input = document.createElement('select');
            input.className = 'form-input';
            input.style.cssText = 'height:24px;padding:0 24px 0 6px';
            var _boolTrueSel  = _pf[_f.field] === 'true'  ? 'selected' : '';
            var _boolFalseSel = _pf[_f.field] === 'false' ? 'selected' : '';
            input.innerHTML = '<option value="(All)">(All)</option>'
              + '<option value="true" '  + _boolTrueSel  + '>True</option>'
              + '<option value="false" ' + _boolFalseSel + '>False</option>';
            input.onchange = (e) => {
              if (e.target.value === '(All)') delete _pf[_f.field];
              else _pf[_f.field] = e.target.value;
              refreshWidgets();
            };
          } else if (isDate) {
            input = document.createElement('input');
            input.type = 'date';
            input.className = 'form-input';
            input.style.cssText = 'height:24px;padding:0 4px';
            input.value = _pf[_f.field] || '';
            input.onchange = (e) => {
              if (!e.target.value) delete _pf[_f.field];
              else _pf[_f.field] = e.target.value;
              refreshWidgets();
            };
          } else {
            let uniqueVals = [];
            const _tk = findTableKeyForAlias(_f.field);
            const _fMeta = _tk && DataLaVistaState.tables[_tk]
              ? DataLaVistaState.tables[_tk].fields.find(x => x.alias === _f.field)
              : null;
            const _isLookupField = _fMeta && _fMeta.displayType === 'lookup';
            if (alasql.tables && alasql.tables['dlv_results']) {
              const rawVals = alasql('SELECT * FROM [dlv_results]').map(r => r[_f.field]).filter(v => v !== null && v !== undefined);
              if (_isLookupField) {
                // Lookup fields store semicolon-separated text — split and deduplicate
                const allParts = [];
                for (const v of rawVals) {
                  for (const part of String(v).split(';')) {
                    const t = part.trim();
                    if (t) allParts.push(t);
                  }
                }
                uniqueVals = [...new Set(allParts)].sort();
              } else {
                uniqueVals = [...new Set(rawVals)].sort();
              }
            }
            input = document.createElement('select');
            input.className = 'form-input';
            input.style.cssText = 'height:24px;padding:0 24px 0 6px';
            var _uOpts = '<option value="(All)">(All)</option>';
            for (var _ui = 0; _ui < uniqueVals.length; _ui++) {
              var _uv = uniqueVals[_ui];
              _uOpts += '<option value="' + _uv + '">' + _uv + '</option>';
            }
            input.innerHTML = _uOpts;
            input.value = _pf[_f.field] || '(All)';
            input.onchange = (e) => {
              if (e.target.value === '(All)') delete _pf[_f.field];
              else _pf[_f.field] = e.target.value;
              refreshWidgets();
            };
          }

          const del = document.createElement('span');
          del.innerHTML = '✕';
          del.style.cssText = 'cursor:pointer;font-size:10px';
          del.onclick = () => removeFilterFromBar(_f.field);

          wrap.appendChild(lbl); wrap.appendChild(input); wrap.appendChild(del);
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

      function _filterFieldIsLookup(fieldAlias) {
        const tk = findTableKeyForAlias(fieldAlias);
        const fm = tk && DataLaVistaState.tables[tk]
          ? DataLaVistaState.tables[tk].fields.find(x => x.alias === fieldAlias)
          : null;
        return !!(fm && fm.displayType === 'lookup');
      }

      function refreshWidgets() {
        const hasView = !!(alasql.tables && alasql.tables['dlv_results']);
        if (hasView) {
          const allFilters = { ...(DataLaVistaState.previewFilters || {}), ...(DataLaVistaState.drillFilters || {}) };
          const whereClauses = Object.entries(allFilters).map(([f, v]) => {
            const vEsc = String(v).replace(/'/g, "''");
            if (_filterFieldIsLookup(f)) {
              // Match individual values within semicolon-separated lookup text
              return `([${f}] = '${vEsc}' OR [${f}] LIKE '${vEsc};%' OR [${f}] LIKE '%;${vEsc}' OR [${f}] LIKE '%;${vEsc};%')`;
            }
            return `[${f}] = '${vEsc}'`;
          });
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
      // DYNAMIC TITLE TEMPLATE RESOLUTION
      // ============================================================

      /**
       * Resolve {{FIRST(FieldName)}} or {{FieldName}} tokens against [dlv_active].
       * No caching — AlaSQL FIRST() is microseconds. Re-resolves on every render,
       * so titles stay live after filter changes.
       */
      function resolveTitleTemplate(template) {
        if (!template || !template.includes('{{')) return template || '';
        if (!(alasql.tables && alasql.tables['dlv_active'])) return template;
        return template.replace(/\{\{(?:([A-Za-z_]+)\()?([^})]+)\)?\}\}/g, function(/** @type {string} */ match, /** @type {string|undefined} */ agg, /** @type {string} */ field) {
          agg = (agg || 'FIRST').toUpperCase();
          field = field.trim();
          try {
            const rows = alasql('SELECT ' + agg + '([' + field + ']) AS val FROM [dlv_active]');
            return (rows && rows[0] && rows[0].val != null) ? String(rows[0].val) : match;
          } catch(_) { return match; }
        });
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

      /**
       * Highlight matching data points across all connected charts without re-querying.
       * Uses ECharts dispatchAction('highlight') keyed on the dimension value name.
       * Does NOT modify [dlv_active] — purely visual. Mode: 'cross-highlight'.
       */
      function _refreshTableWidgets() {
        for (var _rtwi = 0; _rtwi < DataLaVistaState.design.widgets.length; _rtwi++) {
          var _rtwW = /** @type {any} */ (DataLaVistaState.design.widgets[_rtwi]);
          if (_rtwW.type !== 'table') continue;
          var _rtwDe = document.getElementById('wcontent-' + _rtwW.id);
          if (_rtwDe) _rtwDe.innerHTML = renderTableContent(_rtwW);
          var _rtwPr = document.getElementById('prev-wcontent-' + _rtwW.id);
          if (_rtwPr) _rtwPr.innerHTML = renderTableContent(_rtwW);
        }
      }

      function _applyDrillHighlight(/** @type {string} */ field, /** @type {string} */ value) {
        (/** @type {any} */ (DataLaVistaState)).drillHighlight = { field: field, value: value };
        var strVal = String(value);
        var _hlCharts = /** @type {any} */ (DataLaVistaState.charts);
        for (var _hlCId of Object.keys(_hlCharts)) {
          var _hlChart = _hlCharts[_hlCId];
          var _hlWid   = _hlCId.replace(/^prev_/, '');
          var _hlW     = /** @type {any} */ ((DataLaVistaState.design.widgets || []).find(function(x) { return (/** @type {any} */ (x)).id === _hlWid; }));
          if (!_hlW) continue;
          var _hlDims  = (Array.isArray(_hlW.dimensions) && _hlW.dimensions.length) ? _hlW.dimensions : (_hlW.xField ? [_hlW.xField] : []);
          if (!_hlDims.includes(field)) continue;
          if (_hlW.type === 'pie') {
            try { _hlChart.dispatchAction({ type: 'highlight', name: strVal }); } catch(e) {}
          } else {
            try {
              var _hlRows = buildWidgetData(_hlW);
              var _hlXDim = _hlDims[0];
              var _hlSp   = _getSeriesProps(_hlW);
              var _hlIdx  = -1;
              if (_hlRows) {
                for (var _hlRi = 0; _hlRi < _hlRows.length; _hlRi++) {
                  if (String(_hlRows[_hlRi][_hlXDim]) === strVal) { _hlIdx = _hlRi; break; }
                }
              }
              if (_hlIdx >= 0) {
                for (var _hlSi = 0; _hlSi < _hlSp.length; _hlSi++) {
                  _hlChart.dispatchAction({ type: 'highlight', seriesIndex: _hlSi, dataIndex: _hlIdx });
                }
              }
            } catch(e) {}
          }
        }
        _refreshTableWidgets();
        _renderAllDrillChips();
      }

      /** Clear all cross-highlights on every chart instance. */
      function _clearDrillHighlight() {
        DataLaVistaState.drillHighlight = null;
        for (const chart of Object.values(DataLaVistaState.charts)) {
          try { chart.dispatchAction({ type: 'downplay' }); } catch(e) {}
        }
        _refreshTableWidgets();
        _renderAllDrillChips();
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
        bar.querySelectorAll('.dlv-drill-chip').forEach(el => el.remove());
        const drills    = Object.entries(DataLaVistaState.drillFilters || {});
        const highlight = DataLaVistaState.drillHighlight;
        if (!drills.length && !highlight) return;
        bar.classList.remove('hidden');
        // Drill filter chips (🔍 blue)
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
        // Highlight chip (👁 amber) — no re-query, purely visual
        if (highlight) {
          const chip = document.createElement('div');
          chip.className = 'filter-pill dlv-drill-chip';
          chip.style.cssText = 'display:flex;align-items:center;gap:5px;background:#fff4ce;border:1px solid #ffb900;padding:4px 8px;border-radius:var(--radius,4px)';
          const safeField = highlight.field.replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const safeValue = String(highlight.value).replace(/</g,'&lt;').replace(/>/g,'&gt;');
          chip.innerHTML = `<span style="font-size:10px">👁</span>`
            + `<span style="font-size:12px;font-weight:600;color:#8a6914">${safeField}</span>`
            + `<span style="font-size:11px;color:var(--text-secondary)">=</span>`
            + `<span style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safeValue}">${safeValue}</span>`
            + `<button class="btn btn-ghost btn-sm btn-icon" style="padding:0 2px;font-size:10px" title="Clear highlight" onclick="_clearDrillHighlight()">✕</button>`;
          bar.appendChild(chip);
        }
        // "Clear all" only for multiple drill filters
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
        if (!document.getElementById('preview-canvas')) return;
        for (const w of DataLaVistaState.design.widgets) {
          if (w.type === 'container') continue;
          const contentEl = document.getElementById('prev-wcontent-' + w.id);
          if (!contentEl) continue;
          contentEl.innerHTML = getPrevWidgetContent(w);
          if (isEChartsWidget(w.type)) {
            requestAnimationFrame(() => renderPreviewChart(w));
          }
        }
      }

      function widgetAddYField(wid, field) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w || !DataLaVistaState.queryColumns.length) return;
  if (!Array.isArray(w.yFields)) w.yFields = w.yField ? [w.yField] : [];
  if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
  // Use supplied field, or pick the next best available column
  const next = field || DataLaVistaState.queryColumns.find(c =>
    sniffType(c) === 'number' && !w.yFields.includes(c)
  ) || DataLaVistaState.queryColumns.find(c => !w.yFields.includes(c))
    || DataLaVistaState.queryColumns[0];
  if (next) {
    w.yFields.push(next);
    w.seriesProps.push({ field: next, agg: '', label: '', color: '', seriesType: '', lineWidth: null, opacity: null, smooth: null, axisSide: '', conditions: [] });
  }
  _widgetRefresh(wid);
}

function widgetUpdateYField(wid, idx, val) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w || !Array.isArray(w.yFields)) return;
  if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
  w.yFields[idx] = val;
  if (w.seriesProps[idx]) w.seriesProps[idx].field = val;
  else w.seriesProps[idx] = { field: val, agg: '', label: '', color: '', seriesType: '', lineWidth: null, opacity: null, smooth: null, axisSide: '', conditions: [] };
  _widgetRefresh(wid);
}

function widgetRemoveYField(wid, idx) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w || !Array.isArray(w.yFields)) return;
  if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
  w.yFields.splice(idx, 1);
  w.seriesProps.splice(idx, 1);
  _widgetRefresh(wid);
}

function widgetUpdateYSeriesType(wid, yi, seriesType) {
  const w = DataLaVistaState.design.widgets.find(x => x.id === wid);
  if (!w) return;
  if (!Array.isArray(w.seriesProps) || !w.seriesProps.length) w.seriesProps = _getSeriesProps(w);
  if (!w.seriesProps[yi]) return;
  w.seriesProps[yi].seriesType = seriesType || '';
  _widgetRefresh(wid);
}

// ============================================================
// DATA DICTIONARY
// ============================================================

function _ddGetWidgetsUsingField(fieldName) {
  const widgets = (DataLaVistaState.design && DataLaVistaState.design.widgets) || [];
  return widgets.filter(function(w) {
    const inFields  = (w.fields  || []).includes(fieldName);
    const inX       = w.xField === fieldName;
    const inY       = isEChartsWidget(w.type) && (w.yFields || []).includes(fieldName);
    const inSeries  = (w.seriesProps || []).some(function(s) { return s.field === fieldName; });
    const inFilters = (w.filters || []).some(function(f) { return f.field === fieldName; });
    return inFields || inX || inY || inSeries || inFilters;
  });
}

let _ddSearchTimer = 0;
function _ddFilterCards(text) {
  clearTimeout(_ddSearchTimer);
  _ddSearchTimer = setTimeout(function() { _ddRenderCards(text); }, 200);
}

function _ddRenderCards(filterText) {
  const body = document.getElementById('dd-body');
  if (!body) return;

  const qcMeta = /** @type {Record<string,any>} */ (DataLaVistaState.queryColumnMeta);
  const cols   = DataLaVistaState.queryColumns;
  const lower  = (filterText || '').toLowerCase().trim();

  if (!cols.length) {
    body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary)">Run a query first to populate the data dictionary.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  let count = 0;

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    const m = qcMeta[col];

    if (lower) {
      const _tableDescSearch = m && m.sourceTableKey
        ? (/** @type {any} */ (DataLaVistaState.tables)[m.sourceTableKey] || {}).description || ''
        : '';
      const haystack = [col, m && m.sourceDisplayName, m && m.sourceInternalName,
        m && m.viewName, m && m.sourceTableName, m && m.sourceDataSource,
        m && m.sourceFieldDescription, _tableDescSearch]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(lower)) continue;
    }

    count++;
    const dt = sniffType(col);
    const ti = DataLaVistaCore.FIELD_TYPE_ICONS[dt] || DataLaVistaCore.FIELD_TYPE_ICONS.default;
    const usedWidgets = _ddGetWidgetsUsingField(col);

    const widgetsHtml = usedWidgets.length
      ? usedWidgets.map(function(w) {
          return '<span class="dd-widget-chip">' + _attrEnc(w.title || w.type) + '</span>';
        }).join('')
      : '<span class="dd-no-widgets">Not used in any widget yet</span>';

    const aggBadge = m && m.agg
      ? '<span class="dd-agg-badge">' + _attrEnc(m.agg) + '</span>'
      : '';

    const _fieldDescLive = (() => {
      if (!m || m.sourceFieldDescription || !m.sourceTableKey || !m.sourceAlias) return '';
      const _flds = /** @type {any[]} */ ((/** @type {any} */ (DataLaVistaState.tables))[m.sourceTableKey]?.fields || []);
      return _flds.find(f => (f.alias === m.sourceAlias || f.internalName === m.sourceAlias) && !f.parentField)?.description
          || _flds.find(f => f.alias === m.sourceAlias || f.internalName === m.sourceAlias)?.description
          || '';
    })();
    const fieldDescHtml = (m && (m.sourceFieldDescription || _fieldDescLive))
      ? '<div class="dd-card-desc">' + _attrEnc(m.sourceFieldDescription || _fieldDescLive) + '</div>'
      : '';

    let breadcrumbHtml = '';
    if (m) {
      const crumbs = [];
      if (m.sourceDataSource) {
        const _dsObj = /** @type {any} */ (DataLaVistaState.dataSources)?.[m.sourceDataSource] || {};
        const _tObj  = /** @type {any} */ (DataLaVistaState.tables)?.[m.sourceTableKey]  || {};
        const _dsLabel = _dsObj.siteTitle || m.sourceDataSource;
        const _dsDesc  = _dsObj.description || _tObj.description || '';
        const _dsUrl   = _tObj.siteUrl || (!_tObj.isFileUpload && _tObj.url) || '';
        const _dsTip   = _dsDesc ? ' data-dlv-tip="' + _attrEnc(_dsDesc) + '"' : '';
        const _dsInner = _dsUrl
          ? '<a href="' + _attrEnc(_dsUrl) + '" target="_blank" style="color:inherit;text-decoration:underline dotted">' + _attrEnc(_dsLabel) + '</a>'
          : _attrEnc(_dsLabel);
        crumbs.push('<span class="dd-crumb dd-crumb-ds"' + _dsTip + '>Data Source: ' + _dsInner + '</span>');
      }
      if (m.sourceTableName) {
        const _tableDescLive = m.sourceTableKey
          ? ((/** @type {any} */ (DataLaVistaState.tables))[m.sourceTableKey]?.description || '')
          : '';
        const tableDesc = _tableDescLive ? ' data-dlv-tip="' + _attrEnc(_tableDescLive) + '"' : '';
        crumbs.push('<span class="dd-crumb dd-crumb-table"' + tableDesc + '>Table: ' + _attrEnc(m.sourceTableName) + '</span>');
      }
      if (m.viewName)         crumbs.push('<span class="dd-crumb dd-crumb-view">' + _attrEnc('View: ' + m.viewName) + '</span>');
      const displayName = m.sourceDisplayName || m.sourceInternalName || col;
      const intSuffix = (m.sourceInternalName && m.sourceInternalName !== displayName)
        ? ' <span style="opacity:.6;font-size:10px">[' + _attrEnc(m.sourceInternalName) + ']</span>' : '';
      crumbs.push('<span class="dd-crumb dd-crumb-field">Field: ' + _attrEnc(displayName) + intSuffix + '</span>');
      breadcrumbHtml = '<div class="dd-breadcrumb">'
        + crumbs.join('<span class="dd-arrow">&#x203A;</span>')
        + '</div>';
    } else {
      breadcrumbHtml = '<div style="font-size:11px;color:var(--text-secondary)">No lineage information available (direct SQL or raw column).</div>';
    }

    const card = document.createElement('div');
    card.className = 'dd-card';
    card.innerHTML =
      '<div class="dd-card-header">'
      + '<span class="field-type-icon ' + ti.cls + '" style="font-size:11px;flex-shrink:0">' + ti.icon + '</span>'
      + '<span class="dd-col-name">' + _attrEnc(col) + '</span>'
      + aggBadge
      + '</div>'
      + fieldDescHtml
      + '<div class="dd-card-lineage">' + breadcrumbHtml + '</div>'
      + '<div class="dd-card-footer"><span class="dd-footer-label">Appears in:&nbsp;</span>' + widgetsHtml + '</div>';
    frag.appendChild(card);
  }

  if (!count) {
    body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary)">No fields match your search.</div>';
    return;
  }

  body.innerHTML = '';
  body.appendChild(frag);
  dlvTooltip.scanDOM(document);
}

function _ddDownloadCSV() {
  var cols = DataLaVistaState.queryColumns || [];
  if (!cols.length) { toast('Run a query first to populate the data dictionary.', 'warning'); return; }

  var qcMeta = DataLaVistaState.queryColumnMeta || {};

  // Build alias -> raw field def map from all loaded tables
  var fieldDefMap = {};
  var tableObjs = DataLaVistaState.tables || {};
  for (var tkey in tableObjs) {
    var tbl = tableObjs[tkey];
    var tblFields = (tbl && tbl.fields) ? tbl.fields : [];
    for (var fi = 0; fi < tblFields.length; fi++) {
      var fd = tblFields[fi];
      if (fd && fd.alias && !fieldDefMap[fd.alias]) { fieldDefMap[fd.alias] = fd; }
    }
  }

  var headers = [
    'Alias (Query Column)',
    'Data Type',
    'Aggregation',
    'Display Name',
    'Internal Name',
    'Data Source',
    'Table/List',
    'Table Description',
    'View',
    'Field Description',
    'Lookup List',
    'Lookup Field',
    'Lookup Web URL',
    'Is Lookup Raw',
    'Is Auto ID',
    'Used In Widgets',
    'Lineage'
  ];

  function _csvCell(v) {
    var s = (v == null) ? '' : String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  var rows = [headers.map(_csvCell).join(',')];

  for (var ci = 0; ci < cols.length; ci++) {
    var col = cols[ci];
    var m   = qcMeta[col]     || null;
    var f   = fieldDefMap[col] || null;

    var dt           = sniffType(col);
    var agg          = (m && m.agg)                    ? m.agg                    : '';
    var displayName  = (m && m.sourceDisplayName)      ? m.sourceDisplayName      : '';
    var internalName = (m && m.sourceInternalName)     ? m.sourceInternalName     : '';
    var dataSource   = (m && m.sourceDataSource)       ? m.sourceDataSource       : '';
    var tableName    = (m && m.sourceTableName)  ? m.sourceTableName  : '';
    var tableDesc    = (m && m.sourceTableKey)
      ? ((/** @type {any} */ (DataLaVistaState.tables))[m.sourceTableKey]?.description || '')
      : '';
    var viewName     = (m && m.viewName)         ? m.viewName         : '';
    var fieldDesc    = (m && m.sourceFieldDescription) ? m.sourceFieldDescription : '';

    // Lookup / foreign-key metadata from raw field definition (SharePoint lookup fields)
    var lookupList   = f ? (f.lookupList   || f.LookupList   || '') : '';
    var lookupField  = f ? (f.lookupField  || f.LookupField  || '') : '';
    var lookupWebUrl = f ? (f.lookupWebUrl || f.LookupWebUrl || '') : '';
    var isLookupRaw  = (f && f.isLookupRaw) ? 'Yes' : '';
    var isAutoId     = (f && f.isAutoId)     ? 'Yes' : '';

    // Widget usage
    var usedWidgets  = _ddGetWidgetsUsingField(col);
    var widgetNames  = '';
    for (var wi = 0; wi < usedWidgets.length; wi++) {
      var wn = usedWidgets[wi].title || usedWidgets[wi].type || '';
      if (wn) { widgetNames += (widgetNames ? '; ' : '') + wn; }
    }

    // Lineage breadcrumb
    var lineageParts = [];
    if (dataSource) lineageParts.push('Data Source: ' + dataSource);
    if (tableName)  lineageParts.push('Table: ' + tableName);
    if (viewName)   lineageParts.push('View: ' + viewName);
    lineageParts.push('Field: ' + (displayName || internalName || col));
    var lineage = lineageParts.join(' > ');

    rows.push([col, dt, agg, displayName, internalName, dataSource, tableName,
               tableDesc, viewName, fieldDesc, lookupList, lookupField, lookupWebUrl,
               isLookupRaw, isAutoId, widgetNames, lineage].map(_csvCell).join(','));
  }

  var csv   = rows.join('\n');
  var title = (DataLaVistaState.design && DataLaVistaState.design.title) ? DataLaVistaState.design.title : 'DataLaVista';
  downloadText(csv, title + '-DataDictionary.csv', 'text/csv');
  toast('Data dictionary exported (' + cols.length + ' fields)', 'success');
}

function openDataDictionaryPopup() {
  const _ddExisting = document.getElementById('dd-overlay');
  if (_ddExisting) _ddExisting.remove();

  const cols = DataLaVistaState.queryColumns || [];

  const overlay = document.createElement('div');
  overlay.id = 'dd-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:780px;max-width:calc(100vw - 40px);display:flex;flex-direction:column;animation:popIn 200ms ease;max-height:calc(100vh - 100px)';

  const searchRow = cols.length
    ? '<div style="padding:12px 20px 0">'
      + '<input id="dd-search" type="text" class="form-input" placeholder="Search fields, tables, data sources..." '
      + 'style="width:100%" />'
      + '</div>'
    : '';

  dialog.innerHTML =
    '<div class="popup-header">'
    + '<div><h2 style="font-size:16px;font-weight:600;margin:0 0 2px">Data Dictionary</h2>'
    + '<div style="font-size:11px;color:var(--text-secondary)">Field sources and widget usage — read left to right</div></div>'
    + '<button class="btn btn-ghost btn-icon" onclick="document.getElementById(\'dd-overlay\').remove()">&#x2715;</button>'
    + '</div>'
    + searchRow
    + '<div id="dd-body" style="padding:16px 20px;overflow-y:auto;flex:1;min-height:100px"></div>'
    + '<div class="popup-footer">'
    + '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'dd-overlay\').remove()">Close</button>'
    + '</div>';

  var _ddSearchEl = dialog.querySelector('#dd-search');
  if (_ddSearchEl) _ddSearchEl.addEventListener('input', function(e) { _ddFilterCards(/** @type {HTMLInputElement} */ (e.target).value); });

  var _ddCsvBtn = document.createElement('button');
  _ddCsvBtn.className = 'btn btn-ghost btn-sm';
  _ddCsvBtn.textContent = 'Download CSV';
  _ddCsvBtn.addEventListener('click', _ddDownloadCSV);
  var _ddFooter = dialog.querySelector('.popup-footer');
  if (_ddFooter) _ddFooter.prepend(_ddCsvBtn);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  _ddRenderCards('');
}
