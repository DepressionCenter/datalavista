/* ============================================================
This file is part of DataLaVista™
25-data-sources.js: Data source connection popup, remote fetch guards, and source loaders.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
Summary: Data source connection popup, remote fetch guards, and source loaders.
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
    // CONNECT QUEUE — queue-based upload/remote loading
    // ============================================================
    var ConnectQueue = {
      uploadedFiles: [],  // { file, type, dsName }
      remoteUrls: [],     // { url, type, dsName }

      addUploadedFile(file, type, dsName) {
        this.uploadedFiles.push({ file, type, dsName });
        this.renderUploadQueue();
      },
      addRemoteUrl(url, type, dsName) {
        this.remoteUrls.push({ url, type, dsName });
        this.renderRemoteQueue();
      },
      removeUploadedFile(idx) { this.uploadedFiles.splice(idx, 1); this.renderUploadQueue(); },
      removeRemoteUrl(idx)    { this.remoteUrls.splice(idx, 1);    this.renderRemoteQueue(); },
      clearAll() {
        this.uploadedFiles = []; this.remoteUrls = [];
        this.renderUploadQueue(); this.renderRemoteQueue();
      },
      _fileIcon(type) {
        const icons = { csv:'📄', json:'📚', xlsx:'📗', xls:'📗', xml:'🗂️', sqlite:'🗄️', db:'🗄️' };
        return icons[type] || '📎';
      },
      renderUploadQueue() {
        const c = document.getElementById('upload-queue');
        if (!c) return;
        if (!this.uploadedFiles.length) { c.innerHTML = '<div class="queue-empty">No files queued</div>'; return; }
        c.innerHTML = this.uploadedFiles.map((item, i) => {
          const errClass = item.error ? ' queue-item-error' : '';
          const errMsg = item.error ? `<span class="queue-error-msg" title="${item.error}">⚠ ${item.error}</span>` : '';
          return `<div class="queue-item${errClass}" style="flex-wrap:wrap">
            <span>${this._fileIcon(item.type)}</span>
            <span class="queue-name" title="${item.file.name}">${item.file.name}</span>
            <span class="queue-badge">${item.type.toUpperCase()}</span>
            <button class="queue-remove" onclick="ConnectQueue.removeUploadedFile(${i})" title="Remove">✕</button>
            ${errMsg}
          </div>`;
        }).join('');
      },
      renderRemoteQueue() {
        const c = document.getElementById('remote-queue');
        if (!c) return;
        if (!this.remoteUrls.length) { c.innerHTML = '<div class="queue-empty">No remote files queued</div>'; return; }
        c.innerHTML = this.remoteUrls.map((item, i) => {
          const fname = item.url.split('/').pop() || 'remote file';
          const errClass = item.error ? ' queue-item-error' : '';
          const errMsg = item.error ? `<span class="queue-error-msg" title="${item.error}">⚠ ${item.error}</span>` : '';
          return `<div class="queue-item${errClass}" style="flex-wrap:wrap">
            <span>${this._fileIcon(item.type)}</span>
            <span class="queue-name" title="${item.url}">${fname}</span>
            <span class="queue-badge">${item.type.toUpperCase()}</span>
            <button class="queue-remove" onclick="ConnectQueue.removeRemoteUrl(${i})" title="Remove">✕</button>
            ${errMsg}
          </div>`;
        }).join('');
      }
    };

    // ============================================================
    // POPUP LOGIC
    // ============================================================
    function showConnectPopup() {
      ensureInit();
      const overlayDiv = document.getElementById('popup-overlay');
      if(overlayDiv) {
        overlayDiv.classList.add('active');
        overlayDiv.style.display = 'flex';
      }
      // Disable SP tab and default to Remote Files when not running inside SharePoint
      const spTab = document.getElementById('tab-sharepoint');
      const spWrapper = document.getElementById('tab-sharepoint-wrapper');
      if (spTab) {
        if (!DataLaVistaState.isSpSite) {
          spTab.classList.add('disabled');
          if (spWrapper) dlvTooltip.attach(spWrapper, 'Only available when running inside SharePoint', { placement: 'top', delay: 200 });
          // Activate Remote Files tab instead
          const remoteTab = document.querySelector('.source-tab[data-src="remote"]');
          if (remoteTab) switchSourceTab(remoteTab, 'remote');
        } else {
          spTab.classList.remove('disabled');
          if (spWrapper) dlvTooltip.detach(spWrapper);
        }
      }
    }
    function hideConnectPopup() {
      const overlayDiv = document.getElementById('popup-overlay');
      overlayDiv.classList.remove('active');
      overlayDiv.style.display = 'none';
    }
    function showLoadingPopup(overlayMessage = 'DataLaVista: Loading...') {
      const overlayDiv = document.getElementById('dlv-report-loading-overlay');
      const overlayText = document.getElementById('dlv-report-loading-text');
      if(overlayDiv) {
        overlayDiv.classList.add('active');
        overlayDiv.style.display = 'flex';
        if(overlayText) overlayText.textContent = overlayMessage;
      }
    }
    function hideLoadingPopup() {
      const overlayDiv = document.getElementById('dlv-report-loading-overlay');
      const overlayText = document.getElementById('dlv-report-loading-text');
      if (overlayDiv) {
        overlayDiv.classList.remove('active');
        overlayDiv.style.display = 'none';
        if(overlayText) overlayText.textContent = '';
      }
    }

    function switchSourceTab(el, src) {
      if (el.classList.contains('disabled')) return;
      document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.source-pane').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('src-' + src)?.classList.add('active');
      if (src === 'upload' || src === 'remote') spPickerCheckVisibility();
    }
    

    

/* Handles the Connect / Load button click in the popup.
   Initiates the connection/loading process based on the active tab
   (SharePoint, JSON, CSV, or Load Config). Shows progress and
   status messages, and handles errors gracefully with user feedback. */
