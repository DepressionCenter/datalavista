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

      /* OVERRIDES OF ALASQL FUNCTIONS */

      // ── GREATEST / MAX (scalar) and LEAST / MIN (scalar) ─────────────────────
      // ANSI SQL: skip NULLs; return NULL only if all arguments are NULL
      // Fixes incorrect null coercion and unreliable Date comparison in v4.17
      // Here for completness but these cannot be applied dynamically, only on compilation
      alasql.stdlib.GREATEST = alasql.stdlib.MAX = function () {
          var args = Array.prototype.slice.call(arguments);
          return '(function(){ ' +
              'var vals = [' + args.join(',') + '].filter(function(x){ return x !== null && typeof x !== "undefined"; }); ' +
              'if(!vals.length) return undefined; ' +
              'return vals.reduce(function(a,b){ ' +
                  'var av = a instanceof Date ? a.getTime() : a; ' +
                  'var bv = b instanceof Date ? b.getTime() : b; ' +
                  'return av > bv ? a : b; }); ' +
          '})()';
      };

      alasql.stdlib.LEAST = alasql.stdlib.MIN = function () {
          var args = Array.prototype.slice.call(arguments);
          return '(function(){ ' +
              'var vals = [' + args.join(',') + '].filter(function(x){ return x !== null && typeof x !== "undefined"; }); ' +
              'if(!vals.length) return undefined; ' +
              'return vals.reduce(function(a,b){ ' +
                  'var av = a instanceof Date ? a.getTime() : a; ' +
                  'var bv = b instanceof Date ? b.getTime() : b; ' +
                  'return av < bv ? a : b; }); ' +
          '})()';
      };

      alasql.aggr.DLV_MIN = function(v, acc, stage) {
  if (stage === 1) return v;
  if (stage === 2) {
    if (acc == null) return v; if (v == null) return acc;
    var vv = v   instanceof Date ? v.getTime()   : v;
    var av = acc instanceof Date ? acc.getTime() : acc;
    if (typeof vv === 'number' && typeof av === 'number') return vv < av ? v : acc;
    return String(v) < String(acc) ? v : acc;
  }
  return acc;
};
alasql.aggr.DLV_MAX = function(v, acc, stage) {
  if (stage === 1) return v;
  if (stage === 2) {
    if (acc == null) return v; if (v == null) return acc;
    var vv = v   instanceof Date ? v.getTime()   : v;
    var av = acc instanceof Date ? acc.getTime() : acc;
    if (typeof vv === 'number' && typeof av === 'number') return vv > av ? v : acc;
    return String(v) > String(acc) ? v : acc;
  }
  return acc;
};
alasql.fn.DLV_MIN = function(a, b) {
  if (a == null) return b; if (b == null) return a;
  var av = a instanceof Date ? a.getTime() : a;
  var bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === 'number' && typeof bv === 'number') return av < bv ? a : b;
  return String(a) < String(b) ? a : b;
};
alasql.fn.DLV_MAX = function(a, b) {
  if (a == null) return b; if (b == null) return a;
  var av = a instanceof Date ? a.getTime() : a;
  var bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === 'number' && typeof bv === 'number') return av > bv ? a : b;
  return String(a) > String(b) ? a : b;
};

      // ── VAR (sample variance) ─────────────────────────────────────────────────
      // ANSI SQL VAR_SAMP: return NULL for fewer than 2 non-null values
      // Fixes incorrect return of 0 in v4.17
      alasql.aggr.VAR = function (v, s, stage) {
          if (stage === 1) {
              return v === null ? {sum: 0, sumSq: 0, count: 0} : {sum: v, sumSq: v * v, count: 1};
          } else if (stage === 2) {
              if (v !== null) {
                  s.sum += v;
                  s.sumSq += v * v;
                  s.count++;
              }
              return s;
          } else {
              if (s.count > 1)
                  return (s.sumSq - (s.sum * s.sum) / s.count) / (s.count - 1);
              return undefined;
          }
      };

      // ── STDEV (sample standard deviation) ────────────────────────────────────
      // Removes duplicate definition present in v4.17; inherits VAR fix above
      alasql.aggr.STDEV = function (v, s, stage) {
          if (stage === 1 || stage === 2) {
              return alasql.aggr.VAR(v, s, stage);
          } else {
              return Math.sqrt(alasql.aggr.VAR(v, s, stage));
          }
      };

      // ── VARP (population variance) ────────────────────────────────────────────
      // ANSI SQL VAR_POP: skip NULLs; return NULL for empty set
      // Fixes missing null guards and incorrect return of 0 in v4.17
      alasql.aggr.VARP = function (value, accumulator, stage) {
          if (stage === 1) {
              if (value === null || value === undefined)
                  return {count: 0, sum: 0, sumSq: 0};
              return {count: 1, sum: value, sumSq: value * value};
          } else if (stage === 2) {
              if (value !== null && value !== undefined) {
                  accumulator.count++;
                  accumulator.sum += value;
                  accumulator.sumSq += value * value;
              }
              return accumulator;
          } else {
              if (accumulator.count === 0) return undefined;
              var mean = accumulator.sum / accumulator.count;
              return accumulator.sumSq / accumulator.count - mean * mean;
          }
      };

      // STDEVP, STD, STDDEV delegate to VARP and inherit the fix automatically
      alasql.aggr.STD =
          alasql.aggr.STDDEV =
          alasql.aggr.STDEVP =
              function (v, s, stage) {
                  if (stage === 1 || stage === 2) {
                      return alasql.aggr.VARP(v, s, stage);
                  } else {
                      return Math.sqrt(alasql.aggr.VARP(v, s, stage));
                  }
              };

      // ── QUART / QUART2 / QUART3 ───────────────────────────────────────────────
      // ANSI SQL PERCENTILE_CONT: linear interpolation; skip NULLs; return NULL for empty set
      // Fixes step-function behaviour, wrong formula, and missing null guards in v4.17
      alasql.aggr.QUART = function (v, s, stage, nth) {
          if (stage === 1) return (v === null || v === undefined) ? [] : [v];
          if (stage === 2) { if (v !== null && v !== undefined) s.push(v); return s; }
          if (!s.length) return undefined;
          nth = nth || 1;
          var r = s.slice().sort(function(a, b) { return a - b; });
          var n = r.length;
          var h = (nth / 4) * (n - 1);
          var hf = Math.floor(h);
          var frac = h - hf;
          if (frac === 0) return r[hf];
          return r[hf] + frac * (r[hf + 1] - r[hf]);
      };

      alasql.aggr.QUART2 = function (v, s, stage) {
          return alasql.aggr.QUART(v, s, stage, 2);
      };

      alasql.aggr.QUART3 = function (v, s, stage) {
          return alasql.aggr.QUART(v, s, stage, 3);
      };

      // ── LAST ──────────────────────────────────────────────────────────────────
      // Not available natively in alasql v4.17; only FIRST is available
      alasql.aggr.LAST = alasql.aggr.LAST || function (v, acc, stage) {
          if (stage === 1) return v;
          if (stage === 2) return v;
          return acc;
      };

      /* ENDS OVERRIDES OF ALASQL FUNCTIONS */

      
      // Return true if elementValue is included in lookupArray,
      // checking a specific property if elementName is provided.
      // If no elementName is given, checks if elementValue matches any Id/ID/id properties.
      // Useful for querying against SP multi-lookup or multi-user fields (array of objects).
      alasql.fn.DLV_INCLUDES = function (lookupArray, elementName, elementValue, operator = '=') {
        if (!lookupArray || !Array.isArray(lookupArray)) return false;

        const op = operator || '=';

        if (elementName != null && elementName !== '') {
            if (op === '=') {
                return lookupArray.some(member =>
                    member && member[elementName] != null &&
                    member[elementName] === elementValue
                );
            }
            return lookupArray.some(member =>
                member && member[elementName] != null &&
                sqlCompare(member[elementName], op, elementValue)
            );
        }

        // Fallback: check Id/ID/id (equality only makes sense here)
        const valueStr = elementValue != null ? elementValue.toString() : null;
        return lookupArray.some(member =>
            member?.Id?.toString() === valueStr ||
            member?.ID?.toString() === valueStr ||
            member?.id?.toString() === valueStr
        );
    };

    // DLV_ARRAY_INCLUDES is the canonical name; DLV_INCLUDES kept for backward compat with saved SQL.
    alasql.fn.DLV_ARRAY_INCLUDES = alasql.fn.DLV_INCLUDES;

    // Legacy wrapper — calls DLV_ARRAY_INCLUDES with no elementName (triggers Id/ID/id fallback).
    // TODO: Delete once all saved SQL is migrated off INCLUDES().
    alasql.fn.INCLUDES = function (lookupArray, itemKey) {
        return alasql.fn.DLV_ARRAY_INCLUDES(lookupArray, null, itemKey);
    };


      // ── DLV_PROP: extract a named property from an object ──────────────────
      alasql.fn.DLV_PROP = function(obj, prop) {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object' || Array.isArray(obj)) return null;
        const v = obj[prop];
        return v !== undefined ? v : null;
      };

      // ── DLV_ID_PROP: extract id from an object, trying Id → ID → id → Key → key ──
      alasql.fn.DLV_ID_PROP = function(obj) {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object' || Array.isArray(obj)) return null;
        for (const k of ['Id', 'ID', 'id', 'Key', 'key']) {
          if (obj[k] !== undefined) return obj[k];
        }
        return null;
      };

      // ── DLV_ARRAY_EMPTY: returns true if array is null, not an array, or has no elements ──
      alasql.fn.DLV_ARRAY_EMPTY = function (arr) {
          return !arr || !Array.isArray(arr) || arr.length === 0;
      };

      // ── DLV_VIEW: forces execution of a view for keywords like SEARCH that only operate on raw tables ─────────
      alasql.from.DLV_VIEW = function(viewName, opts, cb, idx, query) {
        let cols = '*';
        if (typeof opts === 'string') {
            try {
                const parsed = JSON.parse(opts);
                if (Array.isArray(parsed.columns) && parsed.columns.length > 0) {
                    cols = parsed.columns.join(', ');
                }
            } catch(e) {}
        }

        const results = alasql('SELECT ' + cols + ' FROM ' + viewName);
        if (cb) return cb(results, idx, query);
        return results;
    };


