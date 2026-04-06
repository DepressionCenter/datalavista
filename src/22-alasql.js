/* ============================================================
This file is part of DataLaVista™
22-alasql.js: AlaSQL in-browser SQL engine setup and custom functions.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-06
Summary: AlaSQL in-browser SQL engine setup and custom functions.
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
    // ALASQL SETUP
    // ============================================================
    function setupAlaSQL() {
      if (typeof alasql === 'undefined') return;

      // ── MAXDATE: string-safe MAX for dates and text ──────────────────────────
      const maxDateAggr = function (v, acc, stage) {
        if (stage === 1) return v;
        if (stage === 2) { if (!acc) return v; if (!v) return acc; return String(v) > String(acc) ? v : acc; }
        return acc;
      };
      const maxDateFunc = function (a, b) { if (b === undefined) return a; return String(a) > String(b) ? a : b; };
      alasql.aggr.MAXDATE = maxDateAggr;
      alasql.aggr.MAX = maxDateAggr;
      alasql.fn.MAXDATE = maxDateFunc;
      alasql.fn.MAX = maxDateFunc;

      // ── MINDATE: string-safe MIN for dates and text ──────────────────────────
      const minDateAggr = function (v, acc, stage) {
        if (stage === 1) return v;
        if (stage === 2) { if (!acc) return v; if (!v) return acc; return String(v) < String(acc) ? v : acc; }
        return acc;
      };
      const minDateFunc = function (a, b) { if (b === undefined) return a; return String(a) < String(b) ? a : b; };
      alasql.aggr.MINDATE = minDateAggr;
      alasql.aggr.MIN = minDateAggr;
      alasql.fn.MINDATE = minDateFunc;
      alasql.fn.MIN = minDateFunc;


      // ── SUM: coerce strings to numbers ──────────────────────────────────────
      alasql.aggr.SUM = function (v, acc, stage) {
        const num = parseFloat(v) || 0;
        if (stage === 1) return num;
        if (stage === 2) return (acc || 0) + num;
        return acc;
      };

      // ── LAST: not in AlaSQL natively (FIRST is, so we leave that alone) ────────
      if (!alasql.aggr.LAST) {
        alasql.aggr.LAST = function (v, acc, stage) {
          if (stage === 1) return v;
          if (stage === 2) return v;   // always overwrite with latest value
          return acc;
        };
      }

      alasql.fn.INCLUDES = function (lookupArray, itemKey) {
        // Return false if the array is invalid or the itemKey is missing
        if (!lookupArray || !Array.isArray(lookupArray) || itemKey == null) return false;

        const keyStr = itemKey.toString();

        // Safely check for Id, ID, or id using optional chaining (?.)
        return lookupArray.some(member =>
          member?.Id?.toString() === keyStr ||
          member?.ID?.toString() === keyStr ||
          member?.id?.toString() === keyStr
        );
      };

      // ── DLV_PROP: extract a named property from an object ──────────────────
      alasql.fn.DLV_PROP = function(obj, prop) {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object' || Array.isArray(obj)) return null;
        const v = obj[prop];
        return v !== undefined ? v : null;
      };

      // ── DLV_DISPLAY: human-readable display value from any field value ──────
      alasql.fn.DLV_DISPLAY = function(val) {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
        if (Array.isArray(val)) {
          const parts = val.map(v => {
            if (typeof v === 'object' && v !== null) {
              return v.Title || v.Label || v.Name || v.Value || v.lookupValue || JSON.stringify(v);
            }
            return v != null ? String(v) : null;
          }).filter(s => s != null && s !== '');
          return parts.length > 0 ? parts.join('; ') : null;
        }
        if (typeof val === 'object') {
          // Un-expanded SP deferred reference — no data available yet
          if (val.__deferred) return null;
          if (val.TermGuid !== undefined) return val.Label || val.Title || null;
          if (val.results && Array.isArray(val.results)) {
            const parts = val.results.map(r => r.Label || r.Title || r.Name || r.lookupValue || JSON.stringify(r)).filter(s => s);
            return parts.length > 0 ? parts.join('; ') : null;
          }
          // SP URL field: return the URL, not the Description
          if (val.Url !== undefined) return val.Url || null;
          return val.Title || val.Label || val.Name || val.lookupValue || val.Value || null;
        }
        return String(val);
      };

      // ── DLV_IDS: extract Id/ID from an array of objects, join with '; ' ─────
      alasql.fn.DLV_IDS = function(arr) {
        if (!Array.isArray(arr)) return null;
        const ids = arr.map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.Id !== undefined ? v.Id : (v.ID !== undefined ? v.ID : null);
          }
          return null;
        }).filter(id => id != null);
        return ids.length > 0 ? ids.join('; ') : null;
      };

      // ── DLV_JOIN: map array elements to a property and join with '; ' ────────
      alasql.fn.DLV_JOIN = function(arr, prop) {
        if (!Array.isArray(arr)) return null;
        const parts = arr.map(v => {
          if (typeof v === 'object' && v !== null) {
            if (prop) {
              const pv = v[prop];
              if (pv != null) return String(pv);
            }
            return v.Title || v.Label || v.Name || v.Value || v.lookupValue || JSON.stringify(v);
          }
          return v != null ? String(v) : null;
        }).filter(s => s != null && s !== '');
        return parts.length > 0 ? parts.join('; ') : null;
      };

      // ── DLV_EMAIL: extract email address from a SharePoint claims string ─────
      alasql.fn.DLV_EMAIL = function(claimsStr) {
        if (!claimsStr) return '';
        const match = String(claimsStr).match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        return match ? match[1] : '';
      };

      // ── DLV_EMAILS: extract emails from an array of SP user objects ──────────
      alasql.fn.DLV_EMAILS = function(arr) {
        if (!Array.isArray(arr)) return null;
        const emails = arr.map(v => {
          const name = (typeof v === 'object' && v !== null) ? (v.Name || '') : '';
          const match = name.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
          return match ? match[1] : null;
        }).filter(e => e);
        return emails.length > 0 ? emails.join('; ') : null;
      };

      // ── DLV_PICTURE_URL: build SP user photo URL from claims string ──────────
      alasql.fn.DLV_PICTURE_URL = function(claimsStr, siteBase) {
        if (!claimsStr) return '';
        const base = (siteBase || '..').replace(/\/$/, '');
        return `${base}/_layouts/15/userphoto.aspx?size=L&accountname=${encodeURIComponent(claimsStr)}`;
      };

      // ── DLV_NORMALIZE_DATE: normalize date strings to 'YYYY-MM-DD [HH:mm:ss]'─
      alasql.fn.DLV_NORMALIZE_DATE = function(val) {
        if (val === null || val === undefined || val === '') return val;
        const str = String(val).trim();
        // ISO with T separator: 2026-01-15T14:30:00Z or 2026-01-15T00:00:00
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
          let d = str.replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
          if (d.endsWith(' 00:00:00')) d = d.replace(' 00:00:00', '');
          return d;
        }
        // Already ISO date: 2026-01-15
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        // Already ISO datetime without T: 2026-01-15 14:30:00
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
          return str.endsWith(' 00:00:00') ? str.replace(' 00:00:00', '') : str;
        }
        // Oracle: 15-JAN-2026 or 15-JAN-26
        const ORACLE_MONTHS = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
        const oracleM = str.match(/^(\d{2})-([A-Z]{3})-(\d{2,4})$/i);
        if (oracleM) {
          const day = oracleM[1].padStart(2, '0');
          const mon = String(ORACLE_MONTHS[oracleM[2].toUpperCase()] || 1).padStart(2, '0');
          let yr = parseInt(oracleM[3], 10);
          if (yr < 100) yr += yr < 30 ? 2000 : 1900;
          return `${yr}-${mon}-${day}`;
        }
        // MM/DD/YYYY or M/D/YY
        const slashM = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (slashM) {
          let yr = parseInt(slashM[3], 10);
          if (yr < 100) yr += yr < 30 ? 2000 : 1900;
          const mon = String(slashM[1]).padStart(2, '0');
          const day = String(slashM[2]).padStart(2, '0');
          return `${yr}-${mon}-${day}`;
        }
        // Unix epoch (10 digits)
        if (/^\d{10}$/.test(str)) {
          const n = parseInt(str, 10);
          if (n > 946684800 && n < 9999999999) {
            let d = new Date(n * 1000).toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
            return d.endsWith(' 00:00:00') ? d.replace(' 00:00:00', '') : d;
          }
        }
        // Unix epoch ms (13 digits)
        if (/^\d{13}$/.test(str)) {
          const n = parseInt(str, 10);
          if (n > 946684800000 && n < 9999999999999) {
            let d = new Date(n).toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
            return d.endsWith(' 00:00:00') ? d.replace(' 00:00:00', '') : d;
          }
        }
        // Scientific notation epoch (e.g. 1.7116e+12 ms)
        if (/^\d+\.?\d*[eE][+-]?\d+$/.test(str)) {
          const n = parseFloat(str);
          if (n > 9.46e11 && n < 9.99e12) {
            let d = new Date(n).toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
            return d.endsWith(' 00:00:00') ? d.replace(' 00:00:00', '') : d;
          }
        }
        return val; // return original if no pattern matched
      };

      // ── DLV_TAX_LABELS: get taxonomy labels joined with '; ' ─────────────────
      alasql.fn.DLV_TAX_LABELS = function(val) {
        if (val === null || val === undefined) return null;
        if (Array.isArray(val)) {
          const labels = val.map(v => (typeof v === 'object' && v !== null) ? (v.Label || v.Term || v.Title || '') : String(v)).filter(l => l);
          return labels.length > 0 ? labels.join('; ') : null;
        }
        if (typeof val === 'object') {
          if (val.TermGuid !== undefined) return val.Label || val.Title || null;
          if (val.results && Array.isArray(val.results)) {
            const labels = val.results.map(r => r.Label || r.Term || r.Title || '').filter(l => l);
            return labels.length > 0 ? labels.join('; ') : null;
          }
        }
        return typeof val === 'string' ? val : null;
      };

      // ── DLV_TAX_IDS: get 'Label|TermGuid' strings joined with '; ' ──────────
      alasql.fn.DLV_TAX_IDS = function(val) {
        if (val === null || val === undefined) return null;
        if (Array.isArray(val)) {
          const ids = val.map(v => {
            if (typeof v === 'object' && v !== null) {
              const label = v.Label || v.Term || v.Title || '';
              const guid = v.TermGuid || v.WssId || '';
              return `${label}|${guid}`;
            }
            return String(v);
          }).filter(s => s && s !== '|');
          return ids.length > 0 ? ids.join('; ') : null;
        }
        if (typeof val === 'object' && val !== null) {
          if (val.TermGuid !== undefined) return `${val.Label || ''}|${val.TermGuid || ''}`;
          if (val.results && Array.isArray(val.results)) return alasql.fn.DLV_TAX_IDS(val.results);
        }
        return null;
      };

      // Safely parse strings to Booleans (handles SharePoint's "Yes"/"1"/etc.)
      alasql.fn.DLV_PARSE_BOOL = function(val) {
        if (val === null || val === undefined) return false;
        if (typeof val === 'boolean') return val;
        
        // Convert to string, trim, and lowercase for safe comparison
        const strVal = String(val).trim().toLowerCase();
        
        return strVal === 'yes' || strVal === '1' || strVal === 'true';
      };

      // Safely parse strings to Floats (strips commas/currency symbols)
      alasql.fn.DLV_PARSE_NUMBER = function(val) {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return val;
        
        // Convert to string, strip out everything except digits, minus signs, and decimals
        const cleanStr = String(val).replace(/[^0-9.-]+/g, '');
        const parsed = parseFloat(cleanStr);
        
        // Return null if invalid to prevent NaN from breaking SQL math aggregates
        return isNaN(parsed) ? null : parsed;
      };
    }

    // ── SELECT column helpers ────────────────────────────────────────────────────
    // Split a SELECT column list by commas, respecting parentheses (for functions)
    function splitSelectCols(str) {
      const cols = [];
      let depth = 0, cur = '';
      for (const ch of str) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) { cols.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      if (cur.trim()) cols.push(cur.trim());
      return cols;
    }

    // Extract the bare result-column name: AS alias > last .field > whole token
    function getBareColName(col) {
      const asMatch = col.match(/\bAS\s+\[?([\w]+)\]?\s*$/i);
      if (asMatch) return asMatch[1];
      const dotMatch = col.match(/\.[\["]?([\w]+)[\]"]?\s*$/);
      if (dotMatch) return dotMatch[1];
      return col.replace(/[\[\]"]/g, '').trim();
    }

    // Build a safe AS alias from a table.field expression
    function getAutoAlias(col) {
      const m = col.match(/[\["]?([\w]+)[\]"]?\.[\["]?([\w]+)[\]"]?/);
      if (m) return m[1] + '_' + m[2];
      return getBareColName(col);
    }

    /**
     * preprocessSQL — rewrites the SELECT clause so that duplicate bare column
     * names each get a unique AS alias (e.g. Citations_Title, AutomationsList_Title).
     * This prevents AlaSQL from silently overwriting one column with another when
     * two joined tables share a field name like "Title".
     */
    function preprocessSQL(sql) {
      // Only process plain SELECT statements
      const selectRe = /^(\s*SELECT\s+)([\s\S]+?)(\s+FROM\b)/i;
      const m = sql.match(selectRe);
      if (!m) return sql;

      const cols = splitSelectCols(m[2]);
      const bareNames = cols.map(getBareColName);

      // Count occurrences of each bare name (case-insensitive)
      const counts = {};
      for (const n of bareNames) counts[n.toLowerCase()] = (counts[n.toLowerCase()] || 0) + 1;

      // Rewrite only duplicates that don't already have an explicit AS alias
      let changed = false;
      const newCols = cols.map((col, i) => {
        const bare = bareNames[i];
        if (counts[bare.toLowerCase()] <= 1) return col;              // unique — leave alone
        if (/\bAS\s+\[?[\w]+\]?\s*$/i.test(col)) return col;         // already aliased
        changed = true;
        return col + ' AS [' + getAutoAlias(col) + ']';
      });

      if (!changed) return sql;
      // Re-assemble: keep everything before the SELECT col list and after it intact
      const selectKeyword = m[1];
      const rest = sql.slice(m[1].length + m[2].length);
      return selectKeyword + newCols.join(', ') + rest;
    }

    function extractEmail(claimsStr) {
      if (!claimsStr) return '';
      const match = claimsStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      return match ? match[1] : '';
    }

    // Map a raw data row into our internal format.
    // @deprecated Since view-layer refactor. Raw SP objects are now stored directly in
    // _raw_* tables and all transformation is handled by FieldExpander UDFs in the VIEW layer.
    // This function is kept for backward compatibility only.
    function mapDataRow(tableName, row, fieldDefs) {
      const mapped = {};
      const processingRow = { ...row };

      // PASS 1: Rich Objects (lookups, users, taxonomy, hyperlinks)
      for (const f of fieldDefs) {
        const key = f.InternalName || f.internalName;
        if (!key) continue;
        const _rawKey1 = key === 'Attachments' ? 'HasAttachments' : key;
        const outKey = toPascalCase(decodeSpFieldName(_rawKey1)) || _rawKey1;

        let value = processingRow[key];
        if (value === null || value === undefined) continue;

        const ts = (f.TypeAsString || '').toLowerCase();
        const ft = (f.type || '').toLowerCase();
        const isUser   = ts.includes('user')     || ft === 'user'       || ft === 'user-multi';
        const isTax    = ts.includes('taxonomy') || ft === 'taxkeyword' || key === 'TaxKeyword';
        const isLookup = ts.includes('lookup')   || ft === 'lookup'     || ft === 'lookup-multi';
        const isURL    = ts.includes('url') || ft === 'url';
        const isMulti  = ts.includes('multi') || ft.includes('multi') || ft === 'taxkeyword' || key === 'TaxKeyword';

        if (isLookup && !isMulti && typeof value === 'object' && !Array.isArray(value)) {
          mapped[outKey]          = value.Title || value.lookupValue || '';
          mapped[outKey + 'Id']   = value.Id;
          mapped[outKey + 'Data'] = [value];
          delete processingRow[key]; delete processingRow[key + 'Id'];
          continue;
        }

        if (isLookup && isMulti && Array.isArray(value)) {
          mapped[outKey]           = value.map(v => v.Title || v.lookupValue).join('; ');
          mapped[outKey + 'Ids']   = value.map(v => v.Id).join('; ');
          mapped[outKey + 'Data']  = value;
          delete processingRow[key]; delete processingRow[key + 'Id'];
          continue;
        }

        if (isUser && !isMulti && typeof value === 'object' && !Array.isArray(value)) {
          const _siteBase = (DataLaVistaState.tables[tableName] && DataLaVistaState.tables[tableName].siteUrl)
            ? DataLaVistaState.tables[tableName].siteUrl.replace(/\/$/, '')
            : '..';
          mapped[outKey]              = value.Title || value.Name || JSON.stringify(value);
          mapped[outKey + 'Id']       = value.Id;
          mapped[outKey + 'Claims']   = value.Name || '';
          mapped[outKey + 'Email']    = extractEmail(value.Name);
          mapped[outKey + 'PictureUrl'] = value.Name
            ? `${_siteBase}/_layouts/15/userphoto.aspx?size=L&accountname=${encodeURIComponent(value.Name)}`
            : '';
          mapped[outKey + 'Data']     = [value];
          delete processingRow[key]; delete processingRow[key + 'Id'];
          continue;
        }

        if (isUser && isMulti && Array.isArray(value)) {
          mapped[outKey]          = value.map(v => v.Title || v.Name).join('; ');
          mapped[outKey + 'Ids']  = value.map(v => v.Id).join('; ');
          mapped[outKey + 'Emails'] = value.map(v => extractEmail(v.Name)).filter(e => e).join('; ');
          mapped[outKey + 'Data'] = value;
          delete processingRow[key]; delete processingRow[key + 'Id'];
          continue;
        }

        if (isTax && !isMulti && typeof value === 'object' && !Array.isArray(value)) {
          mapped[outKey]          = value.Label;
          mapped[outKey + 'Id']   = `${value.Label}|${value.TermGuid}`;
          mapped[outKey + 'Data'] = [value];
          delete processingRow[key];
          continue;
        }

        if (isTax && isMulti && Array.isArray(value)) {
          mapped[outKey]          = value.map(v => v.Label).join('; ');
          mapped[outKey + 'Ids']  = value.map(v => `${v.Label}|${v.TermGuid}`).join('; ');
          mapped[outKey + 'Data'] = value;
          delete processingRow[key];
          continue;
        }

        if (isURL && typeof value === 'object' && value.Url) {
          mapped[outKey]                  = value.Url;
          mapped[outKey + 'Label']        = value.Description || '';
          mapped[outKey + 'Data']         = value;
          delete processingRow[key];
          continue;
        }
      }

      // PASS 2: Primitives — output key is the raw SP internalName
      for (const [key, value] of Object.entries(processingRow)) {
        if (value === null || value === undefined) continue;
        const _rawKey2 = key === 'Attachments' ? 'HasAttachments' : key;
        const outKey = toPascalCase(decodeSpFieldName(_rawKey2)) || _rawKey2;

        // Skip if already handled (e.g. lookup Id already written)
        if (outKey.endsWith('Id') && mapped[outKey.slice(0, -2)] !== undefined) continue;

        let finalVal = value;
        if (typeof finalVal === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/.test(finalVal)) {
          finalVal = finalVal.replace('T', ' ').replace('Z', '');
          if (/(Date|Fecha)$/i.test(outKey)) finalVal = finalVal.replace(/ 00:00:00$/, '');
        }

        if (Array.isArray(finalVal)) {
          mapped[outKey]          = finalVal.join('; ');
          mapped[outKey + 'Data'] = finalVal;
        } else if (typeof finalVal === 'object') {
          mapped[outKey]          = JSON.stringify(finalVal);
          mapped[outKey + 'Data'] = finalVal;
        } else {
          mapped[outKey] = finalVal;
        }
      }

      return mapped;
    }