async function doConnect() {
  const activeTab = document.querySelector('.source-tab.active')?.dataset?.src || 'sharepoint';
  const btn = document.getElementById('btn-do-connect');
  const prog = document.getElementById('popup-progress');
  const progText = document.getElementById('popup-progress-text');
  btn.disabled = true;
  prog.classList.remove('hidden');
  let dsName = '';

  // Process connection based on active tab
  try {
    if (activeTab === 'sharepoint') {
      /* SharePoint Tab */
      const siteUrl = (document.getElementById('sp-url')?.value || '').trim().replace(/\/$/, '');
      if (!siteUrl) {
        throw new Error('Invalid SharePoint URL.');
      }
      const fileName = siteUrl.split('/').pop().replace(/\.[^/.]+$/, ""); // Use last segment of URL as default name, without file extension
      const rawDsName = (document.getElementById('sp-ds-name')?.value || fileName || '').trim();
      dsName = generateDataSourceName('sharepoint', rawDsName);
      progText.textContent = 'Fetching list inventory...';
      await loadSharePointListsSource(siteUrl, dsName, document.getElementById('sp-auth')?.value || 'current', document.getElementById('sp-token')?.value || '', '');

    } else if (activeTab === 'upload') {
      /* Upload Files Tab */
      progText.textContent = 'Loading uploaded files...';
      await processConnectQueue('upload');

    } else if (activeTab === 'remote') {
      /* Remote Files Tab */
      progText.textContent = 'Loading remote files...';
      await processConnectQueue('remote');

    } else if (activeTab === 'loadconfig') {
      /* Open Dashboard Tab */
      // Check for FILE UPLOAD FIRST
      const fileInput = document.getElementById('config-file');
      const configUrl = (document.getElementById('config-url')?.value || '').trim();
      const jsonText = (document.getElementById('config-json-input')?.value || '').trim();
      
      let parsed;
      
      // Priority: file upload > URL > textarea
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        progText.textContent = 'Reading uploaded config file...';
        const file = fileInput.files[0];
        const text = await file.text();
        parsed = safeJSONParse(text, 'Config');
        if (!parsed) throw new Error('Invalid JSON in uploaded file');
        fileInput.value = ''; // Clear the input
        
      } else if (configUrl) {
        progText.textContent = 'Fetching config from URL...';
        const json = await fetchJSONWithFallbacks(configUrl);
        parsed = json;
        
      } else if (jsonText) {
        progText.textContent = 'Parsing config JSON...';
        parsed = safeJSONParse(jsonText, 'Config');
        if (!parsed) throw new Error('Invalid JSON in textarea'); 
    } else {
      throw new Error('Please provide a dashboard URL, upload a file, or paste a JSON configuration.');
    }
  
    progText.textContent = 'Loading dashboard...';
    await loadConfig(parsed);
    // If loaded from a URL, pre-fill reportUrl and show the published URL (same as ?report= param loading)
    if (configUrl) {
      DataLaVistaState.reportUrl = configUrl;
      const configUrlEl = document.getElementById('config-url');
      if (configUrlEl) configUrlEl.value = configUrl;
      if (DataLaVistaState.isSpSite && DataLaVistaState.spSiteUrl) {
        const spBase = DataLaVistaState.spSiteUrl.substring(0, DataLaVistaState.spSiteUrl.lastIndexOf('/') + 1);
        if (spBase && configUrl.startsWith(spBase)) {
          const dlvUrl = new URL(window.location.href);
          const publishedUrl = dlvUrl.origin + dlvUrl.pathname + '?report=' + encodeURIComponent(configUrl);
          _showPublishResult(publishedUrl);
        }
      }
    }
}

    // Post successful connection popup cleanup and UI updates
    updateConnectButton();
    document.getElementById('btn-save-config').disabled = false;
    hideConnectPopup();

  } catch (err) {
    console.error(err);
    toast('Unable to connect or load: ' + err.message, 'error');
    setStatus('Unable to connect or load: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    progText.textContent = '';
    prog.classList.add('hidden');
  }
}



// ============================================================
// STATE HELPERS
// ============================================================

/**
 * Write new state for a table, preserving any user-assigned alias from the
 * existing state so that re-connecting to the same source does not clobber
 * a name the user has already customised.
 * @param {string} tableKey
 * @param {object} newState
 */
function setTableState(tableKey, newState) {
  const prevAlias = DataLaVistaState.tables[tableKey]?.alias;
  DataLaVistaState.tables[tableKey] = prevAlias ? { ...newState, alias: prevAlias } : newState;
}

// ============================================================
// UPLOAD / REMOTE QUEUE HANDLERS
// ============================================================

/**
 * Trigger a file picker for re-uploading an existing file-based data source.
 * On file selection, processes it as a replacement (preserving aliases).
 * @param {string} dsName - the data source to replace
 */