/**
 * DLV_UNNEST_LOOKUP - Table-valued function for AlaSQL v4.17
 *
 * Explodes a multi-select lookup column (array of {Id, Title} objects)
 * from a source table into a flat junction-style table.
 *
 * Usage in SQL:
 *   FROM DLV_UNNEST_LOOKUP("DepresCen_EventSummary", "AttendeesData")
 *
 * Returns rows with columns:
 *   _SourceID    — the ID (all caps) of the parent row
 *   _LookupId    — the Id from each object in the array (or NULL if array is empty)
 *   _LookupTitle — the Title from each object in the array (or NULL if array is empty)
 *
 * Behavior:
 *   - Parent rows with empty/null/missing arrays emit one row
 *     with _LookupId = NULL and _LookupTitle = NULL.
 *     This preserves LEFT JOIN semantics when starting FROM this table.
 *   - Only reads the ID column and the specified lookup column
 *     from the source table for memory efficiency.
 */
alasql.from.DLV_UNNEST_LOOKUP = function (tableName, opts, cb, idx, query) {
    let srcTableName, colName;

    if (typeof tableName === 'string' && typeof opts === 'string') {
        srcTableName = tableName;
        colName = opts;
    } else if (Array.isArray(tableName)) {
        srcTableName = tableName[0];
        colName = tableName[1];
    } else {
        throw new Error(
            'DLV_UNNEST_LOOKUP requires two parameters: table name and column name.\n' +
            'Usage: FROM DLV_UNNEST_LOOKUP("TableName", "ColumnName")'
        );
    }

    // Only fetch the two columns we need for memory efficiency
    var sourceData = alasql('SELECT [ID], [' + colName + '] FROM [' + srcTableName + ']');

    if (!sourceData || sourceData.length === 0) {
        if (cb) return cb([], idx, query);
        return [];
    }

    var rows = [];

    for (var i = 0; i < sourceData.length; i++) {
        var parentId = sourceData[i].ID;
        var lookupArray = sourceData[i][colName];

        if (Array.isArray(lookupArray) && lookupArray.length > 0) {
            for (var j = 0; j < lookupArray.length; j++) {
                rows.push({
                    _SourceID: parentId,
                    _LookupId: lookupArray[j].Id != null ? lookupArray[j].Id : null,
                    _LookupTitle: lookupArray[j].Title || null
                });
            }
        } else {
            // Placeholder row preserves parent in LEFT JOIN scenarios
            rows.push({
                _SourceID: parentId,
                _LookupId: null,
                _LookupTitle: null
            });
        }
    }

    if (cb) return cb(rows, idx, query);
    return rows;
};



