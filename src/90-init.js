/* ============================================================
This file is part of DataLaVista™
90-init.js: App initialization, lazy init guard, and report URL loading.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-04
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

// ─────────────────────────────────────────────────────────────────────────────
// APP HEIGHT MANAGEMENT
// Dynamically calculates and sets --app-top-offset so #app fills the remaining
// viewport height below whatever chrome sits above it (standalone, SharePoint,
// or embedded iframe). Called once at init and wired to resize/mutation events.
// ─────────────────────────────────────────────────────────────────────────────

  function dlvIsInIframe() {
      try { return window.self !== window.top; } catch (e) { return true; }
  }

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


  /**
   * loadReportFromUrl(reportUrl)
   *
   * Called automatically at startup when the page URL contains a
   * "report=" query parameter pointing at a DataLaVista JSON config.
   * On any error the loading banner is removed, a toast is shown, and the
   * normal designer UI is presented so the user can still work.
   */
  async function loadReportFromUrl(reportUrl) {
    // Show full-screen loading overlay immediately
    showLoadingPopup('⏳ Loading report. Please wait...');
    hideConnectPopup();
    setStatus('Loading report…', 'loading');

    try {
      // ── Step 1: Fetch the config JSON ──────────────────────────────
      const cfg = await fetchJSONWithFallbacks(reportUrl);

      // ── Step 2: Load config (restores DS, tables, SQL, design) ─────
      await loadConfig(cfg);

      // ── Step 3: Run SQL and render all widgets ─────────────────────
      showLoadingPopup('⏳ Refreshing data…');
      if (!DataLaVistaState.sql || DataLaVistaState.sql.trim()==='') {
        showLoadingPopup('⚠ Unable to load report data.');
        throw new Error('Report config contains no SQL query.');
      }

      if(DataLaVistaState.reportLoaded) {
        setStatus('Report ready', 'success');
        toast('Report loaded', 'success');
      } else {
        throw new Error('Report data failed to load.');
      }

    } catch (err) {
      showLoadingPopup('⚠ Unable to load report data.');
      toast('Unable to load report.', 'error');
      console.log('❌ DataLaVista was unable to load the report: \n ' + err.message);
      setStatus('DataLaVista was unable to load the report. See console for details', 'error');
    } finally {
      // Switch to preview and maximise it to show the error message if loading failed, or the report if loading succeeded.
      document.body.classList.add('dlv-report-mode');
      hideLoadingPopup();
    }
  }

  function swapReportMode(newReportMode = DataLaVistaState.reportMode) {
    if (DataLaVistaState.reportMode === 'view') {
      document.body.classList.add('dlv-report-mode');
      // Hide design mode buttons
      if(document.getElementById('btn-connect')) document.getElementById('btn-connect').classList.add('hidden');
      if(document.getElementById('btn-save-config')) document.getElementById('btn-save-config').classList.add('hidden');
      if(document.getElementById('btn-sep-after-save-config')) document.getElementById('btn-sep-after-save-config').classList.add('hidden');          
      if(document.getElementById('toolbar-tab-nav')) document.getElementById('toolbar-tab-nav').classList.add('hidden');
      if(document.getElementById('preview-title-bar')) document.getElementById('preview-title-bar').classList.add('hidden');
      if(document.getElementById('toolbar-tab-reportMode')) document.getElementById('toolbar-tab-reportMode').classList.remove('hidden');
      if(document.getElementById('preview-toolbar')) document.getElementById('preview-toolbar').classList.add('hidden');
    } else if (DataLaVistaState.reportMode === 'edit') {
      document.body.classList.remove('dlv-report-mode');
      // Show design mode buttons
      if(document.getElementById('btn-connect')) document.getElementById('btn-connect').classList.remove('hidden');
      if(document.getElementById('btn-save-config')) document.getElementById('btn-save-config').classList.remove('hidden');
      if(document.getElementById('btn-sep-after-save-config')) document.getElementById('btn-sep-after-save-config').classList.remove('hidden');
      if(document.getElementById('toolbar-tab-nav')) document.getElementById('toolbar-tab-nav').classList.remove('hidden');
      if(document.getElementById('toolbar-tab-reportMode')) document.getElementById('toolbar-tab-reportMode').classList.add('hidden');
    } else{return;}
  }
  
  // Guard: call init() automatically if it was never called (e.g. SiteAssets/lazy mode).
  function ensureInit() {
    if (!DataLaVistaState._initialized) init();
  }



  /* *** INIT FUNCTION *** */
  // Main initialization function to set up event listeners, resizers, and default states.
  async function init() {
    if (DataLaVistaState && DataLaVistaState._initialized) return;
    //window.DataLaVistaState = new Proxy(dlvRawState, dlvStateHandler);
    console.log('Initializing...');
    DataLaVistaState._initialized = true;
    console.log("Come with me if you want to query...");
    setupAlaSQL();
    

    // Get current URL and parameters
    const siteUrl = window.location.href;
    const siteUrlParams = new URLSearchParams(window.location.search || siteUrl.split('?')[1] || '');

    // Detect URL parameters for report loading and mode and report URL
    const reportParam = siteUrlParams.get('report') || siteUrlParams.get('Report') ||'';
    const reportModeParam = siteUrlParams.get('reportMode') || siteUrlParams.get('reportmode') || siteUrlParams.get('ReportMode') || '';

    if(reportModeParam && reportModeParam.toLowerCase()=='edit') {
      DataLaVistaState.reportMode = 'edit';
    } else if(reportModeParam && reportModeParam.toLowerCase()=='view') {
      DataLaVistaState.reportMode = 'view';
    } else {
      DataLaVistaState.reportMode = reportParam ? 'view' : 'edit'; // Default to 'view' if report param is present, otherwise 'edit'
    }

    if(reportParam && reportParam.trim() !== '') {
      //detect if reportParam is a full URL or just a relative path; if it's a relative path, convert it to a full URL based on current site URL
      if (!reportParam.startsWith('http')) {
        DataLaVistaState.reportUrl = window.location.origin + reportParam;
      } else {
        DataLaVistaState.reportUrl = reportParam;
      }
      // Detect if reportUrl is URI encoded and decode it for display and fetching
      try {
        const decodedUrl = decodeURIComponent(DataLaVistaState.reportUrl);
        if (decodedUrl !== DataLaVistaState.reportUrl) {
          DataLaVistaState.reportUrl = decodedUrl;
        }
      } catch (e) {}
    }

    // Detect SharePoint URL from current page
    DataLaVistaState.spSiteUrl = getSpSiteUrl() || ''; // Store in state for global access and reactivity; default to empty string if not detected
    if(DataLaVistaState.spSiteUrl) {
      DataLaVistaState.isSpSite = true;
      console.log('Detected SharePoint environment. Site URL: ' + DataLaVistaState.spSiteUrl);
    }

    // If running inside SharePoint, check if the page is in edit mode
    if (DataLaVistaState.isSpSite) {
      if (window._spPageContextInfo) {
        DataLaVistaState.spPageMode = window._spPageContextInfo.isPageCheckedOutByCurrentUser || false;
      } else if (siteUrlParams.get('Mode') || siteUrlParams.get('mode')) {
        // Fallback: check URL parameters for Mode=Edit
        DataLaVistaState.spPageMode = (siteUrlParams.get('Mode') || siteUrlParams.get('mode') ||'').toLowerCase().includes('edit');
      } else if (document.body.classList.contains('sp-legacyPageMode')) {
        // Another fallback: check for legacyPageMode class which is present in classic pages in edit mode
        DataLaVistaState.spPageMode = true;
      } else {
        DataLaVistaState.spPageMode = false;  // Default to false if we can't detect
      }
    }

    // Default SQL hint
        if (document.getElementById('sql-editor')) {
          setupCodeMirror();
          if (window._cmEditor) window._cmEditor.setValue('-- Connect to a data source and drag a table into the query builder\n-- or write your SQL here directly\nSELECT \'DataLaVista\'');
        }


    if (DataLaVistaState.reportMode === 'view') {
        /* *** DATALAVISTA REPORT VIEW MODE *** */
        swapReportMode('view'); // Apply report mode UI classes and button visibility
        if(reportParam && reportParam.trim() !== '') {
          document.getElementById('preview-canvas').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px">Your DataLaVista dashboard is loading...</div>';
        } else {
          document.getElementById('preview-canvas').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-size:14px">The Report URL is missing or invalid. Please check your report link.</div>';
          toast('Invalid report URL. Please check your report link.', 'error');
          setStatus('The Report URL is missing or invalid. Please check your report link.', 'error');
          return;
        }
        
        await loadReportFromUrl(reportParam);
      } else {
        /* *** DATALAVISTA DESIGNER EDIT MODE *** */
        swapReportMode('edit'); // Apply report mode UI classes and button visibility
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
          let text;
          try {
            text = await f.text();
          } catch (e) {
            toast('Error reading file: ' + e.message, 'error');
            return;
          }
          const parsed = safeJSONParse(text, 'Config');
          if (!parsed) return;
          try {
            await loadConfig(parsed);
            updateConnectButton();
            /** @type {HTMLButtonElement} */ (document.getElementById('btn-save-config')).disabled = false;
            hideConnectPopup();
          } catch (e) {
            toast('Failed to load dashboard: ' + e.message, 'error');
          }
        });


        // Wire options panel left-edge resizer
        initAdvOptsResizer();
        // Wire clear button as drag-drop target for AQB items
        setupClearButtonDrop();

        // Clicking the title input shows Dashboard Title properties in the right panel
        document.getElementById('title-input')?.addEventListener('click', () => {
          renderDashboardTitleProperties();
        });
        document.getElementById('title-input')?.addEventListener('focus', () => {
          renderDashboardTitleProperties();
        });
        
        // If a report URL was provided with reportMode=Edit, populate config-url and load it into the designer
        if (reportParam && reportParam.trim() !== '') {
          const configUrlEl = /** @type {HTMLInputElement|null} */ (document.getElementById('config-url'));
          if (configUrlEl) configUrlEl.value = DataLaVistaState.reportUrl || reportParam;
          try {
            showLoadingPopup('⏳ Loading report. Please wait...');
            hideConnectPopup();
            setStatus('Loading report…', 'loading');
            const cfg = await fetchJSONWithFallbacks(reportParam);
            await loadConfig(cfg);
            // If on SP and reportUrl matches the same SP tenant/site collection, show the published URL
            // as if the user had already published, and wire Save to write back to SharePoint.
            if (DataLaVistaState.isSpSite && DataLaVistaState.reportUrl) {
              const spSiteUrl = DataLaVistaState.spSiteUrl;
              const spBase = spSiteUrl.substring(0, spSiteUrl.lastIndexOf('/') + 1);
              if (spBase && DataLaVistaState.reportUrl.startsWith(spBase)) {
                const dlvUrl = new URL(window.location.href);
                const publishedUrl = dlvUrl.origin + dlvUrl.pathname + '?report=' + encodeURIComponent(DataLaVistaState.reportUrl);
                _showPublishResult(publishedUrl);
              }
            }
          } catch (err) {
            toast('Unable to load report.', 'error');
            console.log('❌ DataLaVista was unable to load the report: \n ' + err.message);
            setStatus('DataLaVista was unable to load the report. See console for details', 'error');
          } finally {
            hideLoadingPopup();
          }
        }

        // Show the connect popup by default to encourage users to connect to their data,
        // but if we detect we're in SharePoint edit mode, hide it since it can interfere with page editing.
        if (reportParam && reportParam.trim() !== '') {
          // Report was loaded — don't show the connect popup
        } else if (DataLaVistaState.isSpSite) {
          // We are in SharePoint
          if (DataLaVistaState.spPageMode=='edit') {
            // If we're in SharePoint edit mode, hide the connect popup since it can interfere with page editing.
            hideConnectPopup();
          } else {
            // We are not in SharePoint edit mode
            // Prefil connect popup with SharePoint URL if detected, to make it easier for users to connect
            const el = document.getElementById('sp-url');
            if (el) el.value = DataLaVistaState.spSiteUrl;
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

      // Load Google Analytics after everything else is loaded and only if we're on the production domain.
    try{
      if (window.location.hostname === 'code.depressioncenter.org') {    
        var gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-3Q455XWS5F';
        document.head.appendChild(gaScript);
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-3Q455XWS5F');
      }
    } catch (e) { }
  }