function triggerFileReupload(dsName) {
  const ds = DataLaVistaState.dataSources[dsName];
  if (!ds) return;

  const extMap = { csv: '.csv', json: '.json', xlsx: '.xlsx,.xls', xml: '.xml', sqlite: '.sqlite,.db', db: '.sqlite,.db' };
  const accept = extMap[ds.type] || '*';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    document.body.removeChild(input);
    if (!file) return;

    showLoadingPopup('Refreshing data source...');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const type = ['xlsx','xls'].includes(ext) ? 'xlsx' : (ext === 'db' ? 'sqlite' : ext);
      ConnectQueue.addUploadedFile(file, type, dsName);
      await processConnectQueue('upload');
      renderFieldsPanel();
      setupCodeMirror();
      toast(`Refreshed "${dsName}" from ${file.name}`, 'success');
    } catch (err) {
      toast('Refresh failed: ' + err.message, 'error');
    } finally {
      hideLoadingPopup();
    }
  });

  input.click();
}

/** Called when files are chosen via the Upload Files tab file picker. */
function handleUploadFiles() {
  const input = document.getElementById('upload-file-input');
  if (!input || !input.files || !input.files.length) {
    toast('Please select files to upload', 'warning');
    return;
  }
  
  const fileCount = input.files.length;
  
  Array.from(input.files).forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    const type = ['xlsx','xls'].includes(ext) ? 'xlsx' : ext;
    
    if (!['csv','json','xlsx','xml','sqlite','db'].includes(type)) {
      toast(`Unsupported file type: .${ext}`, 'warning');
      return;
    }
    
    const rawDsName = (document.getElementById('upload-ds-name')?.value || '').trim();
    const dsName = generateDataSourceName(type, rawDsName || file.name.replace(/\.[^/.]+$/, ''));
    ConnectQueue.addUploadedFile(file, type, dsName);
  });
  
  input.value = ''; // Clear the input
  toast(`Added ${fileCount} file(s) to queue`, 'success');
}

/** Called when the Add button is clicked on the Remote Files tab. */
function handleAddRemoteUrl() {
  const urlEl = /** @type {HTMLInputElement|null} */ (document.getElementById('remote-url'));
  if (!urlEl) return;
  const url = urlEl.value.trim();
  if (!url) { toast('Please enter a URL', 'warning'); return; }
  try { validateURL(url); } catch(e) { toast(e.message, 'error'); return; }
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const type = ['xlsx','xls'].includes(ext) ? 'xlsx'
             : ['csv','json','xml','sqlite','db'].includes(ext) ? ext
             : 'json';
  // Normalize db/sqlite3 to 'sqlite'
  const normalizedType = ['db', 'sqlite3'].includes(type) ? 'sqlite' : type;
  const fname = url.split('/').pop().replace(/\?.*$/, '').replace(/\.[^/.]+$/, '');
  const rawDsName = (/** @type {HTMLInputElement|null} */ (document.getElementById('remote-ds-name'))?.value || '').trim();
  const dsName = generateDataSourceName(normalizedType, rawDsName || fname);
  ConnectQueue.addRemoteUrl(url, normalizedType, dsName);  // ← Use normalizedType
  urlEl.value = '';
}

/** Process all queued uploads or remote URLs. Throws if nothing is queued.
 * @param {'upload'|'remote'} mode */
