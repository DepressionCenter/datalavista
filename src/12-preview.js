/* ============================================================
This file is part of DataLaVista
12-preview.js: Preview tab, CSV download, and report generation.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
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
        console.log('DEBUG: Entered refreshDashboardPreview()');
        console.log('DEBUG: Refreshing dashboard preview with SQL:', state.sql);
        if (!state.sql.trim()) { toast('Please build a query first', 'error'); return; }
        if(!state.reportMode) setStatus('⏳ Loading preview data...');

        try {
          const referencedTables = findReferencedTables(state.sql);
          for (const tname of referencedTables) {
            await ensureTableData(tname, true); // Load all rows
          }
          console.log("DEBUG: looping through tables to DROP and CREATE in alasql:", referencedTables);
          for (const tname of referencedTables) {
            const t = state.tables[tname];
            if (!t || !t.data.length) continue;
            console.log(`DEBUG: Dropping table if it exists: ${tname}`);
            alasql(`DROP TABLE IF EXISTS [${tname}]`);
            console.log('DEBUG: Creating table:', tname);
            alasql(`CREATE TABLE [${tname}]`);
            console.log(`DEBUG: Inserting data into table ${tname}. Row count: ${t.data.length}`);
            alasql.tables[tname].data = t.data;
            // Also register by alias so QB-generated SQL (FROM alias) works in preview
            console.log('DEBUG: Checking for alias for table:', tname, 'Alias:', t.alias);
            if (t.alias && t.alias !== tname) {
              console.log(`DEBUG: Dropping alias table if it exists: ${t.alias}`);
              alasql(`DROP TABLE IF EXISTS [${t.alias}]`);
              console.log('DEBUG: Creating alias table:', t.alias);
              alasql(`CREATE TABLE [${t.alias}]`);
              console.log('DEBUG: Inserting data into alias table:', t.alias, 'Row count:', t.data.length);
              alasql.tables[t.alias].data = t.data;
              console.log(`DEBUG: Table ${tname} also registered as alias ${t.alias} in alasql.`);
            }
          }

          console.log("DEBUG: Tables loaded into alasql. Preprocessing query...");
          const processedSQL = preprocessSQL(state.sql);
          console.log("DEBUG: Processed SQL:", processedSQL);
          console.log("DEBUG: Executing query in alasql...");
          let results;
          try{
            results = alasql(processedSQL);
            console.log("DEBUG: refreshDashboardPreview -> Query executed successfully.");
          } catch (err) {
            console.error("DEBUG: Query execution error:", err);
            throw err;
          }

          console.log("DEBUG: refreshDashboardPreview -> results size: ", results.length);
          
          console.log("DEBUG: refreshDashboardPreview -> state.previewResults");
          state.previewResults = results;
          console.log("DEBUG: refreshDashboardPreview -> state.queryColumns");
          state.queryResults = results;
          console.log("DEBUG: refreshDashboardPreview -> state.queryColumns");
          state.queryColumns = results.length ? Object.keys(results[0]) : state.queryColumns;

          console.log("DEBUG: refreshDashboardPreview -> renderPreviewTab: Rendering preview tab with results...");
          renderPreviewTab();
          console.log("DEBUG: refreshDashboardPreview -> renderPreviewTab: Preview tab rendered.");
          
          if(!state.reportMode) setStatus(`✅ Preview: ${results.length} rows`);
        } catch (err) {
          if(!state.reportMode) {
          toast('Preview error: ' + err.message, 'error');
          setStatus('❌ Preview error');
          } else {
           setStatus('❌ Report error');
          }
        }
      }

      function renderPreviewTab() {
        console.log('DEBUG: Entered renderPreviewTab()');
        if(!state.reportMode) document.getElementById('preview-toolbar').classList.remove('hidden');
        document.getElementById('preview-title-bar').textContent = state.design.title || 'DataLaVista Report';
        document.getElementById('preview-title-bar').classList.remove('hidden');
        // Filter bar
        console.log('DEBUG: Rendering filter bar with filters:', state.design.filters);
        const filterBar = document.getElementById('preview-filter-bar');
        filterBar.innerHTML = '';
        const barFilters = state.design.filters.filter(f => f.position === 'bar' || !f.position);
        if (barFilters.length) {
          filterBar.classList.remove('hidden');
          for (const filter of barFilters) {
            const values = ['(All)', ...(state.previewResults ? [...new Set(state.previewResults.map(r => r[filter.field]).filter(v => v != null))].sort() : [])];
            const wrap = document.createElement('div');
            wrap.className = 'filter-chip';
            wrap.innerHTML = `<span style="font-size:11px;font-weight:600">${filter.label}:</span>
        <select class="filter-chip-select" onchange="applyPreviewFilterAndRender('${filter.field}', this.value)">
          ${values.map(v => `<option>${v}</option>`).join('')}
        </select>`;
            filterBar.appendChild(wrap);
          }
        } else filterBar.classList.add('hidden');

        // Canvas
        console.log('DEBUG: Rendering design canvas with widgets');
        const canvas = document.getElementById('preview-canvas');
        canvas.innerHTML = '';

        // Destroy old preview charts
        console.log('DEBUG: Disposing old preview charts');
        for (const [id, chart] of Object.entries(state.charts)) {
          if (id.startsWith('prev_')) { try { chart.dispose(); } catch (e) { } delete state.charts[id]; }
        }

        const results = state.previewResults || [];

        for (const w of state.design.widgets) {
          const el = document.createElement('div');
          el.className = 'widget';
          el.style.cssText = `width:${w.widthPct}%;height:${w.heightVh}vh;min-height:120px;border-color:${w.borderColor};border-width:${w.borderSize}px`;
          el.innerHTML = `
            <div class="widget-header"><span class="widget-title">${w.title}</span></div>
            <div class="widget-content" id="prev-wcontent-${w.id}">
              ${getPrevWidgetContent(w, results)}
            </div>
          `;
          canvas.appendChild(el);
        }

        console.log('DEBUG: Widget elements created. Rendering charts if any... requestAnimationFrame()');
        requestAnimationFrame(() => {
          for (const w of state.design.widgets) {
            if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
              console.log(`DEBUG: Rendering preview chart for widget ${w.id} of type ${w.type}`);
              renderPreviewChart(w, results);
            }
          }
        });
      }

      function getPrevWidgetContent(w, results) {
        if (w.type === 'text') return `<div class="text-widget" style="font-size:${w.fontSize}px;color:${w.fontColor}">${w.textContent}</div>`;
        if (w.type === 'placeholder') return '';
        if (w.type === 'kpi') return renderPrevKPI(w, results);
        if (w.type === 'table') return renderPrevTable(w, results);
        if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) return `<div id="prevchart-${w.id}" style="width:100%;height:100%;min-height:200px"></div>`;
        return '';
      }

      function renderPrevKPI(w, results) {
        let value = '—', label = w.fields[0] || '';
        if (results.length && label) {
          const vals = results.map(r => parseFloat(r[label]) || 0);
          const agg = w.aggregation || 'SUM';
          if (agg === 'COUNT') value = results.length.toLocaleString();
          else if (agg === 'SUM') value = vals.reduce((a, b) => a + b, 0).toLocaleString();
          else if (agg === 'AVG') value = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—';
          else value = results[0][label] ?? '—';
        }
        return `<div class="kpi-card"><div class="kpi-value" style="color:${w.fillColor}">${value}</div><div class="kpi-label">${label}</div></div>`;
      }

      function renderPrevTable(w, results) {
        if (!results.length) return '<div class="text-muted text-sm" style="padding:12px">No data</div>';
        const cols = w.fields.length ? w.fields.filter(f => results[0].hasOwnProperty(f)) : Object.keys(results[0]).slice(0, 8);
        if (!cols.length) return '<div class="text-muted text-sm" style="padding:12px">No columns configured</div>';
        let html = '<div style="overflow:auto;max-height:100%"><table class="widget-table"><thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        for (const row of results) html += '<tr>' + cols.map(c => `<td>${row[c] ?? ''}</td>`).join('') + '</tr>';
        html += '</tbody></table></div>';
        return html;
      }

      function renderPreviewChart(w, results) {
        const chartEl = document.getElementById('prevchart-' + w.id);
        if (!chartEl) return;
        const id = 'prev_' + w.id;
        if (state.charts[id]) { try { state.charts[id].dispose(); } catch (e) { } }
        const chart = echarts.init(chartEl);
        state.charts[id] = chart;

        if (!results.length) { chart.setOption({ title: { text: 'No data', left: 'center', top: 'middle', textStyle: { color: '#a19f9d' } } }); return; }

        const xField = w.xField || Object.keys(results[0])[0];
        const yField = w.yField || Object.keys(results[0])[1] || xField;
        let option = {};

        if (w.type === 'bar') {
          option = { tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: results.map(r => r[xField]), axisLabel: { rotate: 30, fontSize: 11 } }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: results.map(r => parseFloat(r[yField]) || 0), itemStyle: { color: w.fillColor } }], grid: { left: 40, right: 20, top: 20, bottom: 60 } };
        } else if (w.type === 'line') {
          option = { tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: results.map(r => r[xField]), axisLabel: { rotate: 30, fontSize: 11 } }, yAxis: { type: 'value' }, series: [{ type: 'line', data: results.map(r => parseFloat(r[yField]) || 0), itemStyle: { color: w.fillColor }, smooth: true }], grid: { left: 40, right: 20, top: 20, bottom: 60 } };
        } else if (w.type === 'pie') {
          option = { tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' }, series: [{ type: 'pie', data: results.map(r => ({ name: String(r[xField] || ''), value: parseFloat(r[yField]) || 0 })), radius: ['30%', '65%'], label: { fontSize: 11 } }] };
        } else if (w.type === 'scatter') {
          option = { tooltip: { trigger: 'item' }, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: results.map(r => [parseFloat(r[xField]) || 0, parseFloat(r[yField]) || 0]), itemStyle: { color: w.fillColor } }], grid: { left: 40, right: 20, top: 20, bottom: 40 } };
        }
        chart.setOption(option);
      }

      function applyPreviewFilterAndRender(field, value) {
        if (value === '(All)') delete state.previewFilters[field];
        else state.previewFilters[field] = value;

        let filtered = state.previewResults || [];
        for (const [f, v] of Object.entries(state.previewFilters)) {
          filtered = filtered.filter(r => String(r[f]) === String(v));
        }

        // Re-render canvas with filtered data
        const canvas = document.getElementById('preview-canvas');
        canvas.querySelectorAll('.widget').forEach((el, i) => {
          const w = state.design.widgets[i];
          if (!w) return;
          const content = el.querySelector('.widget-content');
          content.innerHTML = getPrevWidgetContent(w, filtered);
          if (['bar', 'line', 'pie', 'scatter'].includes(w.type)) {
            requestAnimationFrame(() => renderPreviewChart(w, filtered));
          }
        });
      }

      // ============================================================
      // DOWNLOAD CSV
      // ============================================================
      async function downloadCSV() {
        let results = state.previewResults || state.queryResults;
        if (!results) {
          // Try to run query and get all rows
          if (!state.sql.trim()) { toast('Run a query first', 'error'); return; }
          const refs = findReferencedTables(state.sql);
          for (const t of refs) await ensureTableData(t, true);
          for (const t of refs) {
            alasql(`DROP TABLE IF EXISTS [${t}]`);
            alasql(`CREATE TABLE [${t}]`);
            alasql.tables[t].data = state.tables[t].data;
          }
          results = alasql(preprocessSQL(state.sql));
        }
        if (!results || !results.length) { toast('No data to export', 'error'); return; }
        const cols = Object.keys(results[0]);
        const csv = [cols.join(','), ...results.map(r => cols.map(c => { const v = r[c]; return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v ?? ''; }).join(','))].join('\n');
        downloadText(csv, 'DataLaVista-export.csv', 'text/csv');
        toast(`Exported ${results.length} rows`, 'success');
      }

      async function printReport() {
          if (!state.sql.trim()) { toast('Please build a query first', 'error'); return; }
        setTimeout(() => {
          window.print();
        }, 500);
      }

      async function shareLiveReport() {
        try{
          if(navigator.canShare) {
            navigator.share({
              title: state.design.title || 'DataLaVista Report',
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
      function generateReport() {
        const config = buildConfig();
        const jsonStr = JSON.stringify(config, null, 2);
        const genJsonArea = document.getElementById('gen-json-area');
        if (genJsonArea) genJsonArea.value = jsonStr;

        document.getElementById('btn-copy-json').disabled = false;
        document.getElementById('btn-dl-json').disabled = false;
        
        toast('Report generated!', 'success');
      }

      function copyGenCode(type) {
        const area = document.getElementById(type === 'html' ? 'gen-code-area' : 'gen-json-area');
        navigator.clipboard.writeText(area.value).then(() => toast('Copied to clipboard', 'success'));
      }

      function downloadGenCode(type) {
        const area = document.getElementById(type === 'html' ? 'gen-code-area' : 'gen-json-area');
        const ext = type === 'html' ? '.html' : '.json';
        const mime = type === 'html' ? 'text/html' : 'application/json';
        downloadText(area.value, 'DataLaVista-report' + ext, mime);
      }

      
