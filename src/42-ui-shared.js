/* ============================================================
This file is part of DataLaVista™
42-ui-shared.js: Shared UI rendering helpers for condition rows, sort rows, and aggregate popups.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-04-07
Last Modified: 2026-04-09
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
// ATTRIBUTE ENCODING HELPER
// ============================================================
function _attrEnc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// OP SYMBOL HELPER
// ============================================================
function getOpSymbol(label) {
  if (!label) return '';
  const tokens = label.split(' ');
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (/^[a-zA-Z]+$/.test(tokens[i])) break;
    result.push(tokens[i]);
  }
  return result.length ? result.join(' ') : tokens[0];
}

// ============================================================
// PROPERTY POPUP  (AND/OR, operators, ASC/DESC, join types)
// ============================================================
// Generic floating picker popup. The trigger element stores its config in data-* attributes:
//   data-opts  JSON array of {val, label} objects
//   data-cur   current selected value (string)
//   data-js    JS handler template — __V__ is replaced with JSON.stringify(selectedVal)
//   data-fmt   optional "symbol" → badge text is set via getOpSymbol(label)
function showPropPopup(btn) {
  document.querySelectorAll('.dlv-prop-popup').forEach(p => { p['_dlvCleanup'] && p['_dlvCleanup'](); p.remove(); });

  let opts, cur, tpl;
  try {
    opts = JSON.parse(btn.dataset.opts || '[]');
    cur  = btn.dataset.cur || '';
    tpl  = btn.dataset.js  || '';
  } catch (e) { return; }
  if (!opts.length || !tpl) return;

  const isSym = btn.dataset.fmt === 'symbol';

  const popup = document.createElement('div');
  popup.className = 'dlv-prop-popup';

  const MAX_ROWS = 9;
  const colCount = Math.ceil(opts.length / MAX_ROWS);
  for (let ci = 0; ci < colCount; ci++) {
    const colDiv = document.createElement('div');
    colDiv.className = 'dlv-prop-popup-col';
    opts.slice(ci * MAX_ROWS, (ci + 1) * MAX_ROWS).forEach(o => {
      const item = document.createElement('div');
      item.className = 'dlv-prop-opt' + (String(o.val) === String(cur) ? ' selected' : '');
      item.textContent = o.label || o.val;
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => {
        popup['_dlvCleanup'] && popup['_dlvCleanup']();
        popup.remove();
        btn.textContent = isSym ? getOpSymbol(o.label || String(o.val)) : (o.label || String(o.val));
        btn.dataset.cur = String(o.val);
        const js = tpl.replace(/__V__/g, JSON.stringify(o.val));
        try { new Function(js)(); } catch (ex) { console.error('[DLV] prop popup handler error:', ex, js); }
      });
      colDiv.appendChild(item);
    });
    popup.appendChild(colDiv);
  }

  document.body.appendChild(popup);

  function reposition() {
    const r = btn.getBoundingClientRect();
    popup.style.top  = (r.bottom + 2) + 'px';
    popup.style.left = Math.max(0, r.left) + 'px';
    // Clamp so popup doesn't overflow the right edge of the viewport
    const pr = popup.getBoundingClientRect();
    if (pr.right > window.innerWidth - 4) {
      popup.style.left = Math.max(0, window.innerWidth - pr.width - 4) + 'px';
    }
  }
  reposition();

  let rafId;
  const onScroll = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(reposition); };
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });

  function cleanup() {
    window.removeEventListener('scroll', onScroll, { capture: true });
    cancelAnimationFrame(rafId);
  }
  popup['_dlvCleanup'] = cleanup;

  setTimeout(() => {
    function closeOnClick(e) {
      const t = e.target instanceof Node ? e.target : null;
      if (!t || (!popup.contains(t) && e.target !== btn)) {
        cleanup();
        popup.remove();
        document.removeEventListener('click', closeOnClick);
      }
    }
    document.addEventListener('click', closeOnClick);
  }, 10);
}

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

    // ── op badge (floating popup) ─────────────────────────────────────────────
    const selectedOp = ops.find(o => o.val === c.op) || ops[0];
    const opSymbol   = getOpSymbol(selectedOp ? selectedOp.label : c.op);
    const opTitle    = selectedOp ? selectedOp.label : '';
    const opTpl      = opJS(ci, '__V__');
    const opOpts     = JSON.stringify(ops.map(o => ({ val: o.val, label: o.label })));
    const opSelectHTML =
      '<span class="qb-badge qb-op-badge" title="' + _attrEnc(opTitle) + '" data-fmt="symbol"'
      + ' data-opts="' + _attrEnc(opOpts) + '"'
      + ' data-cur="' + _attrEnc(selectedOp ? selectedOp.val : c.op) + '"'
      + ' data-js="' + _attrEnc(opTpl) + '"'
      + ' onclick="showPropPopup(this)">' + _attrEnc(opSymbol) + '</span>';

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

    // ── conj badge (floating popup) ───────────────────────────────────────────
    let rowPrefix;
    if (ci === 0) {
      rowPrefix = '';
    } else {
      const conjTpl  = conjJS(ci, '__V__');
      const conjOpts = JSON.stringify([{ val: 'AND', label: 'AND' }, { val: 'OR', label: 'OR' }]);
      rowPrefix =
        '<span class="qb-badge qb-conj-badge"'
        + ' data-opts="' + _attrEnc(conjOpts) + '"'
        + ' data-cur="' + _attrEnc(c.conj || 'AND') + '"'
        + ' data-js="' + _attrEnc(conjTpl) + '"'
        + ' onclick="showPropPopup(this)">' + _attrEnc(c.conj || 'AND') + '</span>';
    }

    return '<div class="qb-condition-row"' + (extraAttrs ? ' ' + extraAttrs : '') + '>'
      + rowPrefix
      + '<select class="form-input qb-field-select" onchange="' + fieldJS(ci, 'this.value') + '">' + colOptions + '</select>'
      + elemKeyDropdown
      + opSelectHTML
      + valueHTML
      + '<button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="' + removeJS(ci) + '">\u2715</button>'
      + '</div>';
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

    const dirTpl  = dirJS(si, '__V__');
    const dirOpts = JSON.stringify([{ val: 'ASC', label: 'ASC' }, { val: 'DESC', label: 'DESC' }]);
    const dirBadge =
      '<span class="qb-badge qb-dir-badge"'
      + ' data-opts="' + _attrEnc(dirOpts) + '"'
      + ' data-cur="' + _attrEnc(s.dir || 'ASC') + '"'
      + ' data-js="' + _attrEnc(dirTpl) + '"'
      + ' onclick="showPropPopup(this)">' + _attrEnc(s.dir || 'ASC') + '</span>';

    return `<div class="qb-sort-row" ${extraAttrs}>
      <select class="form-input qb-field-select" onchange="${fieldJS(si, 'this.value')}">
        ${colOptions}
      </select>
      ${dirBadge}
      <button class="btn btn-ghost btn-sm btn-icon qb-remove-btn" onclick="${removeJS(si)}">✕</button>
    </div>`;
  }).join('');
}


// ============================================================
// SHARED AGGREGATE POPUP
// ============================================================
/**
 * Opens a floating aggregate-picker popup anchored below btn.
 * Tracks scroll so the popup follows the button.
 *
 * @param {HTMLElement} btn       Anchor button element
 * @param {string}      displayType  Field displayType for aggsForType()
 * @param {string}      current   Currently selected agg value (or '')
 * @param {Function}    onSelect  (aggVal) => void   called when user picks an agg
 */
