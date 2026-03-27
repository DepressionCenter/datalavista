/* ============================================================
This file is part of DataLaVista
05-data-sources.js: Data source connection popup, remote fetch guards, and source loaders.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
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
    // POPUP LOGIC
    // ============================================================
    function showConnectPopup() {
      ensureInit();
      const overlayDiv = document.getElementById('popup-overlay');
      if(overlayDiv) {
        overlayDiv.classList.add('active');
        overlayDiv.style.display = 'flex';
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
      document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.source-pane').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('src-' + src).classList.add('active');
      if (src === 'csv') spPickerCheckVisibility();
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

    } else if (activeTab === 'json') {
      /* JSON Tab */
      const siteUrl = (document.getElementById('json-url')?.value || '').trim();
      if (!siteUrl) {
        throw new Error('Invalid JSON URL.');
      }
      // Use last segment of URL as default name, without file extension
      const fileName = siteUrl.split('/').pop().replace(/\.[^/.]+$/, "");
      const rawDsName = (fileName || '').trim();
      const dsName = generateDataSourceName('json', rawDsName);
      progText.textContent = 'Loading JSON...';
      await loadJSONSource(siteUrl, dsName);

    } else if (activeTab === 'csv') {
      /* CSV Tab */
      // Handles CSV URLs only.
      // File uploads are handled separately in spPickerCheckVisibility() → handleFileUpload().
      const siteUrl = (document.getElementById('csv-url')?.value || '').trim();
      if (!siteUrl) {
        throw new Error('Invalid CSV URL.');
      }
      // Use last segment of URL as default name, without file extension
      const fileName = siteUrl.split('/').pop().replace(/\.[^/.]+$/, "");
      const rawDsName = (fileName || '').trim();
      const dsName = generateDataSourceName('csv', rawDsName);
      progText.textContent = 'Loading CSV...';
      await loadCSVSource(siteUrl, dsName);
      
    } else if (activeTab === 'loadconfig') {
      /* Open Dashboard Tab */
      const configUrl = ((/** @type {HTMLInputElement|null} */ (document.getElementById('config-url')))?.value || '').trim();
      const jsonText = ((/** @type {HTMLTextAreaElement|null} */ (document.getElementById('config-json-input')))?.value || '').trim();
      if (!configUrl && !jsonText) {
        throw new Error('Please provide a dashboard URL, upload a file, or paste a JSON configuration.');
      }
      progText.textContent = 'Loading dashboard...';
      let parsed;
      if (configUrl) {
        const json = await fetchJSONWithFallbacks(configUrl);
        parsed = json;
      } else {
        parsed = safeJSONParse(jsonText, 'Config');
      }
      if (!parsed) return;
      await loadConfig(parsed);
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
  setStatus('⏳ Loading SharePoint lists from ' + siteUrl + '...');

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

  for (const list of lists) {
    try {
      const isDocLib = list.BaseType === 1;
      const fields = await fetchSPFields(siteUrl, list.Id, isDocLib);
      const fieldMetas = fields
        .filter(f => !shouldSkipField(f))
        .map(f => buildFieldMeta(f));

      // Strip SharePoint's "List" / "ListItem" suffix from EntityTypeName for cleaner keys
      const rawEntityType = list.EntityTypeName || (list.Title || 'List').replace(/[^A-Za-z0-9_]/g, '');
      const entityTypeName = stripEntityTypeNameSuffix(rawEntityType);

      // tableKey = DSInternalName_EntityTypeName — immutable forever
      const tableKey = dsName + '_' + entityTypeName;
      // User-facing alias: PascalCase of Title (no "List" suffix)
      const tableAlias = toPascalCase(list.Title || entityTypeName);

      DataLaVistaState.tables[tableKey] = {
        internalName: entityTypeName,
        displayName: list.Title || tableAlias || entityTypeName,
        description: list.Description || '',
        alias: tableAlias,
        dsAlias: dsName,
        fields: fieldMetas,
        originalFields: fields,
        data: [],
        loaded: false,
        sourceType: 'sharepoint',
        isDocLib,
        guid: list.Id,
        siteUrl: siteUrl,
        itemCount: list.ItemCount || 0,
        dataSource: dsName,
        isFileUpload: false,
        keepRawData: false
      };

      if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
        DataLaVistaState.dataSources[dsName].tables.push(tableKey);
      }
      loadedCount++;
    } catch (e) {
      console.warn('[loadSharePointListsSource] Skipped list:', list.Title, e.message);
    }
  }
  

  if(DataLaVistaState.reportMode !== 'view') {
    setStatus(`✅ Loaded ${loadedCount} lists from SharePoint (${dsName})`);
    renderFieldsPanel();
    setupCodeMirror();
    toast(`Connected to SharePoint as "${dsName}" — ${loadedCount} lists`, 'success');
  }
}

