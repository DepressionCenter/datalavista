/* ============================================================
This file is part of DataLaVista
03-sharepoint.js: SharePoint REST API adapter and field structure loader.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
Summary: SharePoint REST API adapter and field structure loader.
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
    // SHAREPOINT REST API ADAPTER
    // ============================================================
    // Rule 1: Use application/json instead of verbose
    async function spFetch(url, dsName) {
      const headers = { 'Accept': 'application/json' };
      if (DataLaVistaState.dataSources[dsName] && DataLaVistaState.dataSources[dsName].auth === 'token' && DataLaVistaState.dataSources[dsName].token) {
        headers['Authorization'] = 'Bearer ' + DataLaVistaState.dataSources[dsName].token;
      }
      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) {
        // Will be caught by the retry logic later
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText} — ${url}`);
      }
      return res.json();
    }

    // ── Data Source Name Helpers ─────────────────────────────────────────────────

    /** Normalize a user-supplied data source name: alphanumeric only, max 6 chars. */
    function normalizeDataSourceName(raw) {
      return (raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
    }

    /**
     * Generate a unique data source name for a given type.
     * Defaults: sharepoint→SP, json→JSON, csv→CSV, others→Table.
     * If the base name is taken, appends 1, 2, 3... until unique.
     */
    function generateDataSourceName(type, preferredBase) {
      const bases = { sharepoint: 'SP', json: 'JSON', csv: 'CSV' };
      const base = normalizeDataSourceName(preferredBase) || bases[type] || 'Table';
      const existing = Object.keys(DataLaVistaState.dataSources);
      if (!existing.includes(base)) return base;
      for (let i = 1; i < 100; i++) {
        const candidate = (base + i).slice(0, 6);
        if (!existing.includes(candidate)) return candidate;
      }
      return base + Date.now().toString().slice(-4);
    }

    /** Update the connect button (no max limit — always allow more data). */
    function updateConnectButton() {
      const btn = document.getElementById('btn-connect');
      if (!btn) return;
      const count = Object.keys(DataLaVistaState.dataSources).length;
      btn.innerHTML = count > 0 ? '➕ Get More Data' : '⚡ Connect + Load';
      btn.disabled = false;
    }

    /** Return the data source internal key for a given table key. */
    function getDataSourceForTable(tableKey) {
      for (const [dsName, ds] of Object.entries(DataLaVistaState.dataSources)) {
        if (ds.tables && ds.tables.includes(tableKey)) return dsName;
      }
      return null;
    }

    /**
     * Returns the LIVE SQL-queryable name for a table: DSAlias_TableAlias.
     * This changes when the user renames a DS or table — always call this
     * instead of using the raw tableKey in SQL/AlaSQL.
     */
    function getTableQueryName(tableKey) {
      const t = DataLaVistaState.tables[tableKey];
      if (!t) return tableKey;
      const ds = DataLaVistaState.dataSources[t.dataSource];
      const dsAlias = (ds && ds.alias) || t.dataSource || '';
      const tAlias = t.alias || t.internalName || tableKey;
      return dsAlias ? dsAlias + '_' + tAlias : tAlias; // TODO: Check if this works after renaming a data source
    }

    /** Register a table in AlaSQL under its immutable tableKey only.
     *  SQL always uses the tableKey in FROM (e.g. FROM [SP_PeopleList]).
     *  The alias (e.g. SP_Contacts) is used as a SQL alias in the FROM clause: FROM [SP_PeopleList] [SP_Contacts]
     *  — AlaSQL resolves column refs through that alias without a separate table registration.
     */
    function registerTableInAlaSQL(tableKey) {
      const t = DataLaVistaState.tables[tableKey];
      if (!t || !t.data) return;
      alasql(`DROP TABLE IF EXISTS [${tableKey}]`);
      alasql(`CREATE TABLE [${tableKey}]`); // TODO: store table alises in alasql
      const actual = Object.keys(alasql.tables).find(k => k.toLowerCase() === tableKey.toLowerCase()) || tableKey;
      alasql.tables[actual].data = t.data;
    }

    /** Drop an AlaSQL table by a (possibly old) query name. */
    function dropTableFromAlaSQL(qname) {
      try { alasql(`DROP TABLE IF EXISTS [${qname}]`); } catch(e) {}
    }

    // Universal JSON extractor
    function extractRows(json) {
      if (!json) return [];
      if (Array.isArray(json)) return json;
      if (json.value && Array.isArray(json.value)) return json.value;
      if (json.d) {
        if (Array.isArray(json.d)) return json.d;
        if (json.d.results && Array.isArray(json.d.results)) return json.d.results;
        return [json.d];
      }
      return [json];
    }

    /**
 * Strip OData metadata keys from an array of rows.
 * 
 * @param {Array} rows - Array of data objects
 * @param {boolean} [quickCheck=false] - If true, checks only the first row to decide
 *   whether stripping is needed (efficient for large, uniform item datasets).
 *   If false (default), strips from every row individually (thorough for 
 *   structure/field metadata where rows may have varying key shapes).
 * @returns {Array} The cleaned rows (mutated in place)
 */
function stripODataMetadata(rows, quickCheck = false) {
    if (!rows || !rows.length) return rows;

    const isODataKey = (k) =>
        k === '__metadata' ||
        k.includes('odata.') ||
        k.includes('@odata.') ||
        (k.charAt(0) === '@' && k !== '@odata.nextLink');

    if (quickCheck) {
        // Fast path: if the first row has no OData keys, skip entirely
        const firstRowKeys = Object.keys(rows[0]);
        const hasOData = firstRowKeys.some(isODataKey);
        if (!hasOData) return rows;
    }

    for (let i = 0; i < rows.length; i++) {
        const keys = Object.keys(rows[i]);
        for (let j = 0; j < keys.length; j++) {
            if (isODataKey(keys[j])) {
                delete rows[i][keys[j]];
            }
        }
    }
    return rows;
}

    // Rule 2: Fetch only custom lists
    async function fetchSPLists(siteUrl, dsName) {
      const url = `${siteUrl}/_api/web/lists?$select=Id,EntityTypeName,Title,Description,ItemCount,BaseType,Hidden,ImageUrl,IsApplicationList,LastItemModifiedDate&$filter=(Hidden eq false and IsApplicationList eq false and BaseTemplate ne 115 and BaseTemplate ne 121 and BaseTemplate ne 330 and BaseTemplate ne 544 and Title ne 'MicroFeed' and EntityTypeName ne 'AppCatalog' and EntityTypeName ne 'FormServerTemplates' and EntityTypeName ne 'Style_x0020_Library') or (Title eq 'User Information List' or Title eq 'Events')`;
      const json = await spFetch(url, dsName);
      let rows = extractRows(json);
      rows = stripODataMetadata(rows);
      return rows;
    }

    // Rule 3, 6, 7, 8, 9, 10: Fetch and filter structure
    const EXCLUDED_FIELDS = [
      'ItemChildCount', 'FolderChildCount', 'MetaInfo', 'DocIcon', 'AppAuthor', 'AppEditor', 'Edit', 'ContentType', 'TemplateUrl', 'xd_ProgID', 'xd_Signature', 'HTML_x0020_File_x0020_Type', '_ModerationStatus', '_ModerationComments', 'InstanceID', 'Order', 'GUID', 'WorkflowVersion', 'WorkflowInstanceID', 'ParentVersionString', 'ParentLeafName', 'CheckedOutUserId', 'IsCheckedoutToLocal', 'UniqueId', 'SyncClientId', 'ProgId', 'ScopeId', 'FileRef', 'FileDirRef', 'Last_x0020_Modified', 'Created_x0020_Date', 'FSObjType', 'SortBehavior', 'OriginatorId', 'NoExecute', 'ContentVersion', 'UIVersionString', 'AccessPolicy', '_UIVersionString', 'ParentUniqueId', '_Level', 'IsCurrentVersion', 'ColorTag', '_ColorTag', '_IsRecord', '_LabelAppliedBy', '_LabelSetting', 'ComplianceAssetId', '_ComplianceFlags', '_ComplianceTag', '_ComplianceTagWrittenTime', '_ComplianceTagUserId', 'OData__SysVersion', 'OData__SysFlow', 'OData__SysProfile', '_SysVersion', '_SysFlow', '_SysProfile', 'odata.id', 'odata.etag', 'odata.type', 'odata.link', 'odata.editLink', 'odata.navigationLinkUrl', 'Author@odata.navigationLinkUrl', 'Editor@odata.navigationLinkUrl'
    ];


    async function fetchSPFields(siteUrl, listGuid, isDocLib = false) {
  // Excludes Hidden, Computed, underscore-prefixed, and dependent lookup fields
  const filter = `(Hidden eq false and TypeAsString ne 'Computed' and startswith(InternalName,'_') eq false and (TypeAsString ne 'LookupMulti' or (TypeAsString eq 'LookupMulti' and ReadOnlyField eq false and IsDependentLookup eq false))) or InternalName eq 'Editor' or InternalName eq 'Author' or InternalName eq 'Created' or InternalName eq 'Modified' or InternalName eq 'ID' or InternalName eq 'Title' or InternalName eq 'TaxKeyword'`;
  const select = `Id,InternalName,Title,TypeAsString,Description,Required,MaxLength,Choices,LookupField,LookupList,IsHidden,Hidden,ReadOnlyField,IsDependentLookup`;
  const url = `${siteUrl}/_api/web/lists(guid'${listGuid}')/fields?$select=${select}&$filter=${filter}`;

  const json = await spFetch(url);
  let rows = extractRows(json);
  let fields = stripODataMetadata(rows);

  // EXCLUDE system/metadata fields AND projected lookups (_x003a_)
  fields = fields.filter(f =>
    !EXCLUDED_FIELDS.includes(f.InternalName) &&
    !EXCLUDED_FIELDS.includes(f.Title) &&
    !f.InternalName.includes('_x003a_') &&
    !f.IsDependentLookup
  );

  const mandatory = ['ID', 'Title', 'Created', 'Modified', 'Author', 'Editor'];
  mandatory.forEach(mand => {
    if (!fields.some(f => f.InternalName === mand)) {
      let forcedType = 'Text';
      if (mand === 'ID') forcedType = 'Counter';
      if (mand === 'Author' || mand === 'Editor') forcedType = 'User';
      if (mand === 'Created' || mand === 'Modified') forcedType = 'DateTime';
      fields.push({ InternalName: mand, Title: mand, TypeAsString: forcedType });
    }
  });

  // For document libraries, always include FileRef and FileLeafRef (not list items)
  if (isDocLib) {
    ['FileRef', 'FileLeafRef'].forEach(fn => {
      if (!fields.some(f => f.InternalName === fn)) {
        fields.push({ InternalName: fn, Title: fn, TypeAsString: 'Text' });
      }
    });
  }

  return fields;
}

// Rule 4 (Retrieval): Retry logic for missing columns + Pagination
async function fetchSPItemsWithRetry(siteUrl, listGuid, selectStr, expandStr, top, retries = 10) {
  let currentSelect = selectStr.split(',').filter(s => s.trim());
  let currentExpand = expandStr.split(',').filter(s => s.trim());

  for (let i = 0; i < retries; i++) {
    let baseUrl = `${siteUrl}/_api/web/lists(guid'${listGuid}')/items?$top=${top}&$select=${currentSelect.join(',')}&$expand=${currentExpand.join(',')}`;
    
    try {
      let allItems = [];
      let nextUrl = baseUrl;

      // PAGINATION LOOP: Keep fetching until SharePoint says we have everything
      while (nextUrl) {
        const json = await spFetch(nextUrl);
        
        // Scrub OData artifacts
        let rows = extractRows(json);
        let items = stripODataMetadata(rows,true);

        allItems = allItems.concat(items);

        // Check if there is another page of data
        if (json['@odata.nextLink']) nextUrl = json['@odata.nextLink'];
        else if (json['odata.nextLink']) nextUrl = json['odata.nextLink'];
        else if (json.d && json.d.__next) nextUrl = json.d.__next;
        else nextUrl = null;

        // Stop if we hit our manual limit
        if (allItems.length >= top) { 
            allItems = allItems.slice(0, top); 
            break; 
        }
      }

      return allItems; // Return the fully combined, paginated array!

    } catch (e) {
      const errorStr = e.message || '';
      const match = errorStr.match(/(?:Column|The field or property) '([^']+)' does not exist/i);

      if (match && match[1]) {
        const badCol = match[1];
        currentSelect = currentSelect.filter(c => c !== badCol && !c.startsWith(badCol + '/'));
        currentExpand = currentExpand.filter(c => c !== badCol && !c.startsWith(badCol + '/'));
        // The loop will now retry (i++) with the bad column removed!
      } else {
        throw e;
      }
    }
  }
  throw new Error("Exceeded max retries for missing columns.");
}

