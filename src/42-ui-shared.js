/* ============================================================
This file is part of DataLaVista™
42-ui-shared.js: Shared UI rendering helpers for condition rows, sort rows, and aggregate popups.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-04-07
Last Modified: 2026-04-07
Summary: Centralizes renderConditionRows, renderSortRows, and showAggPopup so that all callers
         (basic QB, advanced QB, widget properties panel, series advanced properties modal)
         use identical rendering logic and pick up the same operators / date macros.
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
// SHARED CONDITION-ROW RENDERER
// ============================================================
/**
 * Returns an HTML string for a list of filter condition rows.
 *
 * @param {Array}    conditions   Array of {conj, field, op, value, value2?, elementKey?}
 * @param {Array}    cols         Column options — string alias OR
 *                                {alias, displayType, tableKey?, fieldInternalName?}
 * @param {Function} conjJS       (ci, jsValExpr) => string   inline JS for conjunction change
 * @param {Function} fieldJS      (ci, jsValExpr) => string   inline JS for field change
 * @param {Function} opJS         (ci, jsValExpr) => string   inline JS for op change
 * @param {Function} valJS        (ci, jsValExpr) => string   inline JS for value change
 * @param {Function} removeJS     (ci) => string              inline JS for remove click
 * @param {Function} [rowAttrs]   (ci) => string              optional extra attrs on the row div
 * @param {Function} [val2JS]     (ci, jsValExpr) => string   inline JS for BETWEEN second value
 * @param {Function} [elementKeyJS] (ci, jsValExpr) => string inline JS for object/array element key change
 */
function renderConditionRows(conditions, cols, conjJS, fieldJS, opJS, valJS, removeJS, rowAttrs, val2JS, elementKeyJS) {
  if (!conditions.length)
    return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No filters — click + Add</div>';

  cols = [...cols].sort((a, b) => {
    const aliasA = (typeof a === 'string' ? a : a.alias).toLowerCase();
    const aliasB = (typeof b === 'string' ? b : b.alias).toLowerCase();
    return aliasA.localeCompare(aliasB);
  });
  return conditions.map((c, ci) => {
    // ── resolve column metadata ──────────────────────────────────────────────
    const colMeta          = cols.find(col => (typeof col === 'string' ? col : col.alias) === c.field);
    const rawDisplayType   = (colMeta && typeof colMeta === 'object') ? (colMeta.displayType || 'text') : sniffType(c.field);
    const tableKey         = (colMeta && typeof colMeta === 'object') ? (colMeta.tableKey         || '') : '';
    const fieldInternalName= (colMeta && typeof colMeta === 'object') ? (colMeta.fieldInternalName || '') : '';

    // ── classify display type ─────────────────────────────────────────────────
    const info = classifyDisplayType(rawDisplayType, tableKey, fieldInternalName, c.field);
    const { baseType, isObject, isArrayObjects, isArrayScalar, scalarType, objectKeys } = info;

    // ── element key handling (object / array-of-objects) ──────────────────────
    const needsElementKey  = (isObject || isArrayObjects) && objectKeys && objectKeys.length > 0;
    const selectedElemKey  = c.elementKey || (objectKeys && objectKeys.length ? objectKeys[0].key : '');
    const elemKeyMeta      = objectKeys ? objectKeys.find(k => k.key === selectedElemKey) : null;
    const elemType         = elemKeyMeta ? elemKeyMeta.type : 'text';

    // ── build ops for this condition ──────────────────────────────────────────
    let ops;
    if (needsElementKey) {
      ops = getFilterOps(elemType, { forArrayElement: isArrayObjects });
      if (isArrayObjects) {
        ops = [...ops,
          { val: 'ARR_EMPTY',     label: 'is empty',     noInput: true },
          { val: 'ARR_NOT_EMPTY', label: 'is not empty', noInput: true },
        ];
      }
    } else if (isArrayScalar) {
      ops = getArrayScalarOps(scalarType || 'text');
    } else if (baseType === 'array-other') {
      ops = getFilterOps('array');
    } else {
      ops = getFilterOps(baseType);
    }

    // ── needsVal / needsVal2 ──────────────────────────────────────────────────
    const isMacro   = DataLaVistaCore.DATE_MACRO_VALS.has(c.op);
    const macroMeta = DataLaVistaCore.DATE_MACRO_OPS.find(o => o.val === c.op);
    const noValOps  = new Set(['NULL', 'NOTNULL', 'ARR_EMPTY', 'ARR_NOT_EMPTY']);
    // Also mark noInput ops from getArrayScalarOps
    const currentOp = ops.find(o => o.val === c.op);
    const needsVal  = !noValOps.has(c.op) && !(currentOp && currentOp.noInput) && !(isMacro && !macroMeta?.hasInput);

    // Effective display type for value input
    const valDisplayType = needsElementKey ? elemType : (isArrayScalar ? (scalarType || 'text') : baseType);

    const extraAttrs = rowAttrs ? rowAttrs(ci) : '';

    // ── column options ────────────────────────────────────────────────────────
    const colOptions = cols.map(col => {
      const alias = typeof col === 'string' ? col : col.alias;
      return `<option value="${alias}" ${alias === c.field ? 'selected' : ''}>${alias}</option>`;
    }).join('');

    // ── element key dropdown ──────────────────────────────────────────────────
    const elemKeyDropdown = needsElementKey
      ? `<select class="form-input qb-element-key-select" style="max-width:110px" onchange="${elementKeyJS ? elementKeyJS(ci, 'this.value') : ''}">
          ${objectKeys.map(k => `<option value="${k.key}" ${k.key === selectedElemKey ? 'selected' : ''}>${k.key}</option>`).join('')}
        </select>`
      : '';

    // ── op select ─────────────────────────────────────────────────────────────
    const opWidth = (baseType === 'date' || (needsElementKey && elemType === 'date')) ? '152px'
      : (baseType === 'text' && !needsElementKey) ? '172px'
      : '132px';
    const opSelectHTML = `<select class="form-input qb-op-select" style="width:${opWidth}!important"
      onchange="${opJS(ci, 'this.value')}">${renderOpsOptions(ops, c.op)}</select>`;

    // ── value input ───────────────────────────────────────────────────────────
    const valInputOptions = {
      op:            c.op,
      value2:        c.value2  || '',
      val2HandlerJS: val2JS ? val2JS(ci, 'this.value') : '',
      tableKey,
      fieldAlias:    c.field,
      elementKey:    selectedElemKey,
    };
    const valueHTML = needsVal
      ? buildFilterValueInput(valDisplayType, isMacro, macroMeta, c.value, valJS(ci, 'this.value'), valInputOptions)
      : `<span class="qb-val-blank"></span>`;

    return `<div class="qb-condition-row" ${extraAttrs}>
      ${ci === 0
        ? `<span class="qb-where-badge">WHERE</span>`
        : `<select class="form-input qb-conj-select" onchange="${conjJS(ci, 'this.value')}">
            <option ${c.conj === 'AND' ? 'selected' : ''}>AND</option>
            <option ${c.conj === 'OR'  ? 'selected' : ''}>OR</option>
           </select>`}
      <select class="form-input qb-field-select" onchange="${fieldJS(ci, 'this.value')}">${colOptions}</select>
      ${elemKeyDropdown}
      ${opSelectHTML}
      ${valueHTML}
      <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="${removeJS(ci)}">✕</button>
    </div>`;
  }).join('');
}


