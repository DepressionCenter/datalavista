/* ============================================================
This file is part of DataLaVista™
24-normalization.js: Data normalization, field type parsing, and CSV parsing.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-4-06
Summary: Data normalization, field type parsing, and CSV parsing.
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
    // FIELD NORMALIZATION
    // ============================================================
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    function normalizeDate(val) {
      if (typeof val !== 'string') return val;
      if (ISO_DATE_RE.test(val)) {
        // Strip T and Z, truncate time if midnight
        let d = val.replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
        if (d.endsWith(' 00:00:00')) d = d.replace(' 00:00:00', '');
        return d;
      }
      return val;
    }

    function normalizeObject(val) {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') return normalizeDate(val);
      if (typeof val === 'number' || typeof val === 'boolean') return val;

      // Array of objects
      if (Array.isArray(val)) {
        return val.map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.Label || v.Title || v.Name || v.Value || v.lookupValue || JSON.stringify(v);
          }
          return v;
        }).join(', ');
      }

      // Single object
      if (typeof val === 'object') {
        // TaxKeyword / Enterprise Keywords
        if (val.TermGuid !== undefined) return val.Label || val.Title || '';
        if (val.results && Array.isArray(val.results)) {
          return val.results.map(r => r.Label || r.Title || r.Name || r.lookupValue || JSON.stringify(r)).join(', ');
        }
        return val.Label || val.Title || val.Name || val.lookupValue || val.Value || JSON.stringify(val);
      }
      return val;
    }

    // Normalize a single row of SharePoint data
    function normalizeRow(row, fields) {
      const out = {};
      for (const f of fields) {
        let val = row[f.internalName];
        if (val === undefined) val = row[f.internalName + 'Id'] !== undefined ? null : undefined;
        if (val === undefined) { out[f.alias] = null; continue; }

        // Lookup fields
        if (f.type === 'lookup') {
          const idVal = row[f.internalName + 'Id'];
          out[f.alias + 'Id'] = idVal !== undefined ? idVal : null;
          out[f.alias] = normalizeObject(val);
        }
        // Multi-lookup
        else if (f.type === 'lookup-multi') {
          const results = (val && val.results) ? val.results : (Array.isArray(val) ? val : []);
          const ids = row[f.internalName + 'Id'];
          const idResults = ids ? ((ids.results || ids) || []) : [];
          out[f.alias + 'Id'] = Array.isArray(idResults) ? idResults.join(',') : idResults;
          out[f.alias] = results.map(r => r.lookupValue || r.Label || r.Title || r.Name || String(r)).join(', ');
        }
        // TaxKeyword / Managed Metadata
        else if (f.type === 'taxkeyword') {
          const results = (val && val.results) ? val.results : (Array.isArray(val) ? val : (val ? [val] : []));
          out[f.alias + 'Id'] = results.map(r => r.WssId || r.TermGuid || '').join(',');
          out[f.alias] = results.map(r => r.Label || r.Term || r.Title || '').join(', ');
        }
        // Person/User fields
        else if (f.type === 'user') {
          const idVal = row[f.internalName + 'Id'];
          out[f.alias + 'Id'] = idVal !== undefined ? idVal : null;
          out[f.alias] = normalizeObject(val);
        }
        // Multi-user
        else if (f.type === 'user-multi') {
          const results = (val && val.results) ? val.results : (Array.isArray(val) ? val : []);
          const ids = row[f.internalName + 'Id'];
          const idResults = ids ? ((ids.results || ids) || []) : [];
          out[f.alias + 'Id'] = Array.isArray(idResults) ? idResults.join(',') : String(idResults);
          out[f.alias] = results.map(r => r.Title || r.Name || String(r)).join(', ');
        }
        // Choice/multi-choice
        else if (f.type === 'choice-multi') {
          const results = (val && val.results) ? val.results : (Array.isArray(val) ? val : (val ? [val] : []));
          out[f.alias] = results.join(', ');
        }
        // Date
        else if (
          f.type.startsWith('date') ||
          (f.type === 'calculated' && f.calculatedFieldType === 'date')
        ) {
          out[f.alias] = normalizeDate(val);
        }
        // Boolean
        else if (
            f.type.startsWith('bool') ||
            f.type.toLowerCase() === 'yesno' ||
            f.type.toLowerCase() === 'yes/no' ||
            (f.type === 'calculated' && f.calculatedFieldType === 'boolean')
            ) {
            out[f.alias] = (
              (typeof val === 'boolean' && val === true) ||
              (typeof val === 'string' && val.toString().toLowerCase() === 'yes') ||
              (typeof val === 'string' && val.toString().toLowerCase() === 'true') ||
              (typeof val === 'number' && val === 1) ||
              (typeof val === 'string' && val.toString() === '1')
            ) ? true : false;
        }
        // Default
        else {
          out[f.alias] = normalizeObject(val);
        }
      }
      return out;
    }

    // Parse SharePoint field type
    function parseFieldType(spType, internalName) {
      const t = (spType || '').toLowerCase();
      if (internalName === 'TaxKeyword' || t === 'taxonomyfieldtype') return 'taxkeyword';
      if (t === 'taxonomyfieldtypemulti') return 'taxkeyword';
      if (t === 'user') return 'user';
      if (t === 'usermulti') return 'user-multi';
      if (t === 'lookup') return 'lookup';
      if (t === 'lookupmulti') return 'lookup-multi';
      if (t === 'choice') return 'choice';
      if (t === 'multichoice') return 'choice-multi';
      if (t.startsWith('bool') || t === 'yesno' || t === 'yes/no') return 'boolean';
      if (t === 'number' || t === 'currency' || t === 'integer' || t === 'counter' || t === 'autoid' || t === 'float' || t === 'decimal' || t === 'bigint') return 'number';
      if (t === 'datetime' || t === 'date') return 'date';
      if (t === 'url' || t === 'hyperlink' || t === 'link') return 'url';
      if (t === 'calculated') return 'text';
      if (t === 'note' || t === 'html') return 'html';
      return 'text';
    }

    function fieldDisplayType(type) {
    const t = (type || '').toLowerCase();
    if (t === 'number' || t === 'currency' || t === 'integer' || t === 'counter' || t === 'autoid' || t === 'float' || t === 'decimal' || t === 'bigint') return 'number';
    if (t === 'date' || t === 'datetime') return 'date';
    if (t === 'bool' || t === 'boolean') return 'boolean';
    if (['lookup', 'lookup-multi', 'user', 'user-multi', 'taxkeyword'].includes(t)) return 'lookup';
    if (t === 'choice-multi') return 'array';
    if (t === 'choice') return 'text';
    return 'text';
}

    // Camel case conversion
    function toCamelCase(str) {
      return str
        .trim()
        .replace(/[^a-zA-Z0-9 _]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_([a-zA-Z])/g, (_, c) => c.toUpperCase())
        .replace(/^[^a-zA-Z_$]/, '_')
        .trim();
    }

    // Pascal case conversion (Upper Camel Case)
    function toPascalCase(str) {
      return str
        .trim()
        .replace(/[^a-zA-Z0-9 _]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_([a-zA-Z])/g, (_, c) => c.toUpperCase())
        .replace(/^[^a-zA-Z_$]/, '_')
        .replace(/^[a-z]/, (c) => c.toUpperCase())
        .trim();
    }

    /**
     * Decode SharePoint's _xNNNN_ hex-encoded characters in a field name.
     * e.g. "My_x0020_Field" → "My Field", "Cost_x0025_" → "Cost%"
     */
    function decodeSpFieldName(name) {
      if (!name) return name;
      return name.replace(/_x([0-9a-fA-F]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    /**
     * Strip the trailing "List" or "ListItem" suffix that SharePoint appends
     * to EntityTypeName values, e.g. "PeopleList" → "People".
     * Also strips the _x0020_ encoding: "My_x0020_List" → "My_x0020_"...
     * (we leave _x0020_ in place since it is the InternalName standard).
     */
    function stripEntityTypeNameSuffix(name) {
      if (!name) return name;
      // Remove trailing "ListItem" first (longer match), then "List"
      return name.replace(/ListItem$/, '').replace(/List$/, '') || name;
    }

    // Should we skip this field?
    function shouldSkipField(f) {
      const name = f.InternalName || '';
      if (name.startsWith('_')) return true;
      if (DataLaVistaCore.SKIP_FIELDS.has(name)) return true;
      if (f.Hidden || f.IsHidden) return true;
      const type = parseFieldType(f.TypeAsString, name);
      if (type === 'html' && name !== 'Comments' && name !== 'Body') return true;
      return false;
    }

    // Build field meta from SharePoint field definition
    function buildFieldMeta(spField) {
      // Use InternalName if available; fall back to Title then EntityTypeName
      const rawInternal = spField.InternalName || spField.EntityTypeName || spField.Title || '';
      // Strip "ListItem"/"List" suffix only when internal name was derived from EntityTypeName
      const internalName = spField.InternalName
        ? spField.InternalName
        : stripEntityTypeNameSuffix(rawInternal);

      const displayName = spField.Title || decodeSpFieldName(internalName);
      const description = spField.Description || '';
      const fieldType = (spField.TypeAsString && spField.TypeAsString=='Calculated' ? 'Calculated' : parseFieldType(spField.TypeAsString, internalName));
      const calculatedFieldType = (spField.CalculatedFieldTypeAsString ? parseFieldType(spField.CalculatedFieldTypeAsString, internalName) : null);

      // Build alias from display name (PascalCase, no spaces)
      let alias = toPascalCase(displayName);
      if (!alias || alias === internalName) alias = toPascalCase(decodeSpFieldName(internalName)) || internalName;

      return {
        internalName : internalName,
        displayName: displayName,
        description: description,
        alias: alias,
        type: fieldType,
        displayType: fieldDisplayType(calculatedFieldType || fieldType),
        calculatedFieldType: calculatedFieldType,
        required: spField.Required,
        maxLength: spField.MaxLength,
        choices: spField.Choices ? (spField.Choices.results || spField.Choices) : null,
        lookupList: (fieldType === 'lookup' || fieldType === 'lookup-multi') ? (spField.LookupList || null) : null,
        lookupField: (fieldType === 'lookup' || fieldType === 'lookup-multi') ? (spField.LookupField || null) : null,
      };
    }

    // Collect all SP fields needed for $select and $expand
    function getSelectFields(fields) {
      const sel = new Set(['ID', 'Title', 'Created', 'Modified',
        'Author/Id', 'Author/Title', 'Editor/Id', 'Editor/Title']);
      const exp = new Set(['Author', 'Editor']);
      for (const f of fields) {
        if (['lookup', 'user', 'lookup-multi', 'user-multi'].includes(f.type)) {
          sel.add(f.internalName + '/Id');
          sel.add(f.internalName + '/Title');
          exp.add(f.internalName);
        } else if (f.type === 'taxkeyword') {
          sel.add(f.internalName);
        } else {
          sel.add(f.internalName);
        }
      }
      return { select: [...sel], expand: [...exp] };
    }

    // ============================================================
    // CSV PARSING
    // ============================================================
    function parseCSV(text) {
      const lines = text.split('\n').filter(l => l.trim());
      if (!lines.length) return { headers: [], rows: [] };
      const parse = line => {
        const result = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
          else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
          else cur += c;
        }
        result.push(cur.trim());
        return result;
      };
      const headers = parse(lines[0]);
      const rows = lines.slice(1).map(l => {
        const vals = parse(l);
        const row = {};
        headers.forEach((h, i) => { row[h] = vals[i] !== undefined ? vals[i] : null; });
        return row;
      });
      return { headers, rows };
    }
