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