// Fetch Table Data with intelligent retry and pagination logic, plus promise tracking to prevent duplicate fetches
async function fetchTableData(tableName, fetchAll = false) {
  console.log('DEBUG: fetchTableData called for', tableName, 'fetchAll:', fetchAll);
  const t = DataLaVistaState.tables[tableName];
  if (!t) return;
  const limit = fetchAll ? 50000 : 10;

  // Skip if we already have enough data
  console.log('DEBUG: Current table state upon entering fetchDataTable:', { loaded: t.loaded, dataLength: t.data ? t.data.length : 0 });
  if (fetchAll && t.loaded && t.data && t.data.length > 10) return; 
  console.log('DEBUG: Data load needed for', tableName, '— proceeding with checks.');
  if (!fetchAll && t.data && t.data.length >= 10) return;          

  console.log('*** DEBUG: Need to fetch data for', tableName, '— proceeding with fetch sequence. ***');
  // *** PROMISE TRACKER: If a fetch is already running, return its promise ***
  if (t.fetchPromise) {
    console.log('*** DEBUG: Fetch already in progress for', tableName, '— awaiting existing promise. ***');
    return t.fetchPromise; 
  }

  // Create the fetch sequence and store it in the table state
  console.log('*** DEBUG: Initiating new fetch sequence (declaring promise) for', tableName, '***');
  t.fetchPromise = (async (tableName) => {
    try {
      console.log('DEBUG: Entered fetchPromise sequence at:', new Date().toISOString());
      if (!fetchAll) setStatus(`⏳ Fetching preview for ${tableName}...`);
      
      const spFields = t.originalFields || t.fields;
      let rawData = [];
      
      if (t.sourceType === 'sharepoint') {
        console.log('DEBUG: Fetching SharePoint data for', tableName);
        const spSiteUrl = t.url || t.siteUrl || (DataLaVistaState.dataSources[t.dataSource] && DataLaVistaState.dataSources[t.dataSource].siteUrl);
        const baseSelect = new Set(['ID', 'Title', 'Created', 'Modified', 'Author/Id', 'Author/Title', 'Author/Name', 'Editor/Id', 'Editor/Title', 'Editor/Name']);
        const baseExpand = new Set(['Author', 'Editor']);
        
        spFields.forEach(f => {
          console.log('DEBUG: Processing field for select/expand:', f.InternalName || f.internalName, 'Type:', f.TypeAsString || f.type);
          const internalName = f.InternalName || f.internalName;
          if (f.isAutoId || !internalName) return; 
          
          const typeStr = (f.TypeAsString || f.type || '').toLowerCase();
          const isPeople = typeStr.includes('user');
          const isLookup = typeStr.includes('lookup');
          const isTax = typeStr.includes('taxonomy') || internalName === 'TaxKeyword';
          
          if (isPeople) {
            baseSelect.add(`${internalName}/Id`);
            baseSelect.add(`${internalName}/Title`);
            baseSelect.add(`${internalName}/Name`);
            baseExpand.add(internalName);
          } else if (isLookup) {
            baseSelect.add(`${internalName}/Id`);
            baseSelect.add(`${internalName}/Title`);
            baseExpand.add(internalName);
          } else if (isTax) {
            baseSelect.add(internalName);
          } else {
            baseSelect.add(internalName);
          }
        });
        
        console.log('Calling fetchSPItemsWithRetry with select:', Array.from(baseSelect), 'expand:', Array.from(baseExpand));
        rawData = await fetchSPItemsWithRetry(
          spSiteUrl,
          t.guid,
          Array.from(baseSelect).join(','),
          Array.from(baseExpand).join(','),
          limit
        );
        console.log('DEBUG: Done loading SharePoint list data for', tableName, '— raw data length:', rawData.length);
      } else if(t.sourceType === 'json') {
        console.log('DEBUG: Fetching JSON data for', tableName);
        const jsonUrl = t.url || (DataLaVistaState.dataSources[t.dataSource] && DataLaVistaState.dataSources[t.dataSource].url);
        if (!jsonUrl) {
          console.log('DEBUG: No URL found for JSON source in', tableName, '— skipping fetch.');
          return;
        }
        const res = await fetch(jsonUrl);
        if (!res.ok) {
          console.log('DEBUG: Failed to fetch JSON data for', tableName, '— HTTP status:', res.status);
          return;
        }
        const json = await res.json();
        rawData = extractRows(json);
      } else if(t.sourceType === 'csv') {
        console.log('DEBUG: Fetching CSV data for', tableName);
        let csvUrl = (DataLaVistaState.tables[tableName] && DataLaVistaState.tables[tableName].url) || (DataLaVistaState.dataSources[t.dataSource] && DataLaVistaState.dataSources[t.dataSource].url);
        csvUrl = encodeURI(csvUrl);
        console.log('DEBUG: CSV URL resolved to: ' + csvUrl);
        if (!csvUrl) {
          console.log('DEBUG: No URL found for CSV source in table: ' + tableName);
          return;
        }
        setStatus(`Loading CSV... (${csvUrl.length > 50 ? '...' + csvUrl.slice(-47) : csvUrl})`);

        let text;
        console.log('DEBUG: fetchTableData -> calling fetchCSVFromUrl');
        try{
          text = await fetchCSVFromURL(csvUrl);
        } catch (e) {
          console.error('[DLV CSV] res.text() threw:', e);
          throw e;
        }
        if (!text.trim()) throw new Error('CSV file appears to be empty');
        const fileName = csvUrl.split('/').pop();
        
        console.log('DEBUG: fetchTableData -> calling loadCSVData...');
        loadCSVData(t.dataSource||'CSV', tableName||'', fileName, csvUrl, false, text); // Create new DS for this CSV file, with isUploadedFile=false
        console.log('DEBUG: fetchTableData -> loadCSVData completed, now extracting raw data from state for', tableName);

        rawData = DataLaVistaState.tables[tableName] && DataLaVistaState.tables[tableName].data ? DataLaVistaState.tables[tableName].data : [];
      } else if(t.sourceType === 'api') {
        const apiUrl = t.url || (DataLaVistaState.dataSources[t.dataSource] && DataLaVistaState.dataSources[t.dataSource].url);
        // TODO: Add support for API sources (fetch with headers, auth, etc) — currently just a placeholder
      } else {
        console.log('DEBUG: Unsupported source type for', tableName, '— skipping fetch.');
        return;
      
      }
      console.log('DEBUG: Raw data fetched for', tableName);
      console.log('DEBUG: Mapping data rows for', tableName);
      t.data = rawData.map(row => mapDataRow(tableName, row, spFields)); 
      t.loaded = fetchAll;
      
      if (!t.originalFields) {
        t.originalFields = [...t.fields]; 
        
        const dataKeys = new Set();
        t.data.forEach(row => Object.keys(row).forEach(k => dataKeys.add(k)));
        
        // Dynamically add any fields generated by mapDataRow (Emails, Claims, Data, etc)
        // TODO: move to another function and call as needed above
        console.log('DEBUG: Adding synthetic fields for', tableName, Array.from(dataKeys));
        dataKeys.forEach(k => {
          if (!t.fields.some(f => f.alias === k)) {
            t.fields.push({ 
              internalName: k, 
              displayName: k, 
              alias: k, 
              type: 'text', 
              displayType: k.endsWith('Data') ? 'array' : 'text', 
              isAutoId: true // <--- Flags synthetic fields to hide them in basic builder
            });
          }
        });
      }
      
      if (!fetchAll) setStatus(`✅ Loaded preview for ${tableName}`);
    } finally {
      // *** CLEANUP: Remove the promise once the fetch completes or fails ***
      t.fetchPromise = null;
    }
  })(tableName);

  // Await the promise we just created and return it
  return t.fetchPromise;
}