async function processConnectQueue(mode) {
  if (mode === 'upload') {
    if (!ConnectQueue.uploadedFiles.length) {
      throw new Error('No files queued. Please add files before clicking Connect & Load.');
    }
    
    let loadedCount = 0;
    let anyFailed = false;
    const loadedDataSources = new Map(); // Group tables by data source

    for (const item of ConnectQueue.uploadedFiles) {
      item.error = null; // Clear previous error
      try {
        // Load the file and get the result
        const result = await CyberdynePipeline.loadUploadedFile(item.file, item.dsName);

        // Handle SQLite (returns { tables: [...], foreignKeys?, dbName })
        if (result.tables && Array.isArray(result.tables)) {
          // SQLite returns multiple tables
          const dsMetadata = {
            type: 'sqlite',
            fileName: item.file.name,
            isFileUpload: true,
            url: null
          };

          // Detect if same filename was uploaded before — replace existing DS
          const existingEntry = Object.entries(DataLaVistaState.dataSources)
            .find(([, ds]) => ds.isFileUpload && ds.fileName === item.file.name);
          const effectiveDsName = existingEntry ? existingEntry[0] : item.dsName;

          if (existingEntry) {
            CyberdynePipeline.refreshDataSourceTables(effectiveDsName, dsMetadata, result.tables);
          } else {
            CyberdynePipeline.registerDataSource(effectiveDsName, dsMetadata, result.tables, result.foreignKeys);
          }
          loadedCount += result.tables.length;
          
        } else {
          // Single table (CSV, JSON, Excel, XML)
          const dsMetadata = {
            type: result.metadata.sourceType,
            fileName: result.metadata.fileName,
            isFileUpload: true,
            url: null
          };

          // Detect if same filename was uploaded before — replace existing DS
          const existingEntry = Object.entries(DataLaVistaState.dataSources)
            .find(([, ds]) => ds.isFileUpload && ds.fileName === item.file.name);
          const effectiveDsName = existingEntry ? existingEntry[0] : item.dsName;

          // Group tables by effective data source name
          if (!loadedDataSources.has(effectiveDsName)) {
            loadedDataSources.set(effectiveDsName, {
              metadata: dsMetadata,
              tables: [],
              isReplace: !!existingEntry
            });
          }

          loadedDataSources.get(effectiveDsName).tables.push(result);
          loadedCount++;
        }

      } catch (err) {
        item.error = err.message;
        anyFailed = true;
        console.error(`Error loading ${item.file.name}:`, err);
      }
    }

    // Register all successfully grouped data sources
    for (const [dsName, dsData] of loadedDataSources.entries()) {
      if (dsData.isReplace) {
        CyberdynePipeline.refreshDataSourceTables(dsName, dsData.metadata, dsData.tables);
      } else {
        CyberdynePipeline.registerDataSource(dsName, dsData.metadata, dsData.tables);
      }
    }

    // Remove only successful items from queue; keep failed ones visible
    ConnectQueue.uploadedFiles = ConnectQueue.uploadedFiles.filter(item => item.error);
    ConnectQueue.renderUploadQueue();
    renderFieldsPanel();
    setupCodeMirror();

    if (loadedCount > 0) {
      toast(`Loaded ${loadedCount} table(s) from ${loadedDataSources.size} data source(s)`, 'success');
      setStatus(`Loaded ${loadedCount} table(s)`, 'success');
    }
    if (anyFailed) {
      throw new Error('Some files failed to load — see the queue for details.');
    }

  } else if (mode === 'remote') {
    if (!ConnectQueue.remoteUrls.length) {
      throw new Error('No remote URLs queued. Please add URLs before clicking Connect & Load.');
    }

    let loadedCount = 0;
    let anyFailed = false;
    const loadedDataSources = new Map();

    for (const item of ConnectQueue.remoteUrls) {
      item.error = null;
      try {
        // Load the remote file
        const result = await CyberdynePipeline.loadRemoteFile(item.url, item.dsName, item.type);

        // Handle SQLite
        if (result.tables && Array.isArray(result.tables)) {
          const dsMetadata = {
            type: 'sqlite',
            fileName: item.url.split('/').pop(),
            isFileUpload: false,
            url: item.url
          };

          CyberdynePipeline.registerDataSource(item.dsName, dsMetadata, result.tables);
          loadedCount += result.tables.length;

        } else {
          // Single table
          const dsMetadata = {
            type: result.metadata.sourceType,
            fileName: result.metadata.fileName,
            isFileUpload: false,
            url: item.url
          };

          if (!loadedDataSources.has(item.dsName)) {
            loadedDataSources.set(item.dsName, {
              metadata: dsMetadata,
              tables: []
            });
          }

          loadedDataSources.get(item.dsName).tables.push(result);
          loadedCount++;
        }

      } catch (err) {
        item.error = err.message;
        anyFailed = true;
        console.error(`Error loading ${item.url}:`, err);
      }
    }

    // Register all successfully grouped data sources
    for (const [dsName, dsData] of loadedDataSources.entries()) {
      CyberdynePipeline.registerDataSource(dsName, dsData.metadata, dsData.tables);
    }

    // Remove only successful items from queue; keep failed ones visible
    ConnectQueue.remoteUrls = ConnectQueue.remoteUrls.filter(item => item.error);
    ConnectQueue.renderRemoteQueue();
    renderFieldsPanel();
    setupCodeMirror();

    if (loadedCount > 0) {
      toast(`Loaded ${loadedCount} table(s) from ${loadedDataSources.size} remote source(s)`, 'success');
      setStatus(`Loaded ${loadedCount} remote table(s)`, 'success');
    }
    if (anyFailed) {
      throw new Error('Some remote files failed to load — see the queue for details.');
    }
  }
}

// ============================================================
// CONFIGURATION & GUARDS FOR REMOTE FETCHING
// ============================================================
const FETCH_TIMEOUT_MS   = 10_000;
const PROXY_TIMEOUT_MS   = 12_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

// Populate to restrict which origins may be requested.
// Leave empty to allow any valid HTTP/HTTPS URL.
const ALLOWED_ORIGINS = [
  // "https://api.example.com",
];

// ─── URL Validation ───────────────────────────────────────────────────────────

function validateURL(url) {
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("URL must be a non-empty string.");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(
      `Only HTTP/HTTPS is permitted. Got: "${parsed.protocol}"`
    );
  }

  const host = parsed.hostname.toLowerCase();
  const blockedExact    = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
  const blockedPrefixes = [
    "10.", "192.168.", "169.254.",
    "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.",
    "172.28.", "172.29.", "172.30.", "172.31.",
    "fc", "fd", // IPv6 ULA
  ];

  if (
    blockedExact.includes(host) ||
    blockedPrefixes.some((p) => host.startsWith(p))
  ) {
    throw new Error(
      `Requests to private/local addresses are blocked: "${host}"`
    );
  }

  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(parsed.origin)) {
    throw new Error(
      `URL origin "${parsed.origin}" is not in the allowed origins list.`
    );
  }

  return parsed;
}



// ─── Fetch Helper ─────────────────────────────────────────────────────────────
// - AbortController-backed timeout
// - Reads as text first (handles Content-Type mismatches / forced downloads)
// - Hard size cap on both Content-Length header and actual body