/**
 * DLV_LOOKUP - Table-valued function for AlaSQL v4.17
 *
 * Returns the source table's scalar columns joined with the unnested
 * multi-select lookup column, producing a flat, query-ready result.
 *
 * Usage in SQL:
 *   FROM DLV_LOOKUP("DepresCen_EventSummary", "AttendeesData")
 *
 * Returns one row per lookup entry, with columns:
 *   _SourceID     — the ID of the source/parent row
 *   _LookupId     — the Id from each looked-up item (NULL if array was empty)
 *   _LookupTitle  — the Title from each looked-up item (NULL if array was empty)
 *   + every scalar column from the source table (excluding the lookup array column itself)
 *
 * Join patterns:
 *
 *   Direction A — "I have People, I want their Events via AttendeesData":
 *     FROM DepresCen_People p
 *     LEFT JOIN DLV_LOOKUP("DepresCen_EventSummary", "AttendeesData") e
 *       ON e._LookupId = p.ID
 *
 *   Direction B — "I have Events, I want their Attendees' details":
 *     FROM DepresCen_EventSummary e
 *     LEFT JOIN DLV_LOOKUP("DepresCen_EventSummary", "AttendeesData") a
 *       ON a._SourceID = e.ID
 *     LEFT JOIN DepresCen_People p ON p.ID = a._LookupId
 *
 *   Direction B simplified (if you only need lookup Id and Title):
 *     FROM DepresCen_EventSummary e
 *     LEFT JOIN DLV_LOOKUP("DepresCen_EventSummary", "AttendeesData") a
 *       ON a._SourceID = e.ID
 *     -- a._LookupId and a._LookupTitle are already available
 */
