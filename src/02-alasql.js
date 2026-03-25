/* ============================================================
This file is part of DataLaVista
02-alasql.js: AlaSQL in-browser SQL engine setup and custom functions.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-03-24
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
    // OUTPUT KEYS ARE ALWAYS internalName (so SQL "SELECT [table].[InternalName]" works).
    // The SQL query builder adds "AS [fieldAlias]" to give result columns friendly names.
    function mapDataRow(tableName, row, fieldDefs) {
      const mapped = {};
      const processingRow = { ...row };

      // PASS 1: Rich Objects (lookups, users, taxonomy, hyperlinks)
      for (const f of fieldDefs) {
        const key = f.InternalName || f.internalName;
        if (!key) continue;
        // Output key is ALWAYS the internalName — SQL references internalName
        const outKey = key === 'Attachments' ? 'HasAttachments' : key;

        let value = processingRow[key];
        if (value === null || value === undefined) continue;

        const ts = (f.TypeAsString || '').toLowerCase();
        const ft = (f.type || '').toLowerCase();
        const isUser   = ts.includes('user')     || ft === 'user'       || ft === 'user-multi';
        const isTax    = ts.includes('taxonomy') || ft === 'taxkeyword' || key === 'TaxKeyword';
        const isLookup = ts.includes('lookup')   || ft === 'lookup'     || ft === 'lookup-multi';
        const isURL    = ts.includes('url');
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
          const _siteBase = (state.tables[tableName] && state.tables[tableName].siteUrl)
            ? state.tables[tableName].siteUrl.replace(/\/$/, '')
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
          mapped[outKey + 'Description']  = value.Description || '';
          mapped[outKey + 'Url']          = value.Url;
          delete processingRow[key];
          continue;
        }
      }

      // PASS 2: Primitives — output key is the raw SP internalName
      for (const [key, value] of Object.entries(processingRow)) {
        if (value === null || value === undefined) continue;
        const outKey = key === 'Attachments' ? 'HasAttachments' : key;

        // Skip if already handled (e.g. lookup Id already written)
        if (key.endsWith('Id') && mapped[key.slice(0, -2)] !== undefined) continue;

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