async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS, returnText = false) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Fast-fail on Content-Length if available
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      throw new Error(
        `Response too large: ${contentLength} bytes (limit: ${MAX_RESPONSE_BYTES}).`
      );
    }

    // Read as text first — handles Content-Type mismatches and forced downloads
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new Error(
        `Response body too large: ${text.length} bytes (limit: ${MAX_RESPONSE_BYTES}).`
      );
    }

    return returnText ? text : safeJSONParse(text);

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${ms}ms`);
    }
    throw err;
  }
}

    
// - Non-guessable callback name (timestamp + random)
// - settled flag prevents double resolution
// - Always cleans up script tag and window callback
// - Runs safeJSONParse via stringify round-trip to strip pollution keys
function tryJSONP(url) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    let script  = null;
    let settled = false;

    const timeoutId = setTimeout(() => {
      settle(reject, new Error(`JSONP timed out after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (callbackName in window) delete window[callbackName];
      if (script?.parentNode) script.parentNode.removeChild(script);
      script = null;
    };

    // Prevents double-resolution if callback somehow fires more than once
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    window[callbackName] = (data) => {
      try {
        // Stringify then safeJSONParse: deep-copies AND strips pollution keys
        const safe = safeJSONParse(JSON.stringify(data));
        settle(resolve, safe);
      } catch (err) {
        settle(reject, err);
      }
    };

    script = document.createElement("script");
    script.type  = "text/javascript";
    script.async = true;

    const sep  = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${callbackName}`;

    script.onerror = () =>
      settle(
        reject,
        new Error("JSONP script failed to load — server likely does not support JSONP.")
      );

    // document.head is safer than document.body (body may not exist yet)
    (document.head || document.documentElement).appendChild(script);
  });
}

// ============================================================
// SHAREPOINT SOURCE LOADER
// ============================================================
async function loadSharePointListsSource(siteUrl, dsName, newAuth='current', newToken='', description='') {
  setStatus('Loading SharePoint lists from ' + siteUrl + '...', 'loading');

  // dsName is the immutable internal key; alias = user-entered name from connect popup
  if (!DataLaVistaState.dataSources[dsName]) {
    DataLaVistaState.dataSources[dsName] = {
      type: 'sharepoint',
      url: siteUrl,
      siteUrl: siteUrl,
      auth: newAuth || 'current',
      token: newToken || '',
      internalName: dsName,
      alias: dsName,
      description: description || 'SharePoint Lists - ' + siteUrl,
      tables: [],
      isFileUpload: false,
      keepRawData: false
    };
  }

  const lists = await fetchSPLists(siteUrl, dsName);
  let loadedCount = 0;

  // Capture which tables were already fully loaded before refresh, so we can re-fetch them
  const prevLoadedKeys = new Set(
    (DataLaVistaState.dataSources[dsName]?.tables || [])
      .filter(k => DataLaVistaState.tables[k]?.loaded)
  );

  for (const list of lists) {
    try {
      const isDocLib = list.BaseType === 1;
      const fields = await fetchSPFields(siteUrl, list.Id, isDocLib);

      // Strip SharePoint's "List" / "ListItem" suffix from EntityTypeName for cleaner keys
      const rawEntityType = list.EntityTypeName || (list.Title || 'List').replace(/[^A-Za-z0-9_]/g, '');
      const entityTypeName = stripEntityTypeNameSuffix(rawEntityType);

      // tableKey = DSInternalName_EntityTypeName — immutable forever
      const tableKey = dsName + '_' + entityTypeName;

      // Preserve user-renamed field aliases from the existing table state
      const existingFieldAliases = {};
      for (const ef of (DataLaVistaState.tables[tableKey]?.fields || [])) {
        if (ef.alias && ef.internalName) existingFieldAliases[ef.internalName] = ef.alias;
      }

      const fieldMetas = fields
        .filter(f => !shouldSkipField(f))
        .map(f => {
          const fm = buildFieldMeta(f);
          if (existingFieldAliases[fm.internalName]) fm.alias = existingFieldAliases[fm.internalName];
          return fm;
        });

      // User-facing alias: PascalCase of Title (no "List" suffix)
      const tableAlias = toPascalCase(list.Title || entityTypeName);

      // Save the new table state, preserving any user-assigned alias
      setTableState(tableKey, {
        internalName: entityTypeName,
        displayName: list.Title || tableAlias || entityTypeName,
        description: list.Description || '',
        alias: tableAlias,
        dsAlias: dsName,
        fields: fieldMetas,
        //originalFields: fields, // TODO: Commented out to debug synthetic fields not being generated 3/31/26
        data: [],
        loaded: false,
        sourceType: 'sharepoint',
        isDocLib: isDocLib || false,
        guid: list.Id,
        siteUrl: siteUrl,
        itemCount: list.ItemCount || 0,
        dataSource: dsName,
        isFileUpload: false,
        keepRawData: false
      });
      // Register table under data source in state
      if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
        DataLaVistaState.dataSources[dsName].tables.push(tableKey);
      }
      // Register the table in AlaSQL (without data yet)
      registerTableInAlaSQL(tableKey);

      // Register a view for this list so users see/query by the friendly list title
      CyberdynePipeline.registerSharePointList(dsName, tableKey, list.Title || tableAlias, fieldMetas);

      loadedCount++;
    } catch (e) {
      console.warn('[loadSharePointListsSource] Skipped list:', list.Title, e.message);
    }
  }


  // Register lookup-field relationships now that all lists are known
  CyberdynePipeline.registerSpLookupRelationships(dsName);

  // Re-fetch data for tables that were fully loaded before refresh (don't make users re-run queries)
  for (const tableKey of prevLoadedKeys) {
    if (DataLaVistaState.tables[tableKey]) {
      fetchTableData(tableKey, true).catch(e => console.warn('[loadSharePointListsSource] Re-fetch failed:', tableKey, e.message));
    }
  }

  if(DataLaVistaState.reportMode !== 'view') {
    setStatus(`Loaded ${loadedCount} lists from SharePoint (${dsName})`, 'success');
    renderFieldsPanel();
    setupCodeMirror();
    toast(`Connected to SharePoint as "${dsName}" — ${loadedCount} lists`, 'success');
  }
}

// ============================================================
// DATA SOURCE LOADER
// ============================================================

// Fetch JSON from a URL trying multiple strategies.
// Skips external proxies if the URL is on the same host as the current page,
// on the same SharePoint tenant/site, or otherwise same-origin — proxies
// cannot authenticate to internal servers and must not receive private data.
async function fetchJSONWithFallbacks(url) {
  if (window.location.protocol === 'file:') {
    throw new Error(
      'Cannot fetch external URLs when running from a local file. ' +
      'Open the page from a web server instead (e.g. a local server, or host it on SharePoint).'
    );
  }

  const encodedUrl = encodeURIComponent(url);

  const isSameOrigin = (() => {
    try {
      const target = new URL(url);
      if (target.origin === window.location.origin) return true;
      if (target.hostname === window.location.hostname) return true;
      const spSite = typeof getSpSiteUrl === 'function' && getSpSiteUrl();
      if (spSite) {
        if (url.startsWith(spSite)) return true;
        try { if (new URL(spSite).origin === target.origin) return true; } catch(_) {}
      }
    } catch (e) {}
    return false;
  })();

  const strategies = [
    { name: 'CORS',        fn: () => fetchWithTimeout(url, { mode: 'cors' }, FETCH_TIMEOUT_MS) },
    { name: 'Credentials', fn: () => fetchWithTimeout(url, { mode: 'cors', credentials: 'include' }, FETCH_TIMEOUT_MS) },
    ...(!isSameOrigin ? [
      { name: 'JSONP',       fn: () => tryJSONP(url) },
      { name: 'CORSProxy.io',fn: () => fetchWithTimeout(`https://corsproxy.io/?url=${encodedUrl}`, { mode: 'cors' }, PROXY_TIMEOUT_MS) },
      { name: 'AllOrigins',  fn: () => fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodedUrl}`, { mode: 'cors' }, PROXY_TIMEOUT_MS) },
      { name: 'Thingproxy',  fn: () => fetchWithTimeout(`https://thingproxy.freeboard.io/fetch/${url}`, { mode: 'cors' }, PROXY_TIMEOUT_MS) },
    ] : []),
  ];

  const errors = {};
  for (const s of strategies) {
    try {
      const result = await s.fn();
      return result;
    } catch (err) {
      errors[s.name] = err.message;
    }
  }

  const summary = Object.entries(errors).map(([k, v]) => `  [${k}] ${v}`).join('\n');
  throw new Error('Unable to fetch file. Check the URL and try again.');
}