alasql.from.DLV_LOOKUP = function (tableName, opts, cb, idx, query) {
    var srcTableName, colName;

    if (typeof tableName === 'string' && typeof opts === 'string') {
        srcTableName = tableName;
        colName = opts;
    } else if (Array.isArray(tableName)) {
        srcTableName = tableName[0];
        colName = tableName[1];
    } else {
        throw new Error(
            'DLV_LOOKUP requires two parameters: table name and column name.\n' +
            'Usage: FROM DLV_LOOKUP("TableName", "LookupColumnName")'
        );
    }

    // Fetch all rows but we will selectively copy scalar columns only
    var sourceData = alasql('SELECT * FROM [' + srcTableName + ']');

    if (!sourceData || sourceData.length === 0) {
        if (cb) return cb([], idx, query);
        return [];
    }

    // Identify scalar column names from the first row, excluding:
    //   - the lookup column itself (array of objects)
    //   - any other column whose value is a non-null object/array
    //     (i.e., other multi-select lookup columns)
    var firstRow = sourceData[0];
    var scalarKeys = [];
    for (var key in firstRow) {
        if (!firstRow.hasOwnProperty(key)) continue;
        if (key === colName) continue;
        var val = firstRow[key];
        if (val !== null && typeof val === 'object') continue;
        scalarKeys.push(key);
    }

    var rows = [];

    for (var i = 0; i < sourceData.length; i++) {
        var parentRow = sourceData[i];
        var parentId = parentRow.ID;
        var lookupArray = parentRow[colName];

        if (Array.isArray(lookupArray) && lookupArray.length > 0) {
            for (var j = 0; j < lookupArray.length; j++) {
                var row = {
                    _SourceID: parentId,
                    _LookupId: lookupArray[j].Id != null ? lookupArray[j].Id : null,
                    _LookupTitle: lookupArray[j].Title || null
                };
                for (var k = 0; k < scalarKeys.length; k++) {
                    row[scalarKeys[k]] = parentRow[scalarKeys[k]];
                }
                rows.push(row);
            }
        } else {
            var row = {
                _SourceID: parentId,
                _LookupId: null,
                _LookupTitle: null
            };
            for (var k = 0; k < scalarKeys.length; k++) {
                row[scalarKeys[k]] = parentRow[scalarKeys[k]];
            }
            rows.push(row);
        }
    }

    if (cb) return cb(rows, idx, query);
    return rows;
};


/**
 * MODE - Aggregate function for AlaSQL v4.17
 *
 * Returns the most frequently occurring non-NULL value in a group.
 * Ties are broken by returning the smallest value (per ANSI SQL:2023
 * ISO/IEC 9075-2:2023 inverse distribution function semantics).
 * NULL inputs are ignored per standard aggregate NULL-handling.
 * 
 * Note: There's a subtlety in v4.17: in stage 2,
 * the accumulator variable name in the function signature
 * is what carries state. This accounts for that.
 *
 * Usage in SQL:
 *   SELECT MODE(column) FROM table GROUP BY ...
 */
