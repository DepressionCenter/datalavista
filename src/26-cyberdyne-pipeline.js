/* ============================================================
This file is part of DataLaVista™
26-cyberdyne-pipeline.js: Unified data loading and processing pipeline
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-28
Last Modified: 2026-04-04
Summary: Cyberdyne Pipeline - unified data processing for CSV, JSON, Excel, XML, SQLite
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

/* ============================================================
   CYBERDYNE PIPELINE — I'll be processing...
   Unified data processing pipeline that handles:
   - File uploads (CSV, JSON, Excel, XML, SQLite)
   - Remote file URLs
   - Data type detection from first 25 rows
   - OData extraction and column cleaning
   - Synthetic field generation for arrays/objects
   - View creation and management
============================================================ */
const CyberdynePipeline = {

  /* ===== DATE PATTERNS ===== */
  DATE_PATTERNS: {
    iso:         /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/,
    oracle:      /^\d{2}-[A-Z]{3}-\d{2,4}$/i,
    excelCsv:    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    unixEpoch:   /^\d{10}$/,
    unixEpochMs: /^\d{13}$/,
    scientific:  /^\d+\.?\d*[eE][+-]?\d+$/
  },

  /* ===== NULL / ERROR VALUES TO IGNORE IN TYPE DETECTION ===== */
  NULL_VALUES: new Set(['null', 'NULL', 'NaN', '#Error', '#N/A', '#VALUE!', '#REF!', '#DIV/0!']),

  /* ============================================================
     DATA TYPE DETECTION
  ============================================================ */

  /** Detect if a value is a date string using multiple patterns */
  isDate(value) {
    if (value === null || value === undefined || value === '') return false;
    const str = String(value).trim();
    if (this.NULL_VALUES.has(str)) return false;
    if (this.DATE_PATTERNS.iso.test(str)) return true;
    if (this.DATE_PATTERNS.oracle.test(str)) return true;
    if (this.DATE_PATTERNS.excelCsv.test(str)) return true;
    if (this.DATE_PATTERNS.unixEpoch.test(str)) {
      // 10-digit number — verify it's a plausible epoch (after 2000)
      const n = parseInt(str, 10);
      return n > 946684800 && n < 9999999999;
    }
    if (this.DATE_PATTERNS.unixEpochMs.test(str)) {
      const n = parseInt(str, 10);
      return n > 946684800000 && n < 9999999999999;
    }
    if (this.DATE_PATTERNS.scientific.test(str)) {
      const n = parseFloat(str);
      // Unix epoch in scientific notation (e.g., 1.7116e+12 ms)
      return n > 9.46e11 && n < 9.99e12;
    }
    return false;
  },

  /** Detect if a value is a number (not a date, not a null/error) */
  isNumber(value) {
    if (value === null || value === undefined || value === '') return false;
    const str = String(value).trim();
    if (this.NULL_VALUES.has(str)) return false;
    if (this.DATE_PATTERNS.iso.test(str)) return false;
    if (/^-?\d+\.?\d*([eE][+-]?\d+)?$/.test(str)) {
      const n = parseFloat(str);
      return !isNaN(n) && isFinite(n);
    }
    return false;
  },

  /** Detect if a value is a boolean */
  isBoolean(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return true;
    const str = String(value).trim().toLowerCase();
    return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(str);
  },

  /**
   * Guess the data type for a column by checking the first 25 rows.
   * Returns: 'number' | 'boolean' | 'date' | 'array' | 'object' | 'text'
   * Requires a super-majority (>60%) to declare a type; otherwise returns 'text'.
   */
  guessFieldType(column, rows) {
    const sample = rows.slice(0, 25);
    let numericCount = 0, boolCount = 0, dateCount = 0, arrayCount = 0, objectCount = 0, validCount = 0;
    for (const row of sample) {
      const value = row[column];
      if (value === null || value === undefined || value === '') continue;
      const str = String(value).trim();
      if (this.NULL_VALUES.has(str)) continue;
      validCount++;
      if (Array.isArray(value))                                { arrayCount++;  continue; }
      if (typeof value === 'object')                           { objectCount++; continue; }
      if (this.isDate(value))                                  { dateCount++;   continue; }
      if (this.isNumber(value))                                { numericCount++; continue; }
      if (this.isBoolean(value))                               { boolCount++;   continue; }
    }
    if (validCount === 0) return 'text';
    const threshold = validCount * 0.6;
    if (arrayCount > 0)          return 'array';
    if (objectCount > 0)         return 'object';
    if (dateCount >= threshold)  return 'date';
    if (numericCount >= threshold) return 'number';
    if (boolCount >= threshold)  return 'boolean';
    return 'text';
  },

  /** Map internal type to display type */
  mapDisplayType(type) {
    const map = { number: 'number', boolean: 'boolean', date: 'date', array: 'array', object: 'object', lookup: 'lookup' };
    return map[type] || 'text';
  },

  /* ============================================================
     ODATA EXTRACTION AND COLUMN CLEANING
  ============================================================ */

  /**
   * Extract row array from OData wrappers like { d: { results: [...] } }.
   * Delegates to the existing extractRows() function from 23-sharepoint.js.
   */
  extractFromODataWrapper(data) {
    return extractRows(data);
  },

  /**
   * Remove OData metadata keys and SP system columns from a single row object.
   * Uses the existing SKIP_FIELDS Set (10-constants.js).
   */
  stripODataRow(row) {
    if (!row || typeof row !== 'object') return row;
    const isExcluded = (k) =>
      DataLaVistaCore.SKIP_FIELDS.has(k) ||
      k === '__metadata' ||
      k.startsWith('@odata.') ||
      k.startsWith('odata.') ||
      (k.startsWith('@') && k !== '@odata.nextLink');
    const cleaned = {};
    for (const [k, v] of Object.entries(row)) {
      if (!isExcluded(k)) cleaned[k] = v;
    }
    return cleaned;
  },

  /** Remove OData columns from an array of rows */
  removeODataColumns(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => this.stripODataRow(row));
  },

  /* ============================================================
     SYNTHETIC FIELD GENERATION
  ============================================================ */

  /* ============================================================
     FIELD TYPE INFERENCE
  ============================================================ */

  /**
   * Infer field types from the first 25 rows of data.
   * Enhanced replacement for deriveStructureFromSample().
   */
  inferFieldTypes(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const firstRow = rows[0];
    return Object.keys(firstRow).map(name => {
      const type = this.guessFieldType(name, rows);
      return {
        internalName: name,
        displayName: name,
        alias: toPascalCase(name) || name,
        type,
        displayType: this.mapDisplayType(type),
        required: false
      };
    });
  },

  /* ============================================================
     INTERNAL AlaSQL TABLE REGISTRATION
  ============================================================ */

  /** Register data directly into an AlaSQL table by raw name (independent of DataLaVistaState) */
  _registerRawTable(rawTableName, data) {
    const alasqlName = '_raw_' + rawTableName;
    const existing = Object.keys(alasql.tables).find(k => k.toLowerCase() === alasqlName.toLowerCase());
    if (existing) {
      alasql(`TRUNCATE TABLE [${existing}]`);
      alasql(`INSERT INTO [${existing}] SELECT * FROM ?`, [data]);
    } else {
      alasql(`CREATE TABLE [${alasqlName}]`);
      alasql(`INSERT INTO [${alasqlName}] SELECT * FROM ?`, [data]);
    }
  },

  /* ============================================================
     FILE LOADING — UPLOADED FILES
  ============================================================ */

  /**
   * Load an uploaded File object (CSV, JSON, Excel, XML, SQLite).
   * Returns: { tableName, data, fields, metadata }
   * For SQLite: { tables: [...], dbName }
   */
  async loadUploadedFile(file, dsName) {
  const ext = file.name.split('.').pop().toLowerCase();
  // Normalize extensions
  const normalizedExt = ext === 'sqlite3' ? 'sqlite' : ext;
  const metadata = { 
    sourceType: normalizedExt === 'tsv' ? 'csv' : normalizedExt, 
    fileName: file.name, 
    isFileUpload: true, 
    url: null 
  };
  switch (normalizedExt) {
    case 'csv': case 'tsv': return await this.loadCSVFile(file, dsName, metadata);
    case 'json': case 'json5': return await this.loadJSONFile(file, dsName, metadata);
    case 'xlsx': case 'xls': return await this.loadExcelFile(file, dsName, metadata);
    case 'xml': return await this.loadXMLFile(file, dsName, metadata);
    case 'sqlite': case 'db': case 'sqlite3': return await this.loadSQLiteFile(file, dsName, metadata);
    default: throw new Error(`Unsupported file type: .${ext}`);
  }
},

  /** Load uploaded CSV/TSV file */
  async loadCSVFile(file, dsName, metadata) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsed = parseCSV(text);
          const rows = this.removeODataColumns(parsed.rows);
          let fields = this.inferFieldTypes(rows);
          // No synthetic expansion here — FieldExpander in _applyViewSQL handles it via the VIEW layer
          const fileStem = toPascalCase((metadata.fileName || '').replace(/\.[^/.]+$/, '')) || 'Data';
          const tableName = normalizeDataSourceName(dsName) + '_' + fileStem;
          resolve({ tableName, data: rows, fields, metadata: { ...metadata, rowCount: rows.length } });
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  },

  /** Load uploaded JSON file */
  async loadJSONFile(file, dsName, metadata) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          let rows = this.extractFromODataWrapper(parsed);
          rows = this.removeODataColumns(rows);
          let fields = this.inferFieldTypes(rows);
          // No synthetic expansion here — FieldExpander in _applyViewSQL handles it via the VIEW layer
          const fileStem = toPascalCase((metadata.fileName || '').replace(/\.[^/.]+$/, '')) || 'Data';
          const tableName = normalizeDataSourceName(dsName) + '_' + fileStem;
          resolve({ tableName, data: rows, fields, metadata: { ...metadata, rowCount: rows.length } });
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  },

  /** Load uploaded Excel file via SheetJS (XLSX v0.18.5, Apache 2.0) */
  async loadExcelFile(file, dsName, metadata) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (typeof XLSX === 'undefined') throw new Error('SheetJS library is not loaded');
          const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const sheetNames = workbook.SheetNames;
          if (!sheetNames || sheetNames.length === 0) throw new Error('Excel file contains no sheets');
          const baseFileName = metadata.fileName.replace(/\.xlsx?$/i, '');

          if (sheetNames.length === 1) {
            // Single sheet → return one table
            const sheet = workbook.Sheets[sheetNames[0]];
            let rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
            rows = this.removeODataColumns(rows);
            let fields = this.inferFieldTypes(rows);
            // No synthetic expansion — FieldExpander handles it via the VIEW layer
            const tableName = normalizeDataSourceName(dsName) + '_' + (toPascalCase(baseFileName) || 'Data');
            resolve({ tableName, data: rows, fields, metadata: { ...metadata, rowCount: rows.length } });
          } else {
            // Multiple sheets → return multi-table result (same shape as SQLite)
            const results = [];
            for (const sheetName of sheetNames) {
              const sheet = workbook.Sheets[sheetName];
              let rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
              rows = this.removeODataColumns(rows);
              let fields = this.inferFieldTypes(rows);
              // No synthetic expansion — FieldExpander handles it via the VIEW layer
              const tableName = normalizeDataSourceName(dsName) + '_' + (toPascalCase(sheetName) || sheetName);
              results.push({ tableName, data: rows, fields, metadata: { ...metadata, internalTableName: sheetName, rowCount: rows.length } });
            }
            resolve({ tables: results });
          }
        } catch (err) { reject(new Error('Excel parsing failed: ' + err.message)); }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  },

  /** Load uploaded XML file */
  async loadXMLFile(file, dsName, metadata) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const xmlDoc = new DOMParser().parseFromString(e.target.result, 'text/xml');
          let rows = this.xmlToRows(xmlDoc);
          rows = this.extractFromODataWrapper(rows);
          rows = this.removeODataColumns(rows);
          let fields = this.inferFieldTypes(rows);
          // No synthetic expansion — FieldExpander handles it via the VIEW layer
          const fileStem = toPascalCase((metadata.fileName || '').replace(/\.[^/.]+$/, '')) || 'Data';
          const tableName = normalizeDataSourceName(dsName) + '_' + fileStem;
          resolve({ tableName, data: rows, fields, metadata: { ...metadata, rowCount: rows.length } });
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  },

  /** Load uploaded SQLite file — imports all tables */