// ============================================================
// DATA SOURCE LOADER
// ============================================================

// Fetch JSON from a URL trying multiple strategies.
// Skips external proxies if the URL is on the same site as the current page
// (or the detected SharePoint site), since proxies can't authenticate there.
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
      const spSite = typeof getSpSiteUrl === 'function' && getSpSiteUrl();
      if (spSite && url.startsWith(spSite)) return true;
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
      console.info(`[fetchJSONWithFallbacks] ✅ succeeded via: ${s.name} (${isSameOrigin ? 'same-origin' : 'cross-origin'})`);
      return result;
    } catch (err) {
      errors[s.name] = err.message;
      console.warn(`[fetchJSONWithFallbacks] ${s.name} failed:`, err.message);
    }
  }

  const summary = Object.entries(errors).map(([k, v]) => `  [${k}] ${v}`).join('\n');
  throw new Error(`All fetch strategies failed for "${url}":\n${summary}`);
}

// Fetch raw CSV text from a URL trying multiple strategies.
async function fetchCSVWithFallbacks(url) {
  const encodedUrl = encodeURIComponent(url);

  const isSameOrigin = (() => {
    try {
      const target = new URL(url);
      if (target.origin === window.location.origin) return true;
      const spSite = typeof getSpSiteUrl === 'function' && getSpSiteUrl();
      if (spSite && url.startsWith(spSite)) return true;
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
      console.info(`[fetchCSVWithFallbacks] ✅ succeeded via: ${s.name} (${isSameOrigin ? 'same-origin' : 'cross-origin'})`);
      return text;
    } catch (err) {
      errors[s.name] = err.message;
      console.warn(`[fetchCSVWithFallbacks] ${s.name} failed:`, err.message);
    }
  }

  const summary = Object.entries(errors).map(([k, v]) => `  [${k}] ${v}`).join('\n');
  throw new Error(`All CSV fetch strategies failed for "${url}":\n${summary}`);
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

  DataLaVistaState.tables[tableKey] = {
    displayName: 'Data',
    alias: 'Data',
    dsAlias: dsName,
    fields,
    data: normalizedRows,
    loaded: true,
    sourceType: 'json',
    dataSource: dsName,
    dsAlias: dsName,
    isFileUpload: false,
    keepRawData: false,
    siteUrl: null,
    url: url,
    itemCount: normalizedRows.length || 0
  };

  if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
    DataLaVistaState.dataSources[dsName].tables.push(tableKey);
  }

  setStatus(`✅ Loaded ${normalizedRows.length} rows from JSON`);
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

  DataLaVistaState.tables[tableKey] = {
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
  };

  if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
    DataLaVistaState.dataSources[dsName].tables.push(tableKey);
  }

  setStatus(`✅ Loaded ${normalizedRows.length} rows from JSON`);
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
      DataLaVistaState.tables[tableKey] = {
        alias: tableKey, data: rows, dataSource: dsName,
        description: 'This table was created from a CSV file (' + (fileName || dsName + '.csv') + ').',
        displayName: 'Data',
        dsAlias: dsName,
        fields: fields,
        internalName: tableKey, itemCount: rows.length,
        siteUrl: null, url: url, loaded: true,
        sourceType: 'csv', isFileUpload: false, keepRawData: false
      };
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

  DataLaVistaState.tables[tableKey] = {
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
    isFileUpload: isFileUpload, // true if uploaded from local file picker; false if loaded from URL
    keepRawData: (isFileUpload) ? true : false // if loaded from file, keep raw data
  };

  if (!DataLaVistaState.dataSources[dsName].tables.includes(tableKey)) {
    DataLaVistaState.dataSources[dsName].tables.push(tableKey);
  }

  setStatus(`✅ Loaded ${rows.length} rows from CSV`);
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
  