// ============================================================
// SHARED SORT-ROW RENDERER
// ============================================================
/**
 * Returns an HTML string for a list of sort rows.
 *
 * @param {Array}    sorts      Array of {field, dir}
 * @param {Array}    cols       Available column options (strings or {alias} objects)
 * @param {Function} fieldJS   (si, jsValExpr) => string
 * @param {Function} dirJS     (si, jsValExpr) => string
 * @param {Function} removeJS  (si) => string
 * @param {Function} [rowAttrs] (si) => string  optional extra attrs on the row div
 */
function renderSortRows(sorts, cols, fieldJS, dirJS, removeJS, rowAttrs) {
  if (!sorts.length)
    return '<div style="font-size:11px;color:var(--text-disabled);padding:2px 0">No sorts — click + Add</div>';

  cols = [...cols].sort((a, b) => {
    const aliasA = (typeof a === 'string' ? a : a.alias).toLowerCase();
    const aliasB = (typeof b === 'string' ? b : b.alias).toLowerCase();
    return aliasA.localeCompare(aliasB);
  });
  
  return sorts.map((s, si) => {
    const extraAttrs = rowAttrs ? rowAttrs(si) : '';
    const colOptions = cols.map(col => {
      const alias = typeof col === 'string' ? col : col.alias;
      return `<option value="${alias}" ${alias === s.field ? 'selected' : ''}>${alias}</option>`;
    }).join('');

    return `<div class="qb-sort-row" ${extraAttrs}>
      <select class="form-input qb-field-select" onchange="${fieldJS(si, 'this.value')}">
        ${colOptions}
      </select>
      <select class="form-input qb-dir-select" onchange="${dirJS(si, 'this.value')}">
        <option ${s.dir === 'ASC'  ? 'selected' : ''}>ASC</option>
        <option ${s.dir === 'DESC' ? 'selected' : ''}>DESC</option>
      </select>
      <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="${removeJS(si)}">✕</button>
    </div>`;
  }).join('');
}


// ============================================================
// SHARED AGGREGATE POPUP
// ============================================================
/**
 * Opens a floating aggregate-picker popup anchored below btn.
 *
 * @param {HTMLElement} btn       Anchor button element
 * @param {string}      displayType  Field displayType for aggsForType()
 * @param {string}      current   Currently selected agg value (or '')
 * @param {Function}    onSelect  (aggVal) => void   called when user picks an agg
 */
function showAggPopup(btn, displayType, current, onSelect) {
  document.querySelectorAll('.adv-agg-popup').forEach(p => p.remove());
  const aggs  = aggsForType(displayType || 'text');
  const popup = document.createElement('div');
  popup.className = 'adv-agg-popup';
  aggs.forEach(a => {
    const opt = document.createElement('div');
    opt.className = 'agg-opt' + (a.val === current ? ' selected' : '');
    opt.textContent = a.label;
    opt.addEventListener('click', () => {
      document.querySelectorAll('.adv-agg-popup').forEach(p => p.remove());
      onSelect(a.val);
    });
    popup.appendChild(opt);
  });
  document.body.appendChild(popup);
  const rect = btn.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 2) + 'px';
  popup.style.left = Math.max(0, rect.left - popup.offsetWidth + rect.width) + 'px';
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', close); }
    });
  }, 10);
}