// TODO: Use this data type sample testing in JSON and Excel sources too.
async function deriveStructureFromSample(dataArray) {
  if (!dataArray || dataArray.length === 0) return [];

  const sample = dataArray.slice(0, 10);
  const keys = new Set();
  sample.forEach(row => Object.keys(row).forEach(k => keys.add(k)));

  // Simple regex for common date formats: MM/DD/YYYY, YYYY-MM-DD, etc.
  const dateRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(?:\s\d{1,2}:\d{2}(?::\d{2})?)?$/;

  return Array.from(keys).map(k => {
    const firstValidRow = sample.find(row => row[k] !== null && row[k] !== undefined && row[k] !== '');
    const val = firstValidRow ? firstValidRow[k] : null;
    
    let detectedType = 'text';
    const jsType = typeof val;

    if (jsType === 'number') {
      detectedType = 'number';
    } else if (jsType === 'boolean') {
      detectedType = 'boolean';
    } else if (val instanceof Date) {
      detectedType = 'date';
    } else if (jsType === 'string' && dateRegex.test(val.trim())) {
      // If it looks like a date string, try parsing it to be sure
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        detectedType = 'date';
      }
    } else if (Array.isArray(val)) {
      detectedType = 'array';
    } else if (jsType === 'object' && val !== null) {
      detectedType = 'lookup';
    }

    return {
      internalName: k.replace(/[^A-Za-z0-9_]/g, '_').replace('__', '_'),
      displayName: toPascalCase(k) || k,
      alias: toPascalCase(k) || k,
      type: detectedType,
      displayType: detectedType
    };
  });


  


}


    // ============================================================
    // SHAREPOINT WRITE HELPER
    // ============================================================

    /**
     * Mutation-capable companion to spFetch for POST/MERGE/DELETE operations.
     * Automatically injects X-RequestDigest from _spPageContextInfo.formDigestValue
     * (available on SharePoint pages via the SP global) or fetches it from contextinfo.
     * @param {string} url
     * @param {Object} [options] - fetch options (method, headers, body)
     * @param {string} [siteUrl] - SP site URL; defaults to getSpSiteUrl()
     * @returns {Promise<Response>} - raw fetch Response (not pre-parsed)
     */
    async function spFetchWrite(url, options = {}, siteUrl) {
      // _spPageContextInfo is injected by SharePoint on SP pages; cast via globalThis to avoid TypeScript false positives
      let digest = /** @type {any} */ (globalThis)._spPageContextInfo?.formDigestValue || null;
      if (!digest) {
        const site = siteUrl || getSpSiteUrl();
        const res = await fetch(`${site}/_api/contextinfo`, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });
        const json = await res.json();
        digest = json.FormDigestValue ?? json.d?.GetContextWebInformation?.FormDigestValue;
      }
      return fetch(url, {
        ...options,
        credentials: 'include',
        headers: { 'X-RequestDigest': digest, ...(options.headers || {}) }
      });
    }

    // ============================================================
    // SHAREPOINT FILE DIALOG
    // ============================================================

    /**
     * Universal SharePoint file dialog for opening/saving files from
     * document libraries and list items. Remembers the last used location
     * separately for files and lists via localStorage.
     *
     * @example
     *   const result = await SharePointFileDialog.show({
     *     mode: 'open',    // 'open' | 'save'
     *     type: 'file',    // 'file' | 'list'
     *     defaultFileName: 'report.json',
     *     fileContent: jsonString,
     *     fileExtensions: ['.json'],
     *     defaultFolders: ['/sites/foo/Shared Documents/DLV Reports'],
     *     defaultList: 'DLV Reports'
     *   });
     *   // file result:  { url, serverRelativeUrl, folderName, fileName, id }
     *   // list result:  { listName, id, itemUrl, title, folderName, fileName, url, serverRelativeUrl }
     *
     * Navigation priority on open:
     *   1. Last used location saved in localStorage (dlv_spfd_last_file / dlv_spfd_last_list)
     *   2. defaultFolders / defaultList parameter
     *   3. Root (all document libraries / all lists)
     */
    const SharePointFileDialog = {

      show(options = {}) {
        const params = {
          mode:             options.mode             || 'open',
          type:             options.type             || 'file',
          defaultFileName:  options.defaultFileName  || 'untitled.json',
          fileContent:      options.fileContent      ?? '',
          sqlQuery:         options.sqlQuery         ?? '',
          fileContentField: options.fileContentField || 'FileContent',
          sqlQueryField:    options.sqlQueryField    || 'SQLQuery',
          fileExtensions:   options.fileExtensions   || [],
          defaultFolders:   options.defaultFolders   || [],
          defaultList:      options.defaultList      || ''
        };
        return new Promise((resolve, reject) => {
          SharePointFileDialog._createDialog(params, resolve, reject);
        });
      },

      _createDialog(params, resolve, reject) {
        const siteUrl = getSpSiteUrl();
        if (!siteUrl) { reject(new Error('SharePoint site URL not detected')); return; }

        // ── Overlay ──────────────────────────────────────────
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10200;display:flex;align-items:center;justify-content:center;';

        // ── Dialog container ─────────────────────────────────
        const dlg = document.createElement('div');
        dlg.style.cssText = 'background:var(--surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:560px;max-width:calc(100vw - 32px);max-height:calc(100vh - 80px);display:flex;flex-direction:column;animation:popIn 180ms ease;';

        // ── Header ───────────────────────────────────────────
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:14px 16px 12px;border-bottom:1px solid var(--border);flex-shrink:0;';
        const titleEl = document.createElement('h3');
        titleEl.style.cssText = 'font-size:14px;font-weight:600;flex:1;margin:0;';
        titleEl.textContent = `${params.mode === 'save' ? 'Save' : 'Open'} ${params.type === 'file' ? 'File' : 'List Item'}`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-ghost btn-icon';
        closeBtn.title = 'Close';
        closeBtn.textContent = '✕';
        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        // ── Filename row (save mode only) ────────────────────
        let filenameInput = null;
        const filenameRow = document.createElement('div');
        if (params.mode === 'save') {
          filenameRow.style.cssText = 'padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;gap:8px;align-items:center;';
          const lbl = document.createElement('label');
          lbl.textContent = 'Name:';
          lbl.style.cssText = 'font-size:12px;white-space:nowrap;color:var(--text-secondary);';
          filenameInput = document.createElement('input');
          filenameInput.type = 'text';
          filenameInput.value = params.defaultFileName;
          filenameInput.style.cssText = 'flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--surface);color:var(--text);';
          filenameRow.appendChild(lbl);
          filenameRow.appendChild(filenameInput);
        }

        // ── Breadcrumb ───────────────────────────────────────
        const breadcrumbEl = document.createElement('div');
        breadcrumbEl.style.cssText = 'padding:6px 16px;font-size:11px;color:var(--text-secondary);background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;flex-wrap:wrap;gap:2px;flex-shrink:0;min-height:30px;';

        // ── Body ─────────────────────────────────────────────
        const bodyEl = document.createElement('div');
        bodyEl.style.cssText = 'flex:1;overflow-y:auto;padding:4px 0;min-height:160px;';

        // ── Footer ───────────────────────────────────────────
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-default btn-sm';
        cancelBtn.textContent = 'Cancel';
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary btn-sm';
        confirmBtn.textContent = params.mode === 'save' ? 'Save' : 'Open';
        confirmBtn.disabled = true;
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // ── Assemble ─────────────────────────────────────────
        dlg.appendChild(header);
        if (params.mode === 'save') dlg.appendChild(filenameRow);
        dlg.appendChild(breadcrumbEl);
        dlg.appendChild(bodyEl);
        dlg.appendChild(footer);
        overlay.appendChild(dlg);
        document.body.appendChild(overlay);

        // ── State ────────────────────────────────────────────
        const state = {
          siteUrl, params,
          stack: [{ label: 'Document Libraries', serverRelUrl: null }],
          currentList: null, cachedLists: null, selectedItem: null,
          overlay, bodyEl, breadcrumbEl, confirmBtn, filenameInput,
          resolve, reject
        };

        // ── Events ───────────────────────────────────────────
        const cancel = () => { overlay.remove(); reject(new Error('Dialog cancelled')); };
        closeBtn.addEventListener('click', cancel);
        cancelBtn.addEventListener('click', cancel);
        overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });
        confirmBtn.addEventListener('click', () => SharePointFileDialog._handleConfirm(state));

        // ── Initialize ───────────────────────────────────────
        if (params.type === 'file') SharePointFileDialog._initFileBrowser(state);
        else SharePointFileDialog._initListBrowser(state);
      },

      // ── Breadcrumb ──────────────────────────────────────────────────────────

      _renderBreadcrumb(state) {
        const bc = state.breadcrumbEl;
        bc.innerHTML = '';
        const isFile = state.params.type === 'file';
        const crumbs = isFile ? state.stack :
          state.currentList
            ? [{ label: 'Lists', isBack: true }, { label: state.currentList.Title }]
            : [{ label: 'Lists' }];

        crumbs.forEach((crumb, i) => {
          if (i > 0) {
            const sep = document.createElement('span');
            sep.className = 'sp-crumb-sep';
            sep.textContent = ' › ';
            bc.appendChild(sep);
          }
          const span = document.createElement('span');
          span.className = 'sp-crumb';
          span.textContent = crumb.label;
          const isLast = i === crumbs.length - 1;
          if (!isLast) {
            if (isFile) {
              span.addEventListener('click', () => {
                state.stack = state.stack.slice(0, i + 1);
                state.selectedItem = null;
                state.confirmBtn.disabled = !(state.params.mode === 'save' && state.stack.length > 1);
                SharePointFileDialog._loadFileBrowser(state);
              });
            } else {
              span.addEventListener('click', () => {
                state.currentList = null;
                state.selectedItem = null;
                state.confirmBtn.disabled = true;
                SharePointFileDialog._loadListsBrowser(state);
              });
            }
          } else {
            span.style.fontWeight = '600';
            span.style.color = 'var(--text)';
            span.style.cursor = 'default';
          }
          bc.appendChild(span);
        });
      },

      // ── File browser ────────────────────────────────────────────────────────

      async _initFileBrowser(state) {
        // Priority 1: last saved location from localStorage
        try {
          const saved = localStorage.getItem('dlv_spfd_last_file');
          if (saved) {
            const ok = await SharePointFileDialog._folderExists(state.siteUrl, saved);
            if (ok) {
              state.stack = SharePointFileDialog._buildFileStack(state.siteUrl, saved);
              SharePointFileDialog._loadFileBrowser(state);
              return;
            }
          }
        } catch(e) {}
        // Priority 2: defaultFolders parameter
        for (const folder of state.params.defaultFolders) {
          try {
            const ok = await SharePointFileDialog._folderExists(state.siteUrl, folder);
            if (ok) {
              state.stack = SharePointFileDialog._buildFileStack(state.siteUrl, folder);
              SharePointFileDialog._loadFileBrowser(state);
              return;
            }
          } catch(e) {}
        }
        // Priority 3: root (all document libraries)
        SharePointFileDialog._loadFileBrowser(state);
      },

      async _loadFileBrowser(state) {
        SharePointFileDialog._renderBreadcrumb(state);
        state.bodyEl.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-secondary)">Loading…</div>';
        state.selectedItem = null;
        // In save mode, enable confirm once inside a library/folder
        if (state.params.mode === 'save') state.confirmBtn.disabled = state.stack.length <= 1;
        else state.confirmBtn.disabled = true;

        const current = state.stack[state.stack.length - 1];
        try {
          if (current.serverRelUrl === null) {
            // Root: list document libraries (BaseTemplate = 101)
            const json = await spFetch(`${state.siteUrl}/_api/web/lists?$select=Title,RootFolder/ServerRelativeUrl&$expand=RootFolder&$filter=BaseTemplate eq 101 and Hidden eq false`);
            const libs = extractRows(json).filter(l => l.RootFolder).sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
            state.bodyEl.innerHTML = '';
            if (!libs.length) { state.bodyEl.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-secondary)">No document libraries found.</div>'; return; }
            libs.forEach(lib => {
              state.bodyEl.appendChild(spPickerMakeItem('📁', lib.Title, null, false, () => {
                state.stack.push({ label: lib.Title, serverRelUrl: lib.RootFolder.ServerRelativeUrl });
                SharePointFileDialog._loadFileBrowser(state);
              }));
            });
          } else {
            // Folder contents: subfolders + files
            const enc = encodeURIComponent(current.serverRelUrl);
            let filesFilter = '';
            if (state.params.fileExtensions.length > 0) {
              const exts = state.params.fileExtensions.flatMap(e => {
                const base = e.replace(/^\./, '');
                const lo = base.toLowerCase(), hi = base.toUpperCase();
                return lo === hi
                  ? [`substringof('.${lo}',Name)`]
                  : [`substringof('.${lo}',Name)`, `substringof('.${hi}',Name)`];
              });
              filesFilter = `&$filter=(${exts.join(' or ')})`;
            }
            const [foldersJson, filesJson] = await Promise.all([
              spFetch(`${state.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${enc}')/Folders?$select=Name,ServerRelativeUrl&$filter=Name ne 'Forms'`).catch(() => ({ value: [] })),
              spFetch(`${state.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${enc}')/Files?$select=Name,ServerRelativeUrl,Length${filesFilter}`).catch(() => ({ value: [] }))
            ]);
            const folders = extractRows(foldersJson).sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            const files   = extractRows(filesJson).sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            state.bodyEl.innerHTML = '';
            if (!folders.length && !files.length) { state.bodyEl.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-secondary)">No items found.</div>'; return; }
            folders.forEach(f => {
              state.bodyEl.appendChild(spPickerMakeItem('📁', f.Name, null, false, () => {
                state.stack.push({ label: f.Name, serverRelUrl: f.ServerRelativeUrl });
                SharePointFileDialog._loadFileBrowser(state);
              }));
            });
            files.forEach(f => {
              const size = f.Length ? spPickerFormatSize(+f.Length) : '';
              const ext  = f.Name.split('.').pop().toLowerCase();
              const icon = { json: '{ }', csv: '📊', xlsx: '📗', xls: '📗' }[ext] || '📄';
              const el = spPickerMakeItem(icon, f.Name, size, true, () => {
                state.bodyEl.querySelectorAll('.sp-picker-item').forEach(i => i.classList.remove('sp-selected'));
                el.classList.add('sp-selected');
                state.selectedItem = { name: f.Name, serverRelUrl: f.ServerRelativeUrl };
                state.confirmBtn.disabled = false;
                if (state.filenameInput) state.filenameInput.value = f.Name;
              }, f.Name);
              state.bodyEl.appendChild(el);
            });
          }
        } catch(e) {
          state.bodyEl.innerHTML = `<div style="padding:16px;font-size:12px;color:var(--error)">Error: ${e.message}</div>`;
        }
      },

      // ── List browser ────────────────────────────────────────────────────────

      async _initListBrowser(state) {
        try {
          await SharePointFileDialog._fetchLists(state);
          // Priority 1: last saved list
          const saved = localStorage.getItem('dlv_spfd_last_list');
          if (saved) {
            const found = state.cachedLists.find(l => l.Title === saved);
            if (found) { state.currentList = found; SharePointFileDialog._loadListItems(state); return; }
          }
          // Priority 2: defaultList param
          if (state.params.defaultList) {
            const found = state.cachedLists.find(l => l.Title === state.params.defaultList);
            if (found) { state.currentList = found; SharePointFileDialog._loadListItems(state); return; }
          }
        } catch(e) {}
        // Priority 3: root (all lists)
        SharePointFileDialog._loadListsBrowser(state);
      },

      async _fetchLists(state) {
        if (state.cachedLists) return;
        const json = await spFetch(`${state.siteUrl}/_api/web/lists?$filter=Hidden eq false and BaseTemplate eq 100&$select=Title,Id&$orderby=Title`);
        state.cachedLists = extractRows(json);
      },

      async _loadListsBrowser(state) {
        state.currentList = null; state.selectedItem = null; state.confirmBtn.disabled = true;
        SharePointFileDialog._renderBreadcrumb(state);
        state.bodyEl.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-secondary)">Loading…</div>';
        try {
          await SharePointFileDialog._fetchLists(state);
          state.bodyEl.innerHTML = '';
          if (!state.cachedLists.length) { state.bodyEl.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-secondary)">No lists found.</div>'; return; }
          state.cachedLists.forEach(list => {
            state.bodyEl.appendChild(spPickerMakeItem('🗂', list.Title, null, false, () => {
              state.currentList = list;
              SharePointFileDialog._loadListItems(state);
            }));
          });
        } catch(e) {
          state.bodyEl.innerHTML = `<div style="padding:16px;font-size:12px;color:var(--error)">Error: ${e.message}</div>`;
        }
      },

      async _loadListItems(state) {
        SharePointFileDialog._renderBreadcrumb(state);
        state.bodyEl.innerHTML = '<div style="padding:16px;text-align:center;font-size:12px;color:var(--text-secondary)">Loading…</div>';
        state.selectedItem = null;
        // In save mode, enable confirm as soon as we're inside a list
        if (state.params.mode === 'save') state.confirmBtn.disabled = false;
        else state.confirmBtn.disabled = true;
        try {
          const enc = encodeURIComponent(state.currentList.Title);
          const json = await spFetch(`${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/items?$select=ID,Title&$orderby=ID desc&$top=1000`);
          const items = extractRows(json);
          state.bodyEl.innerHTML = '';
          if (!items.length) { state.bodyEl.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--text-secondary)">No items found.</div>'; return; }
          items.forEach(item => {
            const label = `${item.Title || '(Untitled)'} (ID: ${item.ID})`;
            const el = spPickerMakeItem('📄', label, null, true, () => {
              state.bodyEl.querySelectorAll('.sp-picker-item').forEach(i => i.classList.remove('sp-selected'));
              el.classList.add('sp-selected');
              state.selectedItem = { id: item.ID, name: item.Title || '' };
              state.confirmBtn.disabled = false;
              if (state.filenameInput) {
                const ext = state.params.defaultFileName.match(/\.[^.]+$/)?.[0] || '.json';
                state.filenameInput.value = (item.Title || '') + ext;
              }
            }, String(item.ID));
            state.bodyEl.appendChild(el);
          });
        } catch(e) {
          state.bodyEl.innerHTML = `<div style="padding:16px;font-size:12px;color:var(--error)">Error: ${e.message}</div>`;
        }
      },

      // ── Confirm handler ──────────────────────────────────────────────────────

      async _handleConfirm(state) {
        state.confirmBtn.disabled = true;
        const origText = state.confirmBtn.textContent;
        state.confirmBtn.textContent = state.params.mode === 'save' ? 'Saving…' : 'Opening…';
        try {
          const result = state.params.mode === 'save'
            ? (state.params.type === 'file' ? await SharePointFileDialog._saveFile(state)     : await SharePointFileDialog._saveListItem(state))
            : (state.params.type === 'file' ? await SharePointFileDialog._openFile(state)     : await SharePointFileDialog._openListItem(state));
          // Persist last location to localStorage
          try {
            if (state.params.type === 'file') {
              const cur = state.stack[state.stack.length - 1];
              if (cur.serverRelUrl) localStorage.setItem('dlv_spfd_last_file', cur.serverRelUrl);
            } else if (state.currentList) {
              localStorage.setItem('dlv_spfd_last_list', state.currentList.Title);
            }
          } catch(e) {}
          state.overlay.remove();
          state.resolve(result);
        } catch(e) {
          toast(e.message, 'error');
          state.confirmBtn.disabled = false;
          state.confirmBtn.textContent = origText;
        }
      },

      // ── Save file ───────────────────────────────────────────────────────────

      async _saveFile(state) {
        let filename = state.filenameInput?.value?.trim();
        if (!filename) throw new Error('Please enter a file name.');
        filename = decodeURIComponent(filename);
        const cur = state.stack[state.stack.length - 1];
        if (!cur.serverRelUrl) throw new Error('Please navigate into a folder or library first.');

        const fileServerRelUrl = cur.serverRelUrl + '/' + filename;
        // Check if file already exists
        let fileExists = false;
        try { await spFetch(`${state.siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(fileServerRelUrl)}')`); fileExists = true; } catch(e) {}
        if (fileExists && !confirm(`"${filename}" already exists. Overwrite?`)) throw new Error('Save cancelled.');

        // Upload file
        const enc = encodeURIComponent(cur.serverRelUrl);
        const res = await spFetchWrite(
          `${state.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${enc}')/Files/add(url='${encodeURIComponent(filename)}',overwrite=true)`,
          { method: 'POST', headers: { 'Accept': 'application/json' }, body: state.params.fileContent },
          state.siteUrl
        );
        if (!res.ok) { const t = await res.text(); throw new Error(`Upload failed (${res.status}): ${t}`); }

        // Retrieve the list item ID for the uploaded file
        let id = null;
        try {
          const p = await spFetch(`${state.siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(fileServerRelUrl)}')?$expand=ListItemAllFields&$select=ListItemAllFields/ID`);
          id = p?.ListItemAllFields?.ID ?? null;
        } catch(e) {}

        const origin = state.siteUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');
        return { url: origin + fileServerRelUrl, serverRelativeUrl: fileServerRelUrl, folderName: cur.label, fileName: filename, id };
      },

      // ── Open file ───────────────────────────────────────────────────────────

      async _openFile(state) {
        if (!state.selectedItem) throw new Error('Please select a file.');
        const { name, serverRelUrl } = state.selectedItem;
        const origin = state.siteUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');
        let id = null;
        try {
          const p = await spFetch(`${state.siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelUrl)}')?$expand=ListItemAllFields&$select=ListItemAllFields/ID`);
          id = p?.ListItemAllFields?.ID ?? null;
        } catch(e) {}
        return { url: origin + serverRelUrl, serverRelativeUrl: serverRelUrl, folderName: state.stack[state.stack.length - 1].label, fileName: name, id };
      },

      // ── Save list item ──────────────────────────────────────────────────────

      async _saveListItem(state) {
        if (!state.currentList) throw new Error('Please navigate into a list first.');
        let filename = state.filenameInput?.value?.trim() || state.params.defaultFileName;
        filename = decodeURIComponent(filename);
        const title = filename.replace(/\.[^.]+$/, '') || 'Untitled';
        const listTitle = state.currentList.Title;
        const enc = encodeURIComponent(listTitle);
        const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

        // Check which custom fields exist in this list
        const fieldsJson = await spFetch(`${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/fields?$select=InternalName`);
        const fieldNames = extractRows(fieldsJson).map(f => f.InternalName);
        const itemData = { Title: title };
        if (state.params.fileContent && fieldNames.includes(state.params.fileContentField)) itemData[state.params.fileContentField] = state.params.fileContent;
        if (state.params.sqlQuery && fieldNames.includes(state.params.sqlQueryField)) itemData[state.params.sqlQueryField] = state.params.sqlQuery;

        let id;
        if (state.selectedItem?.id) {
          // Update existing item
          if (!confirm(`Update existing item "${state.selectedItem.name || state.selectedItem.id}"?`)) throw new Error('Save cancelled.');
          id = state.selectedItem.id;
          const r = await spFetchWrite(
            `${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/items(${id})`,
            { method: 'POST', headers: { ...headers, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' }, body: JSON.stringify(itemData) },
            state.siteUrl
          );
          if (!r.ok) { const t = await r.text(); throw new Error(`Update failed (${r.status}): ${t}`); }
        } else {
          // Create new item
          const r = await spFetchWrite(
            `${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/items`,
            { method: 'POST', headers, body: JSON.stringify(itemData) },
            state.siteUrl
          );
          if (!r.ok) { const t = await r.text(); throw new Error(`Create failed (${r.status}): ${t}`); }
          const j = await r.json();
          id = j.ID || j.d?.ID;
        }

        // Add/replace attachment if fileContent is provided
        if (state.params.fileContent) {
          const attName = decodeURIComponent(filename);
          // Delete existing attachment with same name if present
          try {
            await spFetchWrite(
              `${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/items(${id})/AttachmentFiles/getbyfilename('${encodeURIComponent(attName)}')`,
              { method: 'POST', headers: { 'X-HTTP-Method': 'DELETE' } },
              state.siteUrl
            );
          } catch(e) {}
          const ar = await spFetchWrite(
            `${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/items(${id})/AttachmentFiles/add(FileName='${encodeURIComponent(attName)}')`,
            { method: 'POST', headers: { 'Accept': 'application/json' }, body: state.params.fileContent },
            state.siteUrl
          );
          if (!ar.ok) { const t = await ar.text(); throw new Error(`Attachment failed (${ar.status}): ${t}`); }
        }

        return { listName: listTitle, id, title, folderName: listTitle, itemUrl: `${state.siteUrl}/Lists/${listTitle}/DispForm.aspx?ID=${id}`, fileName: null, url: null, serverRelativeUrl: null };
      },

      // ── Open list item ──────────────────────────────────────────────────────

      async _openListItem(state) {
        if (!state.selectedItem) throw new Error('Please select an item.');
        const { id } = state.selectedItem;
        const listTitle = state.currentList.Title;
        const enc = encodeURIComponent(listTitle);
        const json = await spFetch(`${state.siteUrl}/_api/web/lists/getbytitle('${enc}')/items(${id})?$select=Title&$expand=AttachmentFiles`);
        const item = json.d || json;
        const attachments = extractRows(item.AttachmentFiles || null);
        const att = attachments[0];
        const origin = state.siteUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');
        return {
          listName: listTitle, id, title: item.Title, folderName: listTitle,
          itemUrl: `${state.siteUrl}/Lists/${listTitle}/DispForm.aspx?ID=${id}`,
          fileName: att?.FileName ?? null,
          url: att ? origin + att.ServerRelativeUrl : null,
          serverRelativeUrl: att?.ServerRelativeUrl ?? null
        };
      },

      // ── Utilities ───────────────────────────────────────────────────────────

      /** Check if a folder/library exists at the given server-relative URL. */
      async _folderExists(siteUrl, serverRelUrl) {
        try { await spFetch(`${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(serverRelUrl)}')`); return true; } catch(e) { return false; }
      },

      /**
       * Build a breadcrumb stack from a server-relative folder URL.
       * e.g. siteUrl='https://tenant.sharepoint.com/sites/foo', serverRelUrl='/sites/foo/Shared Documents/Reports'
       * → [{label:'Document Libraries', serverRelUrl:null}, {label:'Shared Documents', serverRelUrl:'/sites/foo/Shared Documents'}, {label:'Reports', serverRelUrl:'/sites/foo/Shared Documents/Reports'}]
       */
      _buildFileStack(siteUrl, serverRelUrl) {
        const stack = [{ label: 'Document Libraries', serverRelUrl: null }];
        const webPath = siteUrl.replace(/^https?:\/\/[^/]+/, ''); // e.g. '/sites/foo'
        let rel = serverRelUrl;
        if (rel.startsWith(webPath)) rel = rel.slice(webPath.length); // strip site prefix
        let built = webPath;
        rel.split('/').filter(p => p).forEach(part => {
          built += '/' + part;
          stack.push({ label: part, serverRelUrl: built });
        });
        return stack;
      }
    };