alasql.aggr.MODE = function (value, accumulator, stage) {
    if (stage === 1) {
        var acc = { counts: Object.create(null), values: [] };
        if (value != null) {
            var key = String(value);
            acc.counts[key] = 1;
            acc.values.push(value);
        }
        return acc;
    } else if (stage === 2) {
        if (value != null) {
            var key = String(value);
            if (accumulator.counts[key] == null) {
                accumulator.counts[key] = 1;
                accumulator.values.push(value);
            } else {
                accumulator.counts[key]++;
            }
        }
        return accumulator;
    } else if (stage === 3) {
        var counts = accumulator.counts;
        var values = accumulator.values;
        var maxCount = 0;
        var candidates = [];

        for (var i = 0; i < values.length; i++) {
            var key = String(values[i]);
            var count = counts[key];
            if (count > maxCount) {
                maxCount = count;
                candidates = [values[i]];
            } else if (count === maxCount) {
                candidates.push(values[i]);
            }
        }

        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        candidates.sort(function (a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });
        return candidates[0];
    }
};



/**
 * DLV_ARRAY_EXTRACT_ELEMENT
 * Extracts a single field from all objects in an array column — flat, distinct, sorted.
 *
 * @param {string} tableName - Table or view name
 * @param {string} opts      - JSON string with options (all required):
 *   @param {string} opts.columnToExpand - Column containing array of objects
 *   @param {string} opts.element        - Field name to extract from each child object
 *
 * Output columns: one column named after opts.element, distinct values, sorted ascending
 *
 * Usage:
 *   SELECT * FROM DLV_ARRAY_EXTRACT_ELEMENT("MyTable", '{"columnToExpand":"RecipientData","element":"Title"}')
 */
