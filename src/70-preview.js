/* ============================================================
This file is part of DataLaVista™
70-preview.js: Preview tab, CSV download, and report generation.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
Summary: Preview tab, CSV download, and report generation.
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
      // PREVIEW TAB
      // ============================================================
      async function refreshDashboardPreview() {
        DataLaVistaState.reportLoaded = false;
        if (!DataLaVistaState.sql.trim() && DataLaVistaState.reportMode !== 'view') { toast('Please build a query first', 'error'); return; }
        if (DataLaVistaState.reportMode !== 'view') setStatus('Loading preview data...', 'loading');

        try {
          const results = await _executeQuery(DataLaVistaState.sql);
          DataLaVistaState.queryResultsReady = true;
          renderPreviewTab();
          if (DataLaVistaState.reportMode !== 'view') setStatus(`Preview: ${results.length} rows`, 'success');
          DataLaVistaState.reportLoaded = true;
        } catch (err) {
          console.error('[DLV] refreshDashboardPreview failed:', err);
          if (DataLaVistaState.reportMode !== 'view') {
            toast('Preview error: ' + err.message, 'error');
            setStatus('Preview error', 'error');
          } else {
            toast('Unable to load report data.', 'error');
            setStatus('Report error', 'error');
          }
        }
      }

      function renderPreviewTab() {
        if(DataLaVistaState.reportMode == 'edit') {
          document.getElementById('preview-toolbar').classList.remove('hidden');
        } else {
          document.getElementById('preview-toolbar').classList.add('hidden');
        }
        const titleBarEl = document.getElementById('preview-title-bar');
        const titleText  = resolveTitleTemplate(DataLaVistaState.design.title || '') || 'DataLaVista Report';
        const titleTip   = DataLaVistaState.design.dashboardTitleTooltip || '';

        if (DataLaVistaState.design.showDashboardTitle === false) {
          titleBarEl.classList.add('hidden');
        } else {
          titleBarEl.classList.remove('hidden');
          // Build title HTML — add info icon if tooltip is configured
          if (titleTip.trim()) {
            const safeTitle = titleText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            titleBarEl.innerHTML = `${safeTitle}<sup id="prev-title-tip-icon" style="font-size:60%;margin-left:5px;cursor:help;opacity:0.8">ℹ️</sup>`;
            // Wire tooltip after DOM settles
            requestAnimationFrame(() => {
              const icon = document.getElementById('prev-title-tip-icon');
              if (icon) dlvTooltip.attach(icon, sanitizeHTML(titleTip), { placement: 'bottom', maxWidth: '440px', delay: 200 });
            });
          } else {
            titleBarEl.textContent = titleText;
          }
        }
        // Filter bar
        const filterBar = document.getElementById('preview-filter-bar');
        filterBar.innerHTML = '';
        const barFilters = DataLaVistaState.design.filters.filter(f => f.position === 'bar' || !f.position);
        if (barFilters.length) {
          filterBar.classList.remove('hidden');
          for (const filter of barFilters) {
            const _fRows = (alasql.tables && alasql.tables['dlv_results']) ? alasql('SELECT * FROM [dlv_results]') : [];
            const _rawVals = _fRows.map(r => r[filter.field]).filter(v => v != null);
            const _isLookupF = typeof _filterFieldIsLookup === 'function' && _filterFieldIsLookup(filter.field);
            let _flatVals;
            if (_isLookupF) {
              const _parts = [];
              for (const v of _rawVals) { for (const p of String(v).split(';')) { const t = p.trim(); if (t) _parts.push(t); } }
              _flatVals = [...new Set(_parts)].sort();
            } else {
              _flatVals = [...new Set(_rawVals)].sort();
            }
            const values = ['(All)', ..._flatVals];
            const wrap = document.createElement('div');
            wrap.className = 'filter-chip';
            var _optHtml = '';
            for (var _oi = 0; _oi < values.length; _oi++) { _optHtml += '<option>' + values[_oi] + '</option>'; }
            wrap.innerHTML = '<span style="font-size:11px;font-weight:600">' + filter.label + ':</span>'
              + '<select class="filter-chip-select" onchange="applyPreviewFilterAndRender(\'' + filter.field + '\', this.value)">'
              + _optHtml + '</select>';
            filterBar.appendChild(wrap);
          }
        } else filterBar.classList.add('hidden');

        // Reset per-widget filter so buildWidgetData uses raw queryResults as base
        DataLaVistaState.design.previewFilteredData = null;

        // Canvas
        const canvas = document.getElementById('preview-canvas');
        if (canvas) canvas.style.background = (DataLaVistaState.design.theme && DataLaVistaState.design.theme.backgroundColor) || '';
        canvas.innerHTML = '';

        // Destroy old preview charts
        for (const [id, chart] of Object.entries(DataLaVistaState.charts)) {
          if (id.startsWith('prev_')) { try { chart.dispose(); } catch (e) { } delete DataLaVistaState.charts[id]; }
        }

        for (const w of DataLaVistaState.design.widgets) {
          if (w.parentContainerId) continue; // rendered inside container
          const el = document.createElement('div');
          el.className = 'widget';
          const titleHdrStyle  = `background:${w.titleBackgroundColor||'#fefefe'}`;
          const titleSpanStyle = `font-size:${w.titleFontSize||14}px;color:${w.titleFontColor||'#323130'}`;
          var _prevHeightStyle = (w.type === 'container') ? ('min-height:' + (w.minHeightVh || 30) + 'vh;height:auto') : (w.heightVh + 'vh');
          var _prevWidthStyle  = w.widthPct + '%';
          var _isContainerP = (w.type === 'container');
          var _minHtP = _isContainerP ? '' : ';min-height:120px';
          var _ovfP   = _isContainerP ? ';overflow:visible' : '';
          el.style.cssText = 'width:' + _prevWidthStyle + ';' + (_prevHeightStyle.indexOf('min-height') === 0 ? _prevHeightStyle : 'height:' + _prevHeightStyle) + _minHtP + ';border-color:' + w.borderColor + ';border-width:' + w.borderSize + 'px;background:' + (w.widgetBackgroundColor||'transparent') + _ovfP;
          var _prevContentStyle = '';
          if (w.type === 'container') {
            var _alignMapP = { 'top': 'flex-start', 'space-between': 'space-between', 'stretch': 'stretch' };
            var _justifyP = _alignMapP[w.containerAlign || 'top'] || 'flex-start';
            _prevContentStyle = ' style="display:flex;flex-direction:column;gap:' + (w.containerGap || 8) + 'px;padding:' + (w.containerPadding || 8) + 'px;justify-content:' + _justifyP + ';height:auto;overflow:visible"';
          }
          el.innerHTML = '<div class="widget-header' + (w.showTitle === false ? ' hidden' : '') + '" style="' + titleHdrStyle + '"><span class="widget-title" style="' + titleSpanStyle + '">' + resolveTitleTemplate(w.title) + '</span></div>'
            + '<div class="widget-content' + (isEChartsWidget(w.type) ? ' widget-content-chart' : '') + '" id="prev-wcontent-' + w.id + '"' + _prevContentStyle + '>'
            + getPrevWidgetContent(w)
            + '</div>';
          canvas.appendChild(el);
        }

        // Inject children into their containers
        for (const w of DataLaVistaState.design.widgets) {
          if (!w.parentContainerId) continue;
          var _pContEl = document.getElementById('prev-wcontent-' + w.parentContainerId);
          if (!_pContEl) continue;
          var _childEl = document.createElement('div');
          _childEl.className = 'widget';
          var _cTitleHdrStyle  = 'background:' + (w.titleBackgroundColor || '#fefefe');
          var _cTitleSpanStyle = 'font-size:' + (w.titleFontSize || 14) + 'px;color:' + (w.titleFontColor || '#323130');
          _childEl.style.cssText = 'width:100%;height:' + w.heightVh + 'vh;min-height:80px;border-color:' + w.borderColor + ';border-width:' + w.borderSize + 'px;background:' + (w.widgetBackgroundColor || '#fefefe');
          _childEl.innerHTML = '<div class="widget-header' + (w.showTitle === false ? ' hidden' : '') + '" style="' + _cTitleHdrStyle + '"><span class="widget-title" style="' + _cTitleSpanStyle + '">' + resolveTitleTemplate(w.title) + '</span></div>'
            + '<div class="widget-content' + (isEChartsWidget(w.type) ? ' widget-content-chart' : '') + '" id="prev-wcontent-' + w.id + '">'
            + getPrevWidgetContent(w)
            + '</div>';
          _pContEl.appendChild(_childEl);
        }

        requestAnimationFrame(() => {
          for (const w of DataLaVistaState.design.widgets) {
            if (isEChartsWidget(w.type)) {
              renderPreviewChart(w);
            }
          }
          // Connect all preview charts for cross-tooltip sync
          const _ec = /** @type {any} */ (window.echarts);
          if (_ec && _ec.connect) {
            const previewCharts = Object.entries(DataLaVistaState.charts)
              .filter(([id]) => id.startsWith('prev_'))
              .map(([, c]) => c);
            if (previewCharts.length > 1) _ec.connect(previewCharts);
          }
        });
      }

      function getPrevWidgetContent(w) {
        // Note: text widgets don't have their html sanitized with sanitizeHTML() since they're meant to allow basic formatting via HTML tags.
        // If this becomes a problem, we can add a separate "allowHTML" flag to widget properties and sanitize conditionally.
        if (w.type === 'text') return '<div class="text-widget" style="font-size:' + w.fontSize + 'px;color:' + w.fontColor + '">' + w.textContent + '</div>';
        if (w.type === 'placeholder') return '';
        if (w.type === 'container') return ''; // children injected by renderPreviewTab's second loop
        if (w.type === 'kpi') return renderPrevKPI(w);
        if (w.type === 'table') return renderPrevTable(w);
        if (isEChartsWidget(w.type)) return '<div id="prevchart-' + w.id + '" style="width:100%;height:100%;min-height:200px"></div>';
        return '';
      }

      function renderPrevKPI(w) {
        // Delegate to the same logic as the design tab (uses buildWidgetData internally)
        return renderKPIContent(w);
      }

      function renderPrevTable(w) {
        // Delegate to the same logic as the design tab (uses buildWidgetData internally)
        return renderTableContent(w);
      }

      function renderPreviewChart(w) {
  const chartEl = document.getElementById('prevchart-' + w.id);
  if (!chartEl) return;
  const id = 'prev_' + w.id;
  if (DataLaVistaState.charts[id]) { try { DataLaVistaState.charts[id].dispose(); } catch(e){} }
  if (DataLaVistaState._chartROs && DataLaVistaState._chartROs[id]) {
    try { DataLaVistaState._chartROs[id].disconnect(); } catch(e) {}
  }
  const chart = echarts.init(chartEl);
  DataLaVistaState.charts[id] = chart;
  if (typeof ResizeObserver !== 'undefined') {
    if (!DataLaVistaState._chartROs) DataLaVistaState._chartROs = {};
    const ro = new ResizeObserver(() => { try { chart.resize(); } catch(e) {} });
    ro.observe(chartEl);
    DataLaVistaState._chartROs[id] = ro;
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
    if      (mode === 'cross-filter')    applyDrillFilter(filterField, String(filterValue));
    else if (mode === 'cross-highlight') _applyDrillHighlight(filterField, String(filterValue));
  });
}

      function applyPreviewFilterAndRender(field, value) {
        if (value === '(All)') delete DataLaVistaState.previewFilters[field];
        else DataLaVistaState.previewFilters[field] = value;

        // Rebuild [dlv_active] using combined previewFilters + drillFilters
        alasql('DROP VIEW IF EXISTS [dlv_active]');
        const allFilters = { ...(DataLaVistaState.previewFilters || {}), ...(DataLaVistaState.drillFilters || {}) };
        const whereClauses = Object.entries(allFilters).map(([f, v]) => {
          const vEsc = String(v).replace(/'/g, "''");
          if (typeof _filterFieldIsLookup === 'function' && _filterFieldIsLookup(f)) {
            return `([${f}] = '${vEsc}' OR [${f}] LIKE '${vEsc};%' OR [${f}] LIKE '%;${vEsc}' OR [${f}] LIKE '%;${vEsc};%')`;
          }
          return `[${f}] = '${vEsc}'`;
        });
        if (whereClauses.length) {
          alasql(`CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results] WHERE ${whereClauses.join(' AND ')}`);
        } else {
          alasql(`CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results]`);
        }

        DataLaVistaState.design.previewFilteredData = null;

        // Re-render each widget by ID (skip containers — their layout is unchanged; children update below)
        for (const w of DataLaVistaState.design.widgets) {
          if (/** @type {any} */ (w).type === 'container') continue;
          const contentEl = document.getElementById('prev-wcontent-' + /** @type {any} */ (w).id);
          if (!contentEl) continue;
          contentEl.innerHTML = getPrevWidgetContent(w);
          if (isEChartsWidget(/** @type {any} */ (w).type)) {
            requestAnimationFrame(() => renderPreviewChart(w));
          }
        }
      }

      // Lets users download the full query results as CSV, even if the preview only shows top 20 rows. If results aren't available in AlaSQL, try to run the query and populate [dlv_results] first.
      async function downloadCSV() {
        let results = (alasql.tables && alasql.tables['dlv_results'])
          ? alasql('SELECT * FROM [dlv_results]')
          : null;
        if (!results) {
          // Try to run query and get all rows
          if (!DataLaVistaState.sql.trim()) { toast('Run a query first', 'error'); return; }
          const refs = findReferencedTables(DataLaVistaState.sql);
          for (const t of refs) await ensureTableData(t, true);
          for (const t of refs) {
            registerTableInAlaSQL(t);
            const viewName = DataLaVistaState.tables[t]?.viewName || CyberdynePipeline.getViewForTable(t);
            if (viewName) try { CyberdynePipeline.updateViewSQL(viewName); } catch(_) {}
          }
          results = alasql(preprocessSQL(DataLaVistaState.sql));
        }
        if (!results || !results.length) { toast('No data to export', 'warning'); return; }
        const cols = Object.keys(results[0]);
        const csv = [cols.join(','), ...(/** @type {any[]} */ (results)).map(r => cols.map(c => {
          var v = r[c];
          if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
            return '"' + v.replace(/"/g, '""') + '"';
          }
          return v != null ? v : '';
        }).join(','))].join('\n');
        if(DataLaVistaState.design.title) {
          downloadText(csv, DataLaVistaState.design.title + '.csv', 'text/csv');
        } else {
          downloadText(csv, 'DataLaVista-export.csv', 'text/csv');
        }
        toast(`Exported ${results.length} rows`, 'success');
      }

      async function printReport() {
          if (!DataLaVistaState.sql.trim()) { toast('Please build a query first', 'error'); return; }
        setTimeout(() => {
          window.print();
        }, 500);
      }

      // TODO: fix shareLiveReport to work with report URL from param, or on its own.
      async function shareLiveReport() {
        try{
          if(navigator.canShare) {
            navigator.share({
              title: DataLaVistaState.design.title || 'DataLaVista Report',
              text: 'Check out this report I created with DataLaVista!',
              url: window.location.href
            });
          };
        }
           finally {
            navigator.clipboard.writeText(window.location.href).then(() => toast('Report URL copied to clipboard', 'success'));
          }
      }

      // ============================================================
      // GENERATE REPORT
      // ============================================================
      let _lastPublishedUrl = '';
      let _lastGeneratedJson = null;   // cached JSON string from last generateReport() call

      async function generateReport() {
        setStatus('Generating report config…', 'loading');
        toast('Generating report, please wait…', 'info');

        // Yield to the browser so the tab switch and toast paint before the heavy work
        await new Promise(resolve => setTimeout(resolve, 0));

        _lastGeneratedJson = JSON.stringify(buildConfig(), null, 2);

        /** @type {HTMLButtonElement} */ (document.getElementById('btn-copy-json')).disabled = false;

        setStatus('Report config ready.', 'success');
        toast('Report generated!', 'success');
      }

      function copyGenCode() {
        if (!_lastGeneratedJson) { toast('Generate the report first.', 'warning'); return; }
        navigator.clipboard.writeText(_lastGeneratedJson).then(() => toast('Copied to clipboard', 'success'));
      }

      function downloadGenCode() {
        if (!_lastGeneratedJson) { toast('Generate the report first.', 'warning'); return; }
        const ext = '.json';
        const mime = 'application/json';
        const title = DataLaVistaState.design.title || 'DataLaVista-report';
        downloadText(_lastGeneratedJson, title + ext, mime);
      }

      async function publishToSharePoint() {
        if (!_lastGeneratedJson) { toast('Generate the report first.', 'warning'); return; }
        const jsonStr = _lastGeneratedJson;
        const title = DataLaVistaState.design.title || 'DataLaVista-report';
        let result;
        try {
          result = await SharePointFileDialog.show({
            mode: 'save',
            type: 'file',
            defaultFileName: title + '.json',
            fileContent: jsonStr,
            fileExtensions: ['.json', '.json5', '.JSON', '.js', '.txt'],
            defaultFolders: ['/Shared Documents/Reports', '/Shared Documents/Dashboards', '/Shared Documents']
          });
        } catch (err) {
          if (err && err.message !== 'Dialog cancelled') toast(err.message || String(err), 'error');
          return;
        }
        if (!result) return;
        const currentDLVUrl = new URL(window.location.href);
        const reportUrl = new URL(currentDLVUrl.origin + currentDLVUrl.pathname + '?report=' + encodeURIComponent(result.url));
        _showPublishResult(reportUrl.toString());
        toast('Published to SharePoint!', 'success');
      }

      async function saveToSharePointList() {
        if (!_lastGeneratedJson) { toast('Generate the report first.', 'warning'); return; }
        const jsonStr = _lastGeneratedJson;
        const title = DataLaVistaState.design.title || 'DataLaVista-report';
        let result;
        try {
          result = await SharePointFileDialog.show({
            mode: 'save',
            type: 'list',
            defaultFileName: title + '.json',
            fileContent: jsonStr,
            sqlQuery: '',
            defaultList: 'Reports'
          });
        } catch (err) {
          if (err && err.message !== 'Dialog cancelled') toast(err.message || String(err), 'error');
          return;
        }
        if (!result) return;
        // Generate report URL based on current location plus report= parameter plus returned url.
        // E.g.: http://site.com/DataLaVista.aspx?report=/sites/reports/Shared%20Documents/report1.json
        const currentDLVUrl = new URL(window.location.href);
        const reportUrl = new URL(currentDLVUrl.origin + currentDLVUrl.pathname + '?report=' + encodeURIComponent(result.url));
        _showPublishResult(reportUrl.toString());
        toast('Saved to SharePoint list!', 'success');
      }

      /** Display the saved-file URL and share button below the publish actions. */
      function _showPublishResult(url) {
        const container = document.getElementById('gen-publish-result');
        const link = /** @type {HTMLAnchorElement|null} */ (document.getElementById('gen-publish-url'));
        if (!container || !link || !url) return;
        _lastPublishedUrl = url;
        DataLaVistaState.lastPublishedUrl = url;
        link.textContent = url.length > 86
          ? url.slice(0, 40) + '\u2026' + url.slice(-45)
          : url;
        link.href = url;
        container.style.display = 'flex';
        const saveBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-save-config'));
        if (saveBtn) saveBtn.textContent = '☁ Save to SharePoint';
      }

      function sharePublishedUrl() {
        const url = _lastPublishedUrl;
        if (!url) return;
        if (navigator.canShare) {
          navigator.share({
            title: DataLaVistaState.design.title || 'DataLaVista Report',
            text: 'Check out this report I created with DataLaVista!',
            url
          });
        }
        navigator.clipboard.writeText(url).then(() => toast('URL copied to clipboard', 'success'));
      }