// Fetch raw CSV text from a URL trying multiple strategies.
// Skips external proxies for same-host, same-origin, and SharePoint tenant URLs (privacy).
async function fetchCSVWithFallbacks(url) {
  const encodedUrl = encodeURIComponent(url);

  const isSameOrigin = (() => {
    try {
      const target = new URL(url);
      if (target.origin === window.location.origin) return true;
      if (target.hostname === window.location.hostname) return true;
      const spSite = typeof getSpSiteUrl === 'function' && getSpSiteUrl();
      if (spSite) {
        if (url.startsWith(spSite)) return true;
        try { if (new URL(spSite).origin === target.origin) return true; } catch(_) {}
      }
    } catch (e) {}
    return false;
  })();

  const strategies = [
    { name: 'CORS',        fn: () => fetchWithTimeout(url, { mode: 'cors' }, FETCH_TIMEOUT_MS, true) },
    { name: 'Credentials', fn: () => fetchWithTimeout(url, { mode: 'cors', credentials: 'include' }, FETCH_TIMEOUT_MS, true) },
    ...(!isSameOrigin ? [
      { name: 'CORSProxy.io', fn: () => fetchWithTimeout(`https://corsproxy.io/?url=${encodedUrl}`, { mode: 'cors' }, PROXY_TIMEOUT_MS, true) },
      { name: 'AllOrigins',   fn: () => fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodedUrl}`, { mode: 'cors' }, PROXY_TIMEOUT_MS, true) },
      { name: 'Thingproxy',   fn: () => fetchWithTimeout(`https://thingproxy.freeboard.io/fetch/${url}`, { mode: 'cors' }, PROXY_TIMEOUT_MS, true) },
    ] : []),
  ];

  const errors = {};
  for (const s of strategies) {
    try {
      const text = await s.fn();
      return text;
    } catch (err) {
      errors[s.name] = err.message;
      console.warn(`[fetchCSVWithFallbacks] ${s.name} failed:`, err.message);
    }
  }

  const summary = Object.entries(errors).map(([k, v]) => `  [${k}] ${v}`).join('\n');
  console.warn('[fetchCSVWithFallbacks] All strategies failed:', summary);
  throw new Error('Unable to fetch file. Check the URL and try again.');
}

