/* ============================================================
This file is part of DataLaVista™
80-ui-utils.js: Resizable panels, tab switching, utility functions, and SharePoint file picker.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-04
Summary: Resizable panels, tab switching, utility functions, and SharePoint file picker.
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
      // RESIZABLE PANELS
      // ============================================================
      function initResizers() {
        // Fields panel (left) — query tab
        makeColResizer('fields-resizer', 'fields-panel', 'panel-fields-w', 160, 400);
        // Design fields panel
        makeColResizer('design-fields-resizer', 'design-fields-panel', null, 160, 420);
        // Toolbox panel (right)
        makeColResizer('toolbox-resizer', 'toolbox-panel', null, 160, 400, true);
        // QBvsSQL vertical
        makeRowResizer('qb-resizer', 'qb-section', 'query-main', 80, 70);
      }

      function makeColResizer(resizerId, panelId, cssVar, minW, maxW, fromRight = false) {
        const resizer = document.getElementById(resizerId);
        const panel = document.getElementById(panelId);
        if (!resizer || !panel) return;

        resizer.addEventListener('mousedown', e => {
          e.preventDefault();
          resizer.classList.add('dragging');
          const startX = e.clientX;
          const startW = panel.offsetWidth;
          const onMove = mv => {
            const dx = fromRight ? startX - mv.clientX : mv.clientX - startX;
            const newW = Math.max(minW, Math.min(maxW, startW + dx));
            panel.style.width = newW + 'px';
            if (cssVar) document.documentElement.style.setProperty('--' + cssVar, newW + 'px');
          };
          const onUp = () => { resizer.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      }

      function makeRowResizer(resizerId, topId, containerId, minH, maxPct) {
        const resizer = document.getElementById(resizerId);
        const topEl   = document.getElementById(topId);
        if (!resizer || !topEl) return;
        const sqlSec  = document.getElementById('sql-section');

        resizer.addEventListener('mousedown', e => {
          e.preventDefault();
          resizer.classList.add('dragging');
          const container  = document.getElementById(containerId);
          const containerH = container ? container.offsetHeight : window.innerHeight;
          const startY     = e.clientY;
          const startSqlH  = sqlSec ? sqlSec.offsetHeight : 220;

          const onMove = mv => {
            // Dragging up increases sql-section height
            const dy     = startY - mv.clientY;
            const newH   = Math.max(minH, Math.min(containerH * maxPct / 100, startSqlH + dy));
            if (sqlSec) {
              sqlSec.style.height = newH + 'px';
              // Ensure editor-open class is present so min-height applies
              sqlSec.classList.add('editor-open');
              if (!DataLaVistaState.sqlEditorCollapsed) {
                const wrap = document.getElementById('sql-editor-wrap');
                if (wrap) wrap.classList.remove('collapsed');
              }
            }
          };
          const onUp = () => {
            resizer.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      }

      // ============================================================
      // TABS
      // ============================================================
      function switchTab(tab) {
        let oldTab = DataLaVistaState.activeTab;
        DataLaVistaState.activeTab = tab;
        document.querySelectorAll('.tb-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));

        if (tab === 'dashboardPreview') { refreshDashboardPreview(); }
        if (tab === 'generate') { setTimeout(() => generateReport(), 0); }
        if (tab === 'design' && DataLaVistaState.reportMode !== 'view') {
          renderDesignCanvas(); renderFilterBar(); renderDesignFieldsPanel();
          requestAnimationFrame(() => { for (const c of Object.values(DataLaVistaState.charts)) { try { c.resize(); } catch (e) { } } });
        }
        if (tab === 'query' && window._cmEditor) { setTimeout(() => window._cmEditor.refresh(), 50); }
      }

      // ── Query-main panel tab switcher ─────────────────────────────────────────────
      function switchQMTab(tab) {
        DataLaVistaState.qmTab = tab;
        ['qb','sql','dataPreview'].forEach(t => {
          document.getElementById('qmt-' + t)?.classList.toggle('active', t === tab);
          document.getElementById('qm-panel-' + t)?.classList.toggle('active', t === tab);
        });
        // Show subtabs only when QB is active
        const subtabs = document.getElementById('qb-subtabs');
        if (subtabs) subtabs.style.display = tab === 'qb' ? '' : 'none';
        if (tab === 'sql' && window._cmEditor) setTimeout(() => window._cmEditor.refresh(), 50);
        // Switching to SQL editor lifts the advanced-QB join restriction
        if (tab === 'sql' && DataLaVistaState.queryMode === 'advanced') setDesignTabsEnabled(true);

        const clearBtn = document.getElementById('btn-clear-query');
        if (clearBtn) clearBtn.disabled = (tab === 'dataPreview');
        updateRunQueryButton();
      }

      /** Enable/disable Run Query based on the active sub-tab and its content. */
      function updateRunQueryButton() {
        const btn = document.getElementById('btn-run-query');
        if (!btn) return;
        const tab = DataLaVistaState.qmTab || 'qb';
        if (tab === 'dataPreview') {
          btn.disabled = true;
          return;
        }
        if (tab === 'sql') {
          const hasSQL = window._cmEditor
            ? !!window._cmEditor.getValue().trim()
            : !!(DataLaVistaState.sql || '').trim();
          btn.disabled = !hasSQL;
        } else {
          // QB tab — enabled only when the active mode has at least one table loaded
          const qmode = DataLaVistaState.queryMode || 'basic';
          const hasTable = qmode === 'basic'
            ? !!DataLaVistaState.basicQB.tableName
            : Object.keys(DataLaVistaState.advancedQB.nodes || {}).length > 0;
          btn.disabled = !hasTable;
        }
      }

      // ============================================================
      // UTILITIES
      // ============================================================
      let _statusClearTimer = null;
      const _statusIcons = {
        "loading": '⌛', "loading-emoji": '⏳',
        "success": '✓', "success-emoji": '✅',
        "error": '✕', "error-emoji": '❌',
        "warning": '⚠', "warning-emoji": '⚠️',
        "info": 'ℹ', "info-emoji": 'ℹ️',
        "question": '?', "question-emoji": '❓',
        "skipped": '»', "skipped-emoji": '⏭️',
        "disabled": '✕', "disabled-emoji": '🚫', // Or '➖' / '⚪'
        "locked": '⦸', "locked-emoji": '🔒',
        "searching": '⌕', "search-emoji": '🔍'
      };

      function setStatus(msg, type = 'info') {
        const icon = _statusIcons[type] ?? _statusIcons['info'] ?? 'ℹ';
        document.getElementById('status-bar').textContent = `${icon} ${msg}`;
        clearTimeout(_statusClearTimer);
        _statusClearTimer = setTimeout(() => {
          document.getElementById('status-bar').textContent = '';
        }, 10000);
      }

      function toast(msg, type = 'info') {
        const icon = _statusIcons[type] ?? _statusIcons['info'] ?? 'ℹ';
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast ' + type;
        t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
        container.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 400ms'; setTimeout(() => t.remove(), 400); }, 4400);
      }

      function downloadText(text, filename, mime) {
        const a = document.createElement('a');
        a.href = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(text);
        a.download = filename;
        a.click();
      }

      // TODO: actually show help! Also credits, like the ones in the generate config tab
      function showHelp() {
        toast('DataLaVista — Connect a SharePoint site, CSVs, or JSON, and create beautiful dashboards.', 'info');
      }


      
      /** Detect if running inside a SharePoint site and return the site URL, or null. */
      function getSpSiteUrl() {
        let siteUrl = null;
        try {
          if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl) {
            siteUrl = _spPageContextInfo.webAbsoluteUrl.replace(/\/$/, '');
          }
        } catch(e) {}
        // Fallback: check if current URL looks like SharePoint
        const m = window.location.href.match(/^(https?:\/\/[^/]+(?:\/sites\/[^/]+|\/teams\/[^/]+)?)/);
        if (m && !siteUrl && (window.location.hostname.toLowerCase().includes('sharepoint.com') ||
                  window.location.hostname.toLowerCase().includes('.sharepoint.')) &&
                  window.location.pathname.startsWith('/sites/') ||
                  window.location.pathname.startsWith('/teams/')) {
          siteUrl = m[1];
        }
        return siteUrl;
      }

      // ============================================================
      // SHAREPOINT FILE PICKER
      // ============================================================

      // SP file picker state
      const _spPicker = {
        siteUrl: '',
        stack: [],       // breadcrumb stack: [{label, serverRelUrl}]
        selected: null,  // { name, serverRelUrl, absoluteUrl }
      };

      /** Show or hide the Browse SP buttons, and enable/disable SP publish buttons, based on SP detection. */
      function spPickerCheckVisibility() {
        const url = getSpSiteUrl();
        const display = url ? '' : 'none';
        ['btn-sp-browse', 'btn-sp-browse-json', 'btn-sp-browse-config', 'btn-sp-browse-remote'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.style.display = display;
        });
        ['btn-publish-sp', 'btn-save-sp-list'].forEach(id => {
          const btn = /** @type {HTMLButtonElement|null} */ (document.getElementById(id));
          if (btn) btn.disabled = !url;
        });
      }

      /** Open the file picker modal. */
      async function spPickerOpen() {
        const siteUrl = getSpSiteUrl();
        if (!siteUrl) { toast('SharePoint site URL not detected', 'warning'); return; }
        _spPicker.siteUrl = siteUrl;
        _spPicker.stack = [{ label: 'Document Libraries', serverRelUrl: null }];
        _spPicker.selected = null;
        document.getElementById('sp-picker-select-btn').disabled = true;
        document.getElementById('sp-picker-selected-label').textContent = 'No file selected';
        document.getElementById('sp-picker-overlay').classList.add('active');
        await spPickerLoad();
      }

      function spPickerClose() {
        document.getElementById('sp-picker-overlay').classList.remove('active');
      }

      /** Confirm selection — set csv-url to the selected file's absolute URL. */
      function spPickerConfirm() {
        if (!_spPicker.selected) return;
        const urlEl = document.getElementById('csv-url');
        if (urlEl) urlEl.value = _spPicker.selected.absoluteUrl;
        spPickerClose();
        toast(`Selected: ${_spPicker.selected.name}`, 'success');
      }

      /** Open SharePointFileDialog to browse for a CSV/TSV file and populate #csv-url. */
      async function spBrowseCSV() {
        try {
          const result = await SharePointFileDialog.show({
            mode: 'open',
            type: 'file',
            fileExtensions: ['.csv', '.CSV', '.tsv', '.txt'],
            defaultFolders: ['/Shared Documents/Data', '/Shared Documents', '/SiteAssets']
          });
          if (!result) return;
          const urlEl = /** @type {HTMLInputElement|null} */ (document.getElementById('csv-url'));
          if (urlEl) urlEl.value = result.url;
          toast(`Selected: ${result.fileName}`, 'success');
        } catch (err) {
          if (err && err.message !== 'Dialog cancelled') toast(err.message || String(err), 'error');
        }
      }

      /** Open SharePointFileDialog to browse for a JSON file and populate #json-url. */
      async function spBrowseJSON() {
        try {
          const result = await SharePointFileDialog.show({
            mode: 'open',
            type: 'file',
            fileExtensions: ['.json', '.json5', '.JSON', '.js', '.txt'],
            defaultFolders: ['/Shared Documents/Data', '/Shared Documents', '/SiteAssets']
          });
          if (!result) return;
          const urlEl = /** @type {HTMLInputElement|null} */ (document.getElementById('json-url'));
          if (urlEl) urlEl.value = result.url;
          toast(`Selected: ${result.fileName}`, 'success');
        } catch (err) {
          if (err && err.message !== 'Dialog cancelled') toast(err.message || String(err), 'error');
        }
      }

      /** Open SharePointFileDialog to browse for a dashboard JSON file and populate #config-url. */
      async function spBrowseConfig() {
        try {
          const result = await SharePointFileDialog.show({
            mode: 'open',
            type: 'file',
            fileExtensions: ['.json', '.json5', '.JSON'],
            defaultFolders: ['/Shared Documents/Dashboards', '/Shared Documents/Reports', '/Shared Documents', '/SiteAssets']
          });
          if (!result) return;
          const urlEl = /** @type {HTMLInputElement|null} */ (document.getElementById('config-url'));
          if (urlEl) urlEl.value = result.url;
          toast(`Selected: ${result.fileName}`, 'success');
        } catch (err) {
          if (err && err.message !== 'Dialog cancelled') toast(err.message || String(err), 'error');
        }
      }

      /** Open SharePointFileDialog to browse for any supported data file and populate #remote-url. */
      async function spBrowseRemoteFile() {
        try {
          const result = await SharePointFileDialog.show({
            mode: 'open',
            type: 'file',
            fileExtensions: ['.csv', '.CSV', '.json', '.json5', '.JSON', '.xlsx', '.xls', '.xml', '.XML', '.sqlite', '.db'],
            defaultFolders: ['/Shared Documents/Data', '/Shared Documents', '/SiteAssets']
          });
          if (!result) return;
          const urlEl = /** @type {HTMLInputElement|null} */ (document.getElementById('remote-url'));
          if (urlEl) urlEl.value = result.url;
          toast(`Selected: ${result.fileName}`, 'success');
        } catch (err) {
          if (err && err.message !== 'Dialog cancelled') toast(err.message || String(err), 'error');
        }
      }

      /** Load the current level (root = libraries, else folder contents). */
      async function spPickerLoad() {
        const spinner = document.getElementById('sp-picker-spinner');
        const body = document.getElementById('sp-picker-body');
        spinner.classList.add('active');
        body.innerHTML = '';
        spPickerRenderBreadcrumb();

        const current = _spPicker.stack[_spPicker.stack.length - 1];
        try {
          if (current.serverRelUrl === null) {
            // Root level — list document libraries (BaseTemplate = 101)
            await spPickerLoadLibraries();
          } else {
            // Inside a library/folder — list subfolders + CSV/Excel files
            await spPickerLoadFolder(current.serverRelUrl);
          }
        } catch(e) {
          console.error('[DLV SP Picker]', e);
          body.innerHTML = `<div style="padding:16px;color:var(--error);font-size:12px">Error: ${e.message}</div>`;
        }
        spinner.classList.remove('active');
      }

      async function spPickerLoadLibraries() {
        const url = `${_spPicker.siteUrl}/_api/web/lists?$select=Title,RootFolder/ServerRelativeUrl&$expand=RootFolder&$filter=BaseTemplate eq 101 and Hidden eq false`;
        const json = await spFetch(url);
        const libs = extractRows(json).filter(l => l.RootFolder);
        libs.sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));

        const body = document.getElementById('sp-picker-body');
        if (!libs.length) {
          body.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-secondary)">No document libraries found.</div>';
          return;
        }
        libs.forEach(lib => {
          const serverRelUrl = lib.RootFolder.ServerRelativeUrl;
          body.appendChild(spPickerMakeItem('📁', lib.Title, null, false, () => {
            _spPicker.stack.push({ label: lib.Title, serverRelUrl });
            spPickerLoad();
          }));
        });
      }

      async function spPickerLoadFolder(serverRelUrl) {
        const encodedUrl = encodeURIComponent(serverRelUrl);
        // Fetch subfolders
        const foldersUrl = `${_spPicker.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedUrl}')/Folders?$select=Name,ServerRelativeUrl&$filter=Name ne 'Forms'`;
        // Fetch files — CSV and Excel only
        const filesUrl = `${_spPicker.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedUrl}')/Files?$select=Name,ServerRelativeUrl,Length&$filter=(substringof('.csv',Name) or substringof('.CSV',Name) or substringof('.xlsx',Name) or substringof('.xls',Name))`;

        const [foldersJson, filesJson] = await Promise.all([
          spFetch(foldersUrl).catch(() => ({ value: [] })),
          spFetch(filesUrl).catch(() => ({ value: [] }))
        ]);

        const folders = extractRows(foldersJson).sort((a,b) => (a.Name||'').localeCompare(b.Name||''));
        const files   = extractRows(filesJson).sort((a,b) => (a.Name||'').localeCompare(b.Name||''));

        const body = document.getElementById('sp-picker-body');
        if (!folders.length && !files.length) {
          body.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-secondary)">No CSV or Excel files found in this folder.</div>';
          return;
        }

        folders.forEach(f => {
          body.appendChild(spPickerMakeItem('📁', f.Name, null, false, () => {
            _spPicker.stack.push({ label: f.Name, serverRelUrl: f.ServerRelativeUrl });
            spPickerLoad();
          }));
        });

        files.forEach(f => {
          const sizeLabel = f.Length ? spPickerFormatSize(+f.Length) : '';
          const absUrl = _spPicker.siteUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1') + f.ServerRelativeUrl;
          const isCSV = f.Name.toLowerCase().endsWith('.csv');
          const icon = isCSV ? '📄' : '📗';
          body.appendChild(spPickerMakeItem(icon, f.Name, sizeLabel, true, () => {
            // Toggle selection
            body.querySelectorAll('.sp-picker-item').forEach(el => el.classList.remove('sp-selected'));
            const el = body.querySelector(`[data-sp-name="${CSS.escape(f.Name)}"]`);
            if (el) el.classList.add('sp-selected');
            _spPicker.selected = { name: f.Name, serverRelUrl: f.ServerRelativeUrl, absoluteUrl: absUrl };
            document.getElementById('sp-picker-selected-label').textContent = f.Name;
            document.getElementById('sp-picker-select-btn').disabled = false;
          }, f.Name));
        });
      }

      function spPickerMakeItem(icon, name, size, isFile, onClick, dataName) {
        const el = document.createElement('div');
        el.className = 'sp-picker-item';
        if (dataName) el.dataset.spName = dataName;
        el.innerHTML = `<span class="sp-item-icon">${icon}</span><span class="sp-item-name" title="${name}">${name}</span>${size ? `<span class="sp-item-size">${size}</span>` : ''}`;
        if (!isFile) el.innerHTML += `<span style="font-size:10px;color:var(--text-disabled);margin-left:auto">▶</span>`;
        el.addEventListener('click', onClick);
        return el;
      }

      function spPickerRenderBreadcrumb() {
        const bc = document.getElementById('sp-picker-breadcrumb');
        bc.innerHTML = '';
        _spPicker.stack.forEach((crumb, i) => {
          if (i > 0) {
            const sep = document.createElement('span');
            sep.className = 'sp-crumb-sep';
            sep.textContent = ' › ';
            bc.appendChild(sep);
          }
          const span = document.createElement('span');
          span.className = 'sp-crumb';
          span.textContent = crumb.label;
          if (i < _spPicker.stack.length - 1) {
            span.addEventListener('click', () => {
              _spPicker.stack = _spPicker.stack.slice(0, i + 1);
              _spPicker.selected = null;
              document.getElementById('sp-picker-select-btn').disabled = true;
              document.getElementById('sp-picker-selected-label').textContent = 'No file selected';
              spPickerLoad();
            });
          } else {
            span.style.fontWeight = '600';
            span.style.color = 'var(--text)';
            span.style.cursor = 'default';
          }
          bc.appendChild(span);
        });
      }

      function spPickerFormatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }


      