async loadSQLiteFile(file, dsName, metadata) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const dbAlias = normalizeDataSourceName(dsName);
        
        // Try using SQL.js instead of AlaSQL's built-in SQLite
        // SQL.js is more reliable for SQLite files
        
        // Check if we need to load SQL.js
        if (typeof SQL === 'undefined') {
          await new Promise((resolveScript, rejectScript) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
            script.onload = resolveScript;
            script.onerror = () => rejectScript(new Error('Failed to load SQL.js'));
            document.head.appendChild(script);
          });
          
          // Initialize SQL.js
          const SQL_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/';
          window.SQL = await initSqlJs({
            locateFile: file => SQL_CDN + file
          });
        }
        
        const uInt8Array = new Uint8Array(arrayBuffer);
        const db = new SQL.Database(uInt8Array);
        
        // Get list of tables
        const tablesQuery = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        
        if (!tablesQuery || tablesQuery.length === 0 || !tablesQuery[0].values || tablesQuery[0].values.length === 0) {
          db.close();
          throw new Error('No tables found in SQLite database');
        }
        
        const tableNames = tablesQuery[0].values.map(row => row[0]);
        
        const results = [];
        
        for (const tName of tableNames) {
          // Get table data
          const dataQuery = db.exec(`SELECT * FROM "${tName}"`);
          
          if (!dataQuery || dataQuery.length === 0) {
            console.warn(`[SQLite] Table ${tName} is empty`);
            continue;
          }
          
          const columns = dataQuery[0].columns;
          const values = dataQuery[0].values;
          
          // Convert to array of objects
          const rows = values.map(row => {
            const obj = {};
            columns.forEach((col, i) => {
              obj[col] = row[i];
            });
            return obj;
          });
          
          // Get schema info
          const schemaQuery = db.exec(`PRAGMA table_info("${tName}")`);
          let fields;
          
          if (schemaQuery && schemaQuery.length > 0 && schemaQuery[0].values) {
            // schemaQuery[0].columns = ["cid", "name", "type", "notnull", "dflt_value", "pk"]
            fields = schemaQuery[0].values.map(col => {
              const colName = col[1]; // name
              const colType = (col[2] || '').toLowerCase(); // type
              
              let type = 'text';
              if (colType.includes('int')) type = 'number';
              else if (colType.includes('real') || colType.includes('float') || colType.includes('double')) type = 'number';
              else if (colType.includes('bool')) type = 'boolean';
              
              // Re-detect dates from data
              if ((type === 'text' || type === 'number') && rows.length > 0) {
                const detected = this.guessFieldType(colName, rows);
                if (detected === 'date') type = 'date';
              }
              
              return {
                internalName: colName,
                displayName: colName,
                alias: toPascalCase(colName) || colName,
                type,
                displayType: this.mapDisplayType(type)
              };
            });
          } else {
            // Fallback: infer from data
            fields = rows.length > 0 ? this.inferFieldTypes(rows) : [];
          }
          
          const cleanRows = this.removeODataColumns(rows);
          const tableName = normalizeDataSourceName(dsName) + '_' + (toPascalCase(tName) || tName);
          
          results.push({
            tableName,
            data: cleanRows,
            fields,
            metadata: { ...metadata, internalTableName: tName, rowCount: cleanRows.length }
          });
        }
        
        // Collect foreign key relationships across all tables
        const foreignKeys = [];
        for (const tName of tableNames) {
          try {
            const fkQuery = db.exec(`PRAGMA foreign_key_list("${tName}")`);
            if (fkQuery && fkQuery.length > 0 && fkQuery[0].values) {
              // columns: [id, seq, table, from, to, on_delete, on_update, match]
              for (const row of fkQuery[0].values) {
                foreignKeys.push({ fromTable: tName, fromCol: row[3], toTable: row[2], toCol: row[4] });
              }
            }
          } catch (_) {} // PRAGMA foreign_key_list not critical
        }

        db.close();

        if (results.length === 0) {
          throw new Error('No valid tables could be read from SQLite database');
        }

        if (foreignKeys.length > 0) console.log('[SQLite] Found', foreignKeys.length, 'foreign key(s)');
        resolve({ tables: results, foreignKeys });
        
      } catch (err) {
        reject(new Error('SQLite loading failed: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
},

  /* ============================================================
     FILE LOADING — REMOTE URLs
  ============================================================ */

  /**
   * Load a remote file from URL. Tries AlaSQL first, falls back to fetch+parse.
   * Returns: { tableName, data, fields, metadata } or { tables: [...] } for SQLite
   */
  async loadRemoteFile(url, dsName, fileType) {
    const metadata = {
      sourceType: fileType,
      fileName: url.split('/').pop() || ('remote.' + fileType),
      isFileUpload: false,
      url
    };
    try {
      return await this.loadWithAlaSQL(url, dsName, fileType, metadata);
    } catch (alasqlErr) {
      console.warn('[CyberdynePipeline] AlaSQL loading failed, trying fetch fallback:', alasqlErr.message);
      return await this.loadWithFetch(url, dsName, fileType, metadata);
    }
  },

  /** Try loading with AlaSQL built-in mechanisms */
async loadWithAlaSQL(url, dsName, fileType, metadata) {
  let rows;

  switch (fileType.toLowerCase()) {
    case 'tsv':
    case 'csv': {
      const sep = fileType === 'tsv' ? '\\t' : ',';
      try {
        rows = await alasql.promise(
          `SELECT * FROM CSV("${url}", {headers:true, separator:"${sep}"})`
        );
      } catch (e1) {
        try{
          // Retry without separator
         rows = await alasql.promise(
           `SELECT * FROM CSV("${url}", {headers:true})`
         );
        } catch (e2) {
          // Retry without headers
          rows = await alasql.promise(
            `SELECT * FROM CSV("${url}", {headers:false})`
          );
        }
      }
      break;
    }

    case 'json':
      rows = await alasql.promise(`SELECT * FROM JSON("${url}")`);
      break;

    case 'xlsx':
    case 'xls': {
      try{
        rows = await alasql.promise(
        `SELECT * FROM XLSX("${url}", {headers:true})`
        );
      } catch (e1) {
        try {
          // Retry without headers
          rows = await alasql.promise(
            `SELECT * FROM XLSX("${url}", {headers:false})`
          );
        } catch (e2) {
          // Retry with SHEET option to specify first sheet
          rows = await alasql.promise(
            `SELECT * FROM XLSX("${url}", {sheet:1, headers:true})`
          );
        }
      }
      break;
    }

    case 'xml':
      throw new Error('XML requires fetch fallback');

    case 'sqlite':
      throw new Error('SQLite requires fetch fallback');

    default:
      throw new Error('Unsupported file type for AlaSQL: ' + fileType);
  }


  if (!rows || rows.length === 0) throw new Error('AlaSQL returned no rows');

  rows = this.extractFromODataWrapper(rows);
  rows = this.removeODataColumns(rows);
  let fields = this.inferFieldTypes(rows);
  // No synthetic expansion — FieldExpander handles it via the VIEW layer
  const tableName = normalizeDataSourceName(dsName) + '_Data';

  return {
    tableName,
    data: rows,
    fields,
    metadata: { ...metadata, rowCount: rows.length }
  };
},


  /** Load remote file using fetch fallbacks */
  async loadWithFetch(url, dsName, fileType, metadata) {
    const tableName = normalizeDataSourceName(dsName) + '_Data';

    if (fileType === 'csv' || fileType === 'tsv') {
      const text = await fetchCSVWithFallbacks(url);
      const parsed = parseCSV(text);
      let rows = this.removeODataColumns(parsed.rows);
      let fields = this.inferFieldTypes(rows);
      // No synthetic expansion — FieldExpander handles it via the VIEW layer
      return { tableName, data: rows, fields, metadata: { ...metadata, rowCount: rows.length } };
    }

    if (fileType === 'json' || fileType === 'json5') {
      const jsonData = await fetchJSONWithFallbacks(url);
      let rows = this.extractFromODataWrapper(jsonData);
      rows = this.removeODataColumns(rows);
      let fields = this.inferFieldTypes(rows);
      // No synthetic expansion — FieldExpander handles it via the VIEW layer
      return { tableName, data: rows, fields, metadata: { ...metadata, rowCount: rows.length } };
    }

    // For binary formats: fetch as blob → File object → use uploaded file handlers
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], metadata.fileName, { type: blob.type });

    switch (fileType) {
      case 'xlsx': case 'xls': return await this.loadExcelFile(file, dsName, metadata);
      case 'xml':    return await this.loadXMLFile(file, dsName, metadata);
      case 'sqlite': return await this.loadSQLiteFile(file, dsName, metadata);
      default: throw new Error('Unsupported file type: ' + fileType);
    }
  },

  /* ============================================================
     XML HELPERS
  ============================================================ */

  /** Convert XML document to array of row objects */
  xmlToRows(xmlDoc) {
    const rows = [];
    const root = xmlDoc.documentElement;
    let rowElements = Array.from(root.children);
    if (rowElements.length === 1 && rowElements[0].children.length > 1) {
      rowElements = Array.from(rowElements[0].children);
    }
    for (const elem of rowElements) {
      const row = {};
      for (const attr of elem.attributes) row[attr.name] = attr.value;
      for (const child of elem.children) {
        row[child.tagName] = child.children.length === 0 ? child.textContent : this.xmlElementToObject(child);
      }
      if (Object.keys(row).length === 0) row['value'] = elem.textContent;
      rows.push(row);
    }
    return rows;
  },

  /** Recursively convert XML element to a plain object */
  xmlElementToObject(elem) {
    const obj = {};
    for (const attr of elem.attributes) obj[attr.name] = attr.value;
    for (const child of elem.children) {
      obj[child.tagName] = child.children.length === 0 ? child.textContent : this.xmlElementToObject(child);
    }
    return obj;
  }

}; // End CyberdynePipeline