// Load JSON from URL with multiple strategies and robust error handling
async function loadJSONSource(url, dsName) {
  // Validate before any network activity
  validateURL(url);

  const json = await fetchJSONWithFallbacks(url);

  // ── Data Normalization & State ─────────────────────────────────────────────
  // Preserved exactly from your original application logic.

  const rows = extractRows(json);
  if (!rows.length) {
    throw new Error(
      "No data found in JSON response — the response was empty or in an unexpected format"
    );
  }

  const first  = rows[0];
  const fields = Object.keys(first).map((k) => {
    const val = first[k];
    let type  = "text";
    if (typeof val === "number")                               type = "number";
    else if (typeof val === "boolean")                         type = "boolean";
    else if (typeof val === "string" && ISO_DATE_RE.test(val)) type = "date";
    return {
      internalName: k,
      displayName:  k,
      alias:        toPascalCase(k) || k,
      type,
      displayType:  type,
    };
  });

  const normalizedRows = rows.map((r) => {
    const out = {};
    for (const f of fields) {
      let v = r[f.internalName];
      if (f.type === "date")                            v = normalizeDate(v);
      else if (typeof v === "object" && v !== null)     v = normalizeObject(v);
      out[f.alias] = v;
    }
    return out;
  });

  const tableKey = dsName + '_Data'; // TODO: where is ds created for JSON url downloads?

  // Register data source
  if (!DataLaVistaState.dataSources[dsName]) {
    DataLaVistaState.dataSources[dsName] = {
      alias: dsName,
      auth: null,
      description: '',
      internalName: dsName, // TODO: was dsname already generated/processed with alias?
      type: 'json',
      tables: [],
      token: '',
      url: url,
      siteUrl: null,
      isFileUpload: false,
      keepRawData: false
    };
  }

  setTableState(tableKey, {
    displayName: 'Data',
    alias: 'Data',
    dsAlias: dsName,
    fields,
    data: normalizedRows,
    loaded: true,
    sourceType: 'json',
    dataSource: dsName,
    isFileUpload: false,
    keepRawData: false,
    siteUrl: null,
    url: url,
    itemCount: normalizedRows.length || 0
  });

  if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
    DataLaVistaState.dataSources[dsName].tables.push(tableKey);
  }

  setStatus(`Loaded ${normalizedRows.length} rows from JSON`, 'success');
  renderFieldsPanel();
  setupCodeMirror();
}

/** Load JSON from already-parsed text (e.g. local file upload).
 *  Applies the same normalization as loadJSONSource without a network fetch.
 */
function loadJSONData(dsName, fileName, fileUrl, isFileUpload, text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    toast('JSON parse error: ' + e.message, 'error');
    return;
  }

  const rows = extractRows(json);
  if (!rows.length) {
    toast('No data found in JSON — the file was empty or in an unexpected format', 'error');
    return;
  }

  const first = rows[0];
  const fields = Object.keys(first).map((k) => {
    const val = first[k];
    let type = 'text';
    if (typeof val === 'number')                               type = 'number';
    else if (typeof val === 'boolean')                         type = 'boolean';
    else if (typeof val === 'string' && ISO_DATE_RE.test(val)) type = 'date';
    return {
      internalName: k,
      displayName:  k,
      alias:        toPascalCase(k) || k,
      type,
      displayType:  type,
    };
  });

  const normalizedRows = rows.map((r) => {
    const out = {};
    for (const f of fields) {
      let v = r[f.internalName];
      if (f.type === 'date')                        v = normalizeDate(v);
      else if (typeof v === 'object' && v !== null) v = normalizeObject(v);
      out[f.alias] = v;
    }
    return out;
  });

  const tableKey = (dsName + '_Data').replace(/[^A-Za-z0-9_]/g, '_').replace('__', '_');

  if (!DataLaVistaState.dataSources[dsName]) {
    DataLaVistaState.dataSources[dsName] = {
      alias: dsName,
      auth: null,
      description: 'This JSON file (' + (fileName || dsName + '.json') + ') was uploaded manually, and only the dashboard creator can refresh it.',
      internalName: dsName,
      type: 'json',
      tables: [],
      token: '',
      fileName: fileName || '',
      isFileUpload: isFileUpload,
      url: fileUrl || fileName || dsName + '.json',
      siteUrl: null,
      keepRawData: isFileUpload ? true : false
    };
  }

  setTableState(tableKey, {
    displayName: 'Data',
    alias: 'Data',
    dsAlias: dsName,
    fields,
    data: normalizedRows,
    loaded: true,
    sourceType: 'json',
    dataSource: dsName,
    isFileUpload: isFileUpload,
    keepRawData: isFileUpload ? true : false,
    siteUrl: null,
    url: fileUrl || fileName || dsName + '.json',
    itemCount: normalizedRows.length
  });

  if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
    DataLaVistaState.dataSources[dsName].tables.push(tableKey);
  }

  setStatus(`Loaded ${normalizedRows.length} rows from JSON`, 'success');
  if (DataLaVistaState.reportMode === 'edit') {
    renderFieldsPanel();
    setupCodeMirror();
  }
  toast(`Loaded ${normalizedRows.length} rows from JSON as "${dsName}"`, 'success');
}

// Fetch CSV text with error handling
async function fetchCSVFromURL(url) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const text = await res.text();
        if (!text.trim()) throw new Error('CSV file appears to be empty');
        return text; // Return raw text; parsing is handled separately in loadCSVData()
      } catch (err) {
        console.error('Failed to download CSV: ', err);
        throw new Error('Failed to download CSV: ' + err.message);
      }
    }

