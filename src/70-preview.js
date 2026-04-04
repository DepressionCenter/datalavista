/* ============================================================
This file is part of DataLaVista™
70-preview.js: Preview tab, CSV download, and report generation.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-04
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
        if (!DataLaVistaState.sql.trim()) { toast('Please build a query first', 'error'); return; }
        if(DataLaVistaState.reportMode != 'view') setStatus('Loading preview data...', 'loading');

        try {
          const referencedTables = findReferencedTables(DataLaVistaState.sql);
          for (const tname of referencedTables) {
            await ensureTableData(tname, true); // Load all rows
          }
          for (const tname of referencedTables) {
            const t = DataLaVistaState.tables[tname];
            if (!t || !t.data.length) continue;
            // Register the raw _raw_tname TABLE (safe regardless of VIEW state)
            registerTableInAlaSQL(tname);
            // Rebuild the FieldExpander VIEW so the SQL can use alias column names + UDFs
            const viewName = t.viewName || CyberdynePipeline.getViewForTable(tname);
            if (viewName) {
              try { CyberdynePipeline.updateViewSQL(viewName); }
              catch (e) { console.warn('[DLV] [refreshDashboardPreview] updateViewSQL:', viewName, e.message); }
												   
            }
          }

          // Execute SQL once with full data, then materialize into a named table.
          // Per-widget SQL scans [dlv_active] (a view on the materialized table) — fast.
          const processedSQL = preprocessSQL(DataLaVistaState.sql);
          const results = alasql(processedSQL);

          alasql('DROP TABLE IF EXISTS [dlv_results]');
													  
          alasql('DROP VIEW  IF EXISTS [dlv_active]');
          alasql('CREATE TABLE [dlv_results]');
          alasql.tables['dlv_results'].data = results;     // O(1) reference assignment
																					
																					   
          alasql('CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results]');
																				   
          DataLaVistaState.previewFilters = {};
          DataLaVistaState.design.previewFilteredData = null;
          DataLaVistaState.queryColumns = results.length ? Object.keys(results[0]) : DataLaVistaState.queryColumns;

          renderPreviewTab();
          
          if(DataLaVistaState.reportMode !== 'view') setStatus(`Preview: ${results.length} rows`, 'success');
        } catch (err) {
          if(DataLaVistaState.reportMode !== 'view') {
          toast('Preview error: ' + err.message, 'error');
          setStatus('Preview error', 'error');
          } else {
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
        document.getElementById('preview-title-bar').textContent = DataLaVistaState.design.title || 'DataLaVista Report';
        document.getElementById('preview-title-bar').classList.remove('hidden');
        // Filter bar
        const filterBar = document.getElementById('preview-filter-bar');
        filterBar.innerHTML = '';
        const barFilters = DataLaVistaState.design.filters.filter(f => f.position === 'bar' || !f.position);
        if (barFilters.length) {
          filterBar.classList.remove('hidden');
          for (const filter of barFilters) {
            const _fRows = (alasql.tables && alasql.tables['dlv_results']) ? alasql('SELECT * FROM [dlv_results]') : [];
            const values = ['(All)', ...[...new Set(_fRows.map(r => r[filter.field]).filter(v => v != null))].sort()];
            const wrap = document.createElement('div');
            wrap.className = 'filter-chip';
            wrap.innerHTML = `<span style="font-size:11px;font-weight:600">${filter.label}:</span>
        <select class="filter-chip-select" onchange="applyPreviewFilterAndRender('${filter.field}', this.value)">
          ${values.map(v => `<option>${v}</option>`).join('')}
        </select>`;
            filterBar.appendChild(wrap);
          }
        } else filterBar.classList.add('hidden');

        // Reset per-widget filter so buildWidgetData uses raw queryResults as base
        DataLaVistaState.design.previewFilteredData = null;

        // Canvas
        const canvas = document.getElementById('preview-canvas');
        canvas.innerHTML = '';

        // Destroy old preview charts
        for (const [id, chart] of Object.entries(DataLaVistaState.charts)) {
          if (id.startsWith('prev_')) { try { chart.dispose(); } catch (e) { } delete DataLaVistaState.charts[id]; }
        }

        for (const w of DataLaVistaState.design.widgets) {
          const el = document.createElement('div');
          el.className = 'widget';
          el.style.cssText = `width:${w.widthPct}%;height:${w.heightVh}vh;min-height:120px;border-color:${w.borderColor};border-width:${w.borderSize}px`;
          el.innerHTML = `
            <div class="widget-header"><span class="widget-title">${w.title}</span></div>
            <div class="widget-content" id="prev-wcontent-${w.id}">
              ${getPrevWidgetContent(w)}
            </div>
          `;
          canvas.appendChild(el);
        }

        requestAnimationFrame(() => {
          for (const w of DataLaVistaState.design.widgets) {
            if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
              renderPreviewChart(w);
            }
          }
        });
      }

      function getPrevWidgetContent(w) {
        if (w.type === 'text') return `<div class="text-widget" style="font-size:${w.fontSize}px;color:${w.fontColor}">${w.textContent}</div>`;
        if (w.type === 'placeholder') return '';
        if (w.type === 'kpi') return renderPrevKPI(w);
        if (w.type === 'table') return renderPrevTable(w);
        if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) return `<div id="prevchart-${w.id}" style="width:100%;height:100%;min-height:200px"></div>`;
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
        if (DataLaVistaState.charts[id]) { try { DataLaVistaState.charts[id].dispose(); } catch (e) { } }
        const chart = echarts.init(chartEl);
        DataLaVistaState.charts[id] = chart;

        const chartData = buildWidgetData(w);
        if (!chartData || !chartData.length) {
          chart.setOption({ title: { text: 'No data', left: 'center', top: 'middle', textStyle: { color: '#a19f9d', fontSize: 13 } } });
          return;
        }

        const allCols = Object.keys(chartData[0]);
        const xField = w.xField || allCols[0];
        const yField = w.yField || allCols[1] || allCols[0];
        let option = {};

        if (w.type === 'bar') {
          option = { tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: chartData.map(r => r[xField]), axisLabel: { rotate: 30, fontSize: 11 } }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: chartData.map(r => parseFloat(r[yField]) || 0), itemStyle: { color: w.fillColor } }], grid: { left: 40, right: 20, top: 20, bottom: 60 } };
        } else if (w.type === 'line') {
          option = { tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: chartData.map(r => r[xField]), axisLabel: { rotate: 30, fontSize: 11 } }, yAxis: { type: 'value' }, series: [{ type: 'line', data: chartData.map(r => parseFloat(r[yField]) || 0), itemStyle: { color: w.fillColor }, smooth: true }], grid: { left: 40, right: 20, top: 20, bottom: 60 } };
        } else if (w.type === 'pie') {
          option = { tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' }, series: [{ type: 'pie', data: chartData.map(r => ({ name: String(r[xField] || ''), value: parseFloat(r[yField]) || 0 })), radius: ['30%', '65%'], label: { fontSize: 11 } }] };
        } else if (w.type === 'scatter') {
          option = { tooltip: { trigger: 'item' }, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: chartData.map(r => [parseFloat(r[xField]) || 0, parseFloat(r[yField]) || 0]), itemStyle: { color: w.fillColor } }], grid: { left: 40, right: 20, top: 20, bottom: 40 } };
        }
        chart.setOption(option);
      }

      function applyPreviewFilterAndRender(field, value) {
        if (value === '(All)') delete DataLaVistaState.previewFilters[field];
        else DataLaVistaState.previewFilters[field] = value;

        // Rebuild the [dlv_active] view — a filter layer on top of [dlv_results].
        // Per-widget SQL (buildWidgetData) will query FROM [dlv_active] automatically.
        alasql('DROP VIEW IF EXISTS [dlv_active]');
        const whereClauses = Object.entries(DataLaVistaState.previewFilters)
          .map(([f, v]) => `[${f}] = '${String(v).replace(/'/g, "''")}'`);
        if (whereClauses.length) {
          alasql(`CREATE VIEW [dlv_active] AS SELECT * FROM [dlv_results] WHERE ${whereClauses.join(' AND ')}`);
        }

        DataLaVistaState.design.previewFilteredData = null; // view handles all filtering

        // Re-render each widget
        const canvas = document.getElementById('preview-canvas');
        canvas.querySelectorAll('.widget').forEach((el, i) => {
          const w = DataLaVistaState.design.widgets[i];
          if (!w) return;
          const content = el.querySelector('.widget-content');
          content.innerHTML = getPrevWidgetContent(w);
          if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
            requestAnimationFrame(() => renderPreviewChart(w));
          }
        });
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
        const csv = [cols.join(','), ...results.map(r => cols.map(c => { const v = r[c]; return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v ?? ''; }).join(','))].join('\n');
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
        /** @type {HTMLButtonElement} */ (document.getElementById('btn-dl-json')).disabled = false;

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
        link.textContent = url.length > 86
          ? url.slice(0, 40) + '\u2026' + url.slice(-45)
          : url;
        link.href = url;
        container.style.display = 'flex';
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