function showAggPopup(btn, displayType, current, onSelect) {
  document.querySelectorAll('.adv-agg-popup').forEach(p => { p['_dlvCleanup'] && p['_dlvCleanup'](); p.remove(); });
  const aggs  = aggsForType(displayType || 'text');
  const popup = document.createElement('div');
  popup.className = 'adv-agg-popup';
  aggs.forEach(a => {
    const opt = document.createElement('div');
    opt.className = 'agg-opt' + (a.val === current ? ' selected' : '');
    opt.textContent = a.label;
    opt.addEventListener('mousedown', e => e.preventDefault());
    opt.addEventListener('click', () => {
      popup['_dlvCleanup'] && popup['_dlvCleanup']();
      document.querySelectorAll('.adv-agg-popup').forEach(p => p.remove());
      onSelect(a.val);
    });
    popup.appendChild(opt);
  });
  document.body.appendChild(popup);

  function reposition() {
    const rect = btn.getBoundingClientRect();
    popup.style.top  = (rect.bottom + 2) + 'px';
    popup.style.left = Math.max(0, rect.left - popup.offsetWidth + rect.width) + 'px';
  }
  reposition();

  let rafId;
  const onScroll = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(reposition); };
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });

  function cleanup() {
    window.removeEventListener('scroll', onScroll, { capture: true });
    cancelAnimationFrame(rafId);
  }
  popup['_dlvCleanup'] = cleanup;

  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      const t = e.target instanceof Node ? e.target : null;
      if (!t || !popup.contains(t)) {
        cleanup();
        popup.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 10);
}