// Load CSV from URL — tries alasql's built-in fetch first, falls back to fetchCSVFromURL + loadCSVData
async function loadCSVSource(url, dsName, fileName) {
  validateURL(url);

  // Strategy 1: alasql built-in CSV fetch+parse
  try {
    let rows;
    try { rows = await alasql.promise('SELECT * FROM CSV("' + url + '", {headers:true, columnTypes:true})'); }
    catch (e) {
      try { rows = await alasql.promise('SELECT * FROM CSV("' + url + '", {headers:false, columnTypes:true})'); }
      catch (e2) { rows = await alasql.promise('SELECT * FROM CSV("' + url + '")'); }
    }
    if (rows && rows.length > 0) {
      
      // alasql returns parsed row objects — register directly, skipping text parsing      
      const headers = Object.keys(rows[0]);
      const tableKey = (dsName + '_Data').replace(/[^A-Za-z0-9_]/g, '_').replace('__', '_');
      let fields;
      try{
        fields = await deriveStructureFromSample(rows);
      }
      catch(e) {
        console.warn('[DLV CSV] deriveStructureFromSample failed, falling back to basic text fields. ', e.message);
        fields = headers.map(h => ({
          internalName: h.replace(/[^A-Za-z0-9_]/g, '_').replace('__', '_'),
          displayName: toPascalCase(h) || h,
          alias: toPascalCase(h) || h,
          type: 'text',
          displayType: 'text'
        }));
      }

      if (!DataLaVistaState.dataSources[dsName]) {
        DataLaVistaState.dataSources[dsName] = {
          alias: 'Data', auth: null,
          description: 'This CSV file (' + (fileName || dsName + '.csv') + ') was loaded from a URL.',
          internalName: dsName, tables: [], token: null, type: 'csv',
          fileName: fileName || '', isFileUpload: false,
          url: url, keepRawData: false
        };
      }
      setTableState(tableKey, {
        alias: tableKey, data: rows, dataSource: dsName,
        description: 'This table was created from a CSV file (' + (fileName || dsName + '.csv') + ').',
        displayName: 'Data',
        dsAlias: dsName,
        fields: fields,
        internalName: tableKey, itemCount: rows.length,
        siteUrl: null, url: url, loaded: true,
        sourceType: 'csv', isFileUpload: false, keepRawData: false
      });
      if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) DataLaVistaState.dataSources[dsName].tables.push(tableKey);
      setStatus(`Loaded ${rows.length} rows from CSV`, 'success');
      if (DataLaVistaState.reportMode === 'edit') { renderFieldsPanel(); setupCodeMirror(); }
      toast(`Loaded ${rows.length} rows from CSV as "${dsName}"`, 'success');
      return;
    }
    console.warn('[DLV CSV] alasql returned empty result, falling back');
  } catch (e) {
    console.warn('[DLV CSV] alasql strategy failed, falling back. ', e.message);
  }

  // Strategy 2: multi-strategy fetch + loadCSVData
  const text = await fetchCSVWithFallbacks(url);
  if (!text.trim()) throw new Error('CSV file is empty.');
  loadCSVData(dsName || 'CSV', '', fileName, url, false, text);
}

// Simple CSV parser and loader
function loadCSVData(dsName, tableKey = '', fileName = '', fileUrl = '', isFileUpload = false, text = '') {
  let parsed;
  try {
    parsed = parseCSV(text);
  } catch (e) {
    console.error('[DLV CSV] parseCSV threw:', e);
    toast('CSV parse error: ' + e.message, 'error');
    return;
  }
  const { headers, rows } = parsed;
  if (!headers.length) {
    console.warn('No headers found in CSV');
    toast('CSV appears to have no header row', 'error');
    return;
  }
  const fields = headers.map(h => ({
    internalName: h.replace(/[^A-Za-z0-9_]/g, '_').replace('__','_'),
    displayName: toPascalCase(h) || h,
    alias: toPascalCase(h) || h,
    type: 'text',
    displayType: 'text'
  }));

  if(!tableKey) tableKey = (dsName + '_Data').replace(/[^A-Za-z0-9_]/g, '_').replace('__','_'); // Ensure tableKey is a valid identifier

// Register data source
  if (!DataLaVistaState.dataSources[dsName]) { 
    DataLaVistaState.dataSources[dsName] = {
      alias: 'Data',
      auth: null,
      description: 'This CSV file (' + (fileName || dsName + '.csv') + ') was uploaded manually, and only the dashboard creator can refresh it.',
      internalName: dsName,
      tables: [],
      token: null,
      type: 'csv',
      fileName: fileName || '',
      isFileUpload: isFileUpload, // true if uploaded from local file picker; false if loaded from URL
      url: fileUrl || fileName || dsName + '.csv',
      keepRawData: (isFileUpload) ? true : false // if loaded from file, keep raw data
    };
  }

  setTableState(tableKey, {
    alias: tableKey,
    data: rows || [],
    dataSource: dsName,
    description: 'This table was created from a CSV file (' + (fileName || dsName + '.csv') + ').',
    displayName: 'Data',
    dsAlias: dsName,
    fields: Array.isArray(headers) && headers.length ? fields : [{ internalName: 'Column1', displayName: 'Column1', alias: 'Column1', type: 'text', displayType: 'text' }],
    internalName: tableKey,
    itemCount: rows.length || 0,
    siteUrl: null,
    url: fileUrl || fileName || dsName + '.csv',
    loaded: true,
    sourceType: 'csv',
    isFileUpload: isFileUpload,
    keepRawData: (isFileUpload) ? true : false
  });

  if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
    DataLaVistaState.dataSources[dsName].tables.push(tableKey);
  }

  setStatus(`Loaded ${rows.length} rows from CSV`, 'success');
  if(DataLaVistaState.reportMode === 'edit') {
    renderFieldsPanel();
    setupCodeMirror();
  }
  toast(`Loaded ${rows.length} rows from CSV as "${dsName}"`, 'success');
}

// Fetch items for a table and cache them
async function ensureTableData(tableName, allRows = true) {
  // MUST RETURN THIS PROMISE so await ensureTableData() actually waits!
  return fetchTableData(tableName, allRows);
}
  