alasql.from.DLV_ARRAY_EXTRACT_ELEMENT = function(tableName, opts, cb, idx, query) {
    let columnToExpand = null, elementName = null;

    if (typeof opts === 'string') {
        try {
            const parsed = JSON.parse(opts);
            columnToExpand = parsed.columnToExpand || null;
            elementName    = parsed.element        || null;
        } catch(e) {}
    }

    if (!tableName || !columnToExpand || !elementName) {
        if (cb) return cb([], idx, query);
        return [];
    }

    const data = alasql(
        'SELECT ' + columnToExpand + ' FROM ' + tableName +
        ' WHERE ' + columnToExpand + ' IS NOT NULL AND ' + columnToExpand + '->length > 0'
    );
    const seen = new Set();
    const results = [];

    data.forEach(row => {
        const arr = row[columnToExpand];
        if (Array.isArray(arr) && arr.length > 0) {
            arr.forEach(child => {
                const val = child[elementName];
                if (val !== undefined && val !== null && !seen.has(val)) {
                    seen.add(val);
                    results.push({ [elementName]: val });
                }
            });
        }
    });

    results.sort((a, b) => {
        const av = a[elementName], bv = b[elementName];
        return av < bv ? -1 : av > bv ? 1 : 0;
    });

    if (cb) return cb(results, idx, query);
    return results;
};

      // ── Shared label extractor used by DLV_DISPLAY and DLV_JOIN ─────────────
      const _dlvLabel = o =>
        o.Title || o.Label || o.Name || o.name || o.Value || o.value ||
        o.lookupValue || o.LookupValue || o.displayValue || o.DisplayValue || null;

      // ── DLV_DISPLAY: human-readable display value from any field value ──────
      alasql.fn.DLV_DISPLAY = function(val) {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
        if (Array.isArray(val)) {
          const parts = val.map(v => {
            if (typeof v === 'object' && v !== null) return _dlvLabel(v) || JSON.stringify(v);
            return v != null ? String(v) : null;
          }).filter(s => s != null && s !== '');
          return parts.length > 0 ? parts.join('; ') : null;
        }
        if (typeof val === 'object') {
          if (val.__deferred) return null;
          if (val.TermGuid !== undefined) return val.Label || val.Title || null;
          if (val.results && Array.isArray(val.results)) {
            const parts = val.results.map(r => _dlvLabel(r) || JSON.stringify(r)).filter(s => s);
            return parts.length > 0 ? parts.join('; ') : null;
          }
          if (val.Url !== undefined) return val.Url || null;
          return _dlvLabel(val) || JSON.stringify(val);
        }
        return String(val);
      };

      // ── DLV_IDS: extract Id/ID from an array of objects, join with '; ' ─────
      alasql.fn.DLV_IDS = function(arr) {
        if (!Array.isArray(arr)) return null;
        const ids = arr.map(v => {
          if (typeof v === 'object' && v !== null) {
            const id = v.Id !== undefined ? v.Id
                     : v.ID !== undefined ? v.ID
                     : v.id !== undefined ? v.id
                     : v.Key !== undefined ? v.Key
                     : v.key !== undefined ? v.key
                     : null;
            return id;
          }
          return null;
        }).filter(id => id != null);
        return ids.length > 0 ? ids : null;
      };

      // ── DLV_JOIN: map array elements to a property and join with separator ('; ' by default)
      alasql.fn.DLV_JOIN = function(arr, prop, separator = '; ') {
        if (!Array.isArray(arr)) return null;
        const parts = arr.map(v => {
          if (typeof v === 'object' && v !== null) {
            if (prop) { const pv = v[prop]; if (pv != null) return String(pv); }
            return _dlvLabel(v) || JSON.stringify(v);
          }
          return v != null ? String(v) : null;
        }).filter(s => s != null && s !== '');
        return parts.length > 0 ? parts.join(separator) : null;
      };

      // ── DLV_KEYS: return the keys of an object (or array of objects) joined with '; ' ─
      // Single object: DLV_KEYS(obj, separator)
      // Array of objects: DLV_KEYS(arr, sampleSize) — scans first N objects, returns union of unique keys
      alasql.fn.DLV_KEYS = function(obj, separatorOrN = '; ') {
        if (!obj) return null;
        if (Array.isArray(obj)) {
          const n   = typeof separatorOrN === 'number' ? separatorOrN : 100;
          const sep = typeof separatorOrN === 'string'  ? separatorOrN : '; ';
          const keys = new Set();
          for (let i = 0; i < Math.min(obj.length, n); i++) {
            if (obj[i] && typeof obj[i] === 'object' && !Array.isArray(obj[i]))
              Object.keys(obj[i]).forEach(k => keys.add(k));
          }
          return keys.size > 0 ? [...keys].join(sep) : null;
        }
        if (typeof obj !== 'object') return null;
        const keys = Object.keys(obj);
        return keys.length > 0 ? keys.join(typeof separatorOrN === 'string' ? separatorOrN : '; ') : null;
      };

      // ── DLV_ARRAY_AGG: aggregate values of a named field from an array of objects ──
      // Usage: DLV_ARRAY_AGG(array, fieldName, aggType)
      // aggType: 'GROUP_CONCAT' | 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'SUM_SQ' | 'MIN' | 'MAX' | 'AVG'
      // Returns a scalar — useful for aggregating local (non-SP) arrays without any JOIN.
      alasql.fn.DLV_ARRAY_AGG = function(arr, fieldName, aggType = 'GROUP_CONCAT') {
        if (!arr || !Array.isArray(arr) || !fieldName) return null;
        const vals = arr
          .map(el => (el && typeof el === 'object' ? el[fieldName] : undefined))
          .filter(v => v != null);
        if (!vals.length) return (aggType === 'COUNT' || aggType === 'COUNT_DISTINCT') ? 0 : null;
        switch ((aggType || '').toUpperCase()) {
          case 'GROUP_CONCAT':   return vals.join(';');
          case 'COUNT':          return vals.length;
          case 'COUNT_DISTINCT': return new Set(vals.map(String)).size;
          case 'SUM':            return vals.reduce((s, v) => s + Number(v), 0);
          case 'SUM_SQ':         return vals.reduce((s, v) => s + Number(v) * Number(v), 0);
          case 'MIN':            return vals.reduce((m, v) => (v < m ? v : m), vals[0]);
          case 'MAX':            return vals.reduce((m, v) => (v > m ? v : m), vals[0]);
          case 'AVG':            return vals.reduce((s, v) => s + Number(v), 0) / vals.length;
          default:               return vals.join(';');
        }
      };

      // ── DLV_ARRAY_MATCH: filter scalar arrays with a comparison operator ──────────
      // e.g. DLV_ARRAY_MATCH(Tags, '=', 'Urgent')
      //      DLV_ARRAY_MATCH(Scores, '>=', 90)
      alasql.fn.DLV_ARRAY_MATCH = function (arr, operator, value, value2) {
        if (!arr || !Array.isArray(arr)) return false;
        try {
          if (operator === 'BETWEEN') {
            if (value == null || value2 == null) return false;
            return arr.some(item => sqlCompare(item, '>=', value) && sqlCompare(item, '<=', value2));
          }
          if (operator === 'contains') {
            if (value == null) return false;
            const needle = String(value);
            return arr.some(item => {
              const s = String(item);
              const needleNum = Number(needle);
              return s === needle || (!isNaN(item) && !isNaN(needleNum) && Number(item) === needleNum);
            });
          }
          return arr.some(item => sqlCompare(item, operator, value));
        } catch (e) { return false; }
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
        return emails.length > 0 ? emails : null;
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

      // ── DLV_DATE_PART: extract a named part from a normalised date string ───────
      // Expects val to already be in 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss' format
      // (i.e. pre-processed by DLV_NORMALIZE_DATE).  In SQL: DLV_DATE_PART(DLV_NORMALIZE_DATE(col), 'part')
      // Parts: 'date', 'time', 'year', 'yearText', 'fiscalYear',
      //        'month', 'monthText', 'monthName', 'day', 'dayName', 'hour', 'hourText'
      alasql.fn.DLV_DATE_PART = function(val, part) {
        if (val === null || val === undefined || val === '') return null;
        const norm = String(val);
        if (!norm) return null;

        const spaceIdx = norm.indexOf(' ');
        const datePart = spaceIdx >= 0 ? norm.substring(0, spaceIdx) : norm;
        const timePart = spaceIdx >= 0 ? norm.substring(spaceIdx + 1) : null;

        const [yr, mo, dy] = datePart.split('-').map(Number);
        const hr = timePart ? parseInt(timePart, 10) : 0;

        const MONTH_NAMES = ['January','February','March','April','May','June',
                             'July','August','September','October','November','December'];
        const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        switch (part) {
          case 'date':      return datePart;
          case 'time':      return timePart ? norm : norm + ' 00:00:00';
          case 'year':      return yr;
          case 'yearText':  return String(yr);
          case 'fiscalYear': {
            const fyStart = (DataLaVistaState.FiscalYearStartMonth || 7);
            const startYr = mo >= fyStart ? yr : yr - 1;
            return 'FY' + startYr + '-' + (startYr + 1);
          }
          case 'month':     return mo;
          case 'monthText': return String(mo).padStart(2, '0');
          case 'monthName': return MONTH_NAMES[mo - 1] || null;
          case 'day': {
            // getDay() is 0=Sun…6=Sat; spec wants Sunday=1
            const dow = new Date(yr, mo - 1, dy).getDay();
            return dow + 1;
          }
          case 'dayName':   return DAY_NAMES[new Date(yr, mo - 1, dy).getDay()];
          case 'hour':      return hr;
          case 'hourText':  return String(hr).padStart(2, '0');
          default:          return null;
        }
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
          return ids.length > 0 ? ids : null;
        }
        if (typeof val === 'object' && val !== null) {
          if (val.TermGuid !== undefined) return [`${val.Label || ''}|${val.TermGuid || ''}`];
          if (val.results && Array.isArray(val.results)) return alasql.fn.DLV_TAX_IDS(val.results);
        }
        return null;
      };

      // ── DLV_TAX_LABELS_ONLY: return array of label strings (no TermGuid) ─────
      alasql.fn.DLV_TAX_LABELS_ONLY = function(val) {
        if (val === null || val === undefined) return null;
        if (Array.isArray(val)) {
          const labels = val.map(v => (typeof v === 'object' && v !== null) ? (v.Label || v.Term || v.Title || '') : String(v)).filter(l => l);
          return labels.length > 0 ? labels : null;
        }
        if (typeof val === 'object') {
          if (val.TermGuid !== undefined) {
            const l = val.Label || val.Title;
            return l ? [l] : null;
          }
          if (val.results && Array.isArray(val.results)) return alasql.fn.DLV_TAX_LABELS_ONLY(val.results);
        }
        return typeof val === 'string' ? [val] : null;
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

      // ── MEDIAN: type-safe median (numeric or lexicographic sort) ─────────────
      // Overrides AlaSQL built-in to support dates and text strings.
      alasql.aggr.MEDIAN = function(v, s, stage) {
        if (stage === 1) { s = []; if (v != null) s.push(v); return s; }
        if (stage === 2) { if (v != null) s.push(v); return s; }
        if (!s || !s.length) return null;
        const allNum = s.every(x => !isNaN(Number(x)));
        const sorted = allNum
          ? [...s].sort((a, b) => Number(a) - Number(b))
          : [...s].sort((a, b) => String(a).localeCompare(String(b)));
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0 && allNum)
          return (Number(sorted[mid - 1]) + Number(sorted[mid])) / 2;
        return sorted[mid];
      };

      // ── CV: coefficient of variation (population) ────────────────────────────
      alasql.aggr.CV = function(v, s, stage) {
        if (stage === 1) { s = { sum: 0, sumSq: 0, n: 0 }; }
        if (stage <= 2 && v != null) {
          const x = Number(v);
          if (!isNaN(x)) { s.sum += x; s.sumSq += x * x; s.n++; }
          return s;
        }
        if (!s || !s.n) return null;
        const mean = s.sum / s.n;
        const stdev = Math.sqrt(Math.max(0, s.sumSq / s.n - mean * mean));
        return mean !== 0 ? stdev / mean : null;
      };

      // ── DLV_SQRT: safe square root (returns 0 for negatives/null) ───────────
      alasql.fn.DLV_SQRT = function(x) { return (x != null && x > 0) ? Math.sqrt(x) : 0; };

      // ── DLV_POW2: square a value ─────────────────────────────────────────────
      alasql.fn.DLV_POW2 = function(x) { return (x != null) ? x * x : null; };

      // ── DLV_MERGE_LIST: merge semicolon-joined strings → deduped sorted list ─
      alasql.aggr.DLV_MERGE_LIST = function(v, s, stage) {
        if (stage === 1) { s = new Set(); }
        if (stage <= 2 && v != null)
          String(v).split(';').forEach(x => { const t = x.trim(); if (t) s.add(t); });
        if (stage === 3) return (s && s.size) ? [...s].sort().join('; ') : null;
        return s;
      };

      // ── DLV_MERGE_COUNT_DISTINCT: count unique values across merged strings ──
      alasql.aggr.DLV_MERGE_COUNT_DISTINCT = function(v, s, stage) {
        if (stage === 1) { s = new Set(); }
        if (stage <= 2 && v != null)
          String(v).split(';').forEach(x => { const t = x.trim(); if (t) s.add(t); });
        if (stage === 3) return (s && s.size) ? s.size : 0;
        return s;
      };

      // ── DLV_MERGE_MEDIAN: median over merged semicolon-string values ─────────
      alasql.aggr.DLV_MERGE_MEDIAN = function(v, s, stage) {
        if (stage === 1) { s = []; }
        if (stage <= 2 && v != null)
          String(v).split(';').forEach(x => { const t = x.trim(); if (t) s.push(t); });
        if (stage === 3) {
          if (!s || !s.length) return null;
          const allNum = s.every(x => !isNaN(Number(x)));
          const sorted = allNum
            ? [...s].sort((a, b) => Number(a) - Number(b))
            : [...s].sort((a, b) => a.localeCompare(b));
          const mid = Math.floor(sorted.length / 2);
          if (sorted.length % 2 === 0 && allNum)
            return (Number(sorted[mid - 1]) + Number(sorted[mid])) / 2;
          return sorted[mid];
        }
        return s;
      };

      // ── DLV_MERGE_MODE: most frequent value across merged semicolon strings ──
      alasql.aggr.DLV_MERGE_MODE = function(v, s, stage) {
        if (stage === 1) { s = {}; }
        if (stage <= 2 && v != null)
          String(v).split(';').forEach(x => { const t = x.trim(); if (t) { s[t] = (s[t] || 0) + 1; } });
        if (stage === 3) {
          const entries = Object.entries(s || {});
          if (!entries.length) return null;
          return entries.reduce((best, cur) => cur[1] > best[1] ? cur : best, entries[0])[0];
        }
        return s;
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
      // Rewrite MIN/MAX → DLV_MIN/DLV_MAX so string-safe aggregates are used.
      // Word boundary prevents double-rewriting DLV_MIN/DLV_MAX.
      // Applied globally so subqueries (DLV_LOOKUP rollup, etc.) are also covered.
      // TODO: Remove this once mainstream alasql fixes MIN/MAX issues.
      sql = sql.replace(/\bMIN\s*\(/gi, 'DLV_MIN(').replace(/\bMAX\s*\(/gi, 'DLV_MAX(');
      
      // Only process plain SELECT statements
      // TODO: Why this restriction? Can we safely handle more complex queries (e.g. with CTEs, subqueries, unions) by applying this logic to each SELECT clause?
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

