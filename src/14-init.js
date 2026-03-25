/* ============================================================
This file is part of DataLaVista
14-init.js: App initialization, lazy init guard, and report URL loading.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
Summary: App initialization, lazy init guard, and report URL loading.
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
      // INIT
      // ============================================================
      function initAdvOptsResizer() {
        const resizer = document.getElementById('adv-opts-resizer');
        const panel   = document.getElementById('adv-options-panel');
        if (!resizer || !panel) return;
        resizer.addEventListener('mousedown', e => {
          e.preventDefault();
          resizer.classList.add('dragging');
          const startX = e.clientX;
          const startW = panel.offsetWidth;
          const onMove = mv => {
            // dragging left increases width
            const delta = startX - mv.clientX;
            const newW = Math.max(180, Math.min(700, startW + delta));
            panel.style.width = newW + 'px';
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
      // REPORT MODE — ?report=<url> parameter
      // ============================================================
      /**
       * loadReportFromUrl(reportUrl)
       *
       * Called automatically at startup when the page URL contains a
       * "report=" query parameter pointing at a DataLaVista JSON config.
       * On any error the loading banner is removed, a toast is shown, and the
       * normal designer UI is presented so the user can still work.
       */
      async function loadReportFromUrl(reportUrl) {
        console.log('DEBUG: Entering loadReportFromUrl()');
        // Show full-screen loading overlay immediately
        showLoadingPopup('⏳ Loading report. Please wait...');
        hideConnectPopup();
        setStatus('⏳ Loading report…');

        try {
          console.log("DEBUG: Fetching report config from URL: " + reportUrl);
          // ── Step 1: Fetch the config JSON ──────────────────────────────
          const cfg = await fetchJSONWithFallbacks(reportUrl);

          // ── Step 2: Load config (restores DS, tables, SQL, design) ─────
          console.log('2222222222222222 DEBUG: loadReportFromUrl -> calling loadConfig');
          await loadConfig(cfg);
          console.log('DEBUG: loadReportFromUrl -> loadConfig completed successfully');

          // ── Step 3: Run SQL and render all widgets ─────────────────────
          console.log("3333333333333     DEBUG: Report config loaded. Refreshing dashboard preview...");
          showLoadingPopup('⏳ Refreshing data…');
          if (!state.sql || state.sql.trim()==='') {
            showLoadingPopup('⚠ Unable to load report data.');
            throw new Error('Report config contains no SQL query.');
          }
          console.log("DEBUG: Running SQL query to get data for preview - refreshDashboardPreview()...");
          await refreshDashboardPreview();

          // ── Step 4: Switch to preview and maximise ─────────────────────
          console.log("4444444444444444444444 DEBUG: Data loaded and widgets rendered. Switching to preview tab and applying report mode styles...");
          document.body.classList.add('dlv-report-mode');
          setStatus('✅ Report ready');
          toast('Report loaded', 'success');

        } catch (err) {
          showLoadingPopup('⚠ Unable to load report data.');
          toast('Unable to load report. :(', 'error');
          console.log('❌ DataLaVista was unable to load the report: \n ' + err.message);
          setStatus('❌ DataLaVista was unable to load the report. See console for details');
        } finally {
          hideLoadingPopup();
        }
      }

      function swapDesignReportModes(isReportMode = false) {
        state.reportMode = isReportMode;
        if (isReportMode) {
          document.body.classList.add('dlv-report-mode');
          // Hide design mode buttons
          if(document.getElementById('btn-connect')) document.getElementById('btn-connect').classList.add('hidden');
          if(document.getElementById('btn-save-config')) document.getElementById('btn-save-config').classList.add('hidden');
          if(document.getElementById('btn-sep-after-save-config')) document.getElementById('btn-sep-after-save-config').classList.add('hidden');          
          if(document.getElementById('toolbar-tab-nav')) document.getElementById('toolbar-tab-nav').classList.add('hidden');
          if(document.getElementById('preview-title-bar')) document.getElementById('preview-title-bar').classList.add('hidden');
          if(document.getElementById('toolbar-tab-reportMode')) document.getElementById('toolbar-tab-reportMode').classList.remove('hidden');
          if(document.getElementById('preview-toolbar')) document.getElementById('preview-toolbar').classList.add('hidden');
        } else {
          document.body.classList.remove('dlv-report-mode');
          // Show design mode buttons
          if(document.getElementById('btn-connect')) document.getElementById('btn-connect').classList.remove('hidden');
          if(document.getElementById('btn-save-config')) document.getElementById('btn-save-config').classList.remove('hidden');
          if(document.getElementById('btn-sep-after-save-config')) document.getElementById('btn-sep-after-save-config').classList.remove('hidden');
          if(document.getElementById('toolbar-tab-nav')) document.getElementById('toolbar-tab-nav').classList.remove('hidden');
          if(document.getElementById('toolbar-tab-reportMode')) document.getElementById('toolbar-tab-reportMode').classList.add('hidden');
        }

      }

      // Guard: call init() automatically if it was never called (e.g. SiteAssets/lazy mode).
      function ensureInit() {
        if (!state._initialized) init();
      }

      /// Main initialization function to set up event listeners, resizers, and default states.
      async function init() {
        if (state._initialized) return;
        state._initialized = true;
        console.log("Come with me if you want to query...");
        setupAlaSQL();
        

        // Get current URL and parameters
        const siteUrl = window.location.href;
        const siteUrlParams = new URLSearchParams(window.location.search || siteUrl.split('?')[1] || '');

        // Detect SharePoint URL from current page
        const spSiteUrl = getSpSiteUrl();

        // If running inside SharePoint, check if the page is in edit mode
        let spEditMode = false;
        if (spSiteUrl) {
          if (window._spPageContextInfo) {
            spEditMode = window._spPageContextInfo.isPageCheckedOutByCurrentUser || false;
          } else if (siteUrlParams.get('Mode') || siteUrlParams.get('mode')){
            // Fallback: check URL parameters for Mode=Edit
            spEditMode = (siteUrlParams.get('Mode') || siteUrlParams.get('mode') ||'').toLowerCase().includes('edit');
          } else if (document.body.classList.contains('sp-legacyPageMode')) {
            // Another fallback: check for legacyPageMode class which is present in classic pages in edit mode
            spEditMode = true;
          } else {
            spEditMode = false;  // Default to false if we can't detect
          }
        }

        // Default SQL hint
            if (document.getElementById('sql-editor')) {
              setupCodeMirror();
              if (window._cmEditor) window._cmEditor.setValue('-- Connect to a data source and drag a table into the query builder\n-- or write your SQL here directly\nSELECT \'DataLaVista\'');
            }

        // Detect whether we're in Report mode (report= parameter) or Designer mode, and show/hide UI accordingly
        const reportParam = siteUrlParams.get('report');
        if (reportParam) {
            /* *** DATALAVISTA REPORT MODE *** */
            state.reportMode = true;
            swapDesignReportModes(true);
            document.getElementById('preview-canvas').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px">Your DataLaVista dashboard is loading...</div>';
            console.log('DEBUG: Leaving init()... calling loadReportFromUrl() at: ' + new Date().toISOString());
            await loadReportFromUrl(reportParam);
            console.log('DEBUG: Returned from loadReportFromUrl() at: ' + new Date().toISOString());
          } else {
            /* *** DATALAVISTA DESIGNER MODE *** */
            state.reportMode = false;
            swapDesignReportModes(false);
            initToolbox();
            initResizers();
            setQBMode('basic');
            switchQMTab('qb');
            switchTab('query');
            spPickerCheckVisibility();

            // Add Event Listeners
            document.getElementById('sp-auth')?.addEventListener('change', function () {
              document.getElementById('sp-token-group')?.classList.toggle('hidden', this.value !== 'token');
            });
            document.getElementById('config-file')?.addEventListener('change', async function () {
              const f = this.files[0]; if (!f) return;
              const text = await f.text();
              const el = document.getElementById('config-json-input');
              if (el) el.value = text;
            });

            // Handle CSV upload (file input change event) for Connect popup
            document.getElementById('csv-file')?.addEventListener('change', async function () {
              const f = this.files[0];
              if (!f) return;
              let text;
              try {
                text = await f.text();
              } catch (e) {
                toast('Error reading file: ' + e.message, 'error');
                return;
              }
              const dsEl = document.getElementById('csv-ds-name');
              const rawDsName = (dsEl?.value || '').trim();
              const dsName = generateDataSourceName('csv', rawDsName);
              loadCSVData(dsName||'CSV', null, f.name, '', true, text); // Create new DS for this CSV file, with isUploadedFile=true
              updateConnectButton();
              hideConnectPopup();
            });

            // Wire options panel left-edge resizer
            initAdvOptsResizer();
            // Wire clear button as drag-drop target for AQB items
            setupClearButtonDrop();
            
            // Show the connect popup by default to encourage users to connect to their data,
            // but if we detect we're in SharePoint edit mode, hide it since it can interfere with page editing.
            if (spSiteUrl) {
              // We are in SharePoint
              if (spEditMode) {
                // If we're in SharePoint edit mode, hide the connect popup since it can interfere with page editing.
                hideConnectPopup();
              } else {
                // We are not in SharePoint edit mode
                // Prefil connect popup with SharePoint URL if detected, to make it easier for users to connect
                const el = document.getElementById('sp-url');
                if (el) el.value = spSiteUrl;
                showConnectPopup();
              }
            } else {
              // We are not in SharePoint, so show the connect popup by default
              showConnectPopup();
            }
          }

        // Show the main content (hidden by default) after setup is done
        const contentDiv = document.getElementById('content');
        if (contentDiv) contentDiv.style.display = 'flex';
        console.log("*** DataLaVista visual component loading complete. ***");
      }

      // ── Expose all functions on window so onclick="foo()" works in SharePoint ──
