/* ============================================================
This file is part of DataLaVista™
80-events.js: DOM event bindings for all interactive elements.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-04-28
Last Modified: 2026-04-28
Summary: Wires all onclick, ondrop, ondragover, oninput, onblur, and
         onchange handlers that were previously inline in the HTML.
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
with this program. If not, see https://www.gnu.org/licenses.
================================================================ */

/* ─────────────────────────────────────────────────────────────────────────
   Phase 1-A: delegateOn — scoped event delegation helper.
   Attaches one listener on `container` that fires `handler` when any
   descendant matching `selector` triggers `eventName`.
   Register once per popup container in init(); never re-register.
───────────────────────────────────────────────────────────────────────── */
function delegateOn(container, selector, eventName, handler) {
  container.addEventListener(eventName, function(e) {
    var target = e.target.closest(selector);
    if (target && container.contains(target)) { handler(e, target); }
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Phase 1-B: _dlvActions registry + registerAction.
   Any file may call registerAction(name, fn) to map a data-action value
   to a handler fn(el, e).  The dispatcher in attachEvents() routes clicks
   (and change / input) to this registry automatically.
───────────────────────────────────────────────────────────────────────── */
var _dlvActions = {};

function registerAction(name, fn) {
  _dlvActions[name] = fn;
}

function attachEvents() {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
     Helper: safely bind an event listener to an element by ID.
     Silently skips if the element does not exist.
  ───────────────────────────────────────────────────────────────────────── */
  function on(id, eventName, handler) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener(eventName, handler); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Helper: bind a dragover event that just calls preventDefault
     and optionally adds a CSS class to the target element.
  ───────────────────────────────────────────────────────────────────────── */
  function bindDragOver(id, cssClass) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (cssClass) { el.classList.add(cssClass); }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Helper: bind a dragleave that removes a CSS class.
  ───────────────────────────────────────────────────────────────────────── */
  function bindDragLeave(id, cssClass) {
    var el = document.getElementById(id);
    if (!el) { return; }
    el.addEventListener('dragleave', function () {
      if (cssClass) { el.classList.remove(cssClass); }
    });
  }


  /* ─────────────────────────────────────────────────────────────────────────
     Phase 1-B: Document-level data-action dispatcher.
     Handles click, change, and input events on any element with data-action.
     Popup-internal change/input actions use delegateOn() instead (Phase 4).
  ───────────────────────────────────────────────────────────────────────── */
  function dispatchAction(e) {
    var el = e.target.closest('[data-action]');
    if (el) {
      var action = el.dataset.action;
      var fn = _dlvActions[action];
      if (fn) { fn(el, e); }
    }
  }
  document.body.addEventListener('click',  dispatchAction);
  document.body.addEventListener('change', dispatchAction);
  document.body.addEventListener('input',  dispatchAction);

  /* ─────────────────────────────────────────────────────────────────────────
     Autocomplete inputs (data-dlv-ac): show on focus, filter on input,
     navigate/select with keyboard, hide with a delay on blur so item
     clicks can register before the popup is removed.
  ───────────────────────────────────────────────────────────────────────── */
  document.body.addEventListener('focusin', function(e) {
    var el = /** @type {HTMLElement} */ (e.target).closest('[data-dlv-ac]');
    if (el) { dlvAcShow(/** @type {HTMLInputElement} */ (el), el.dataset.dlvAcTk || '', el.dataset.dlvAcFa || '', el.dataset.dlvAcEk || ''); }
  });
  document.body.addEventListener('focusout', function(e) {
    var el = /** @type {HTMLElement} */ (e.target).closest('[data-dlv-ac]');
    if (el) { dlvAcBlur(/** @type {HTMLInputElement} */ (el)); }
  });
  document.body.addEventListener('keydown', function(e) {
    var el = /** @type {HTMLElement} */ (e.target).closest('[data-dlv-ac]');
    if (el) { dlvAcKeydown(/** @type {HTMLInputElement} */ (el), e); }
  });


  /* =========================================================================
     CONTEXT MENU
  ========================================================================= */
  on('ctx-copy-url',       'click', function () { dlvCtxCopyUrl(); });
  on('ctx-refresh-source', 'click', function () { dlvCtxRefreshSource(); });
  on('ctx-rename',         'click', function () { dlvCtxRename(); });
  on('ctx-delete',         'click', function () { dlvCtxDelete(); });


  /* =========================================================================
     SHAREPOINT FILE PICKER MODAL
  ========================================================================= */

  // Clicking the backdrop closes the picker
  var spPickerOverlay = document.getElementById('sp-picker-overlay');
  if (spPickerOverlay) {
    spPickerOverlay.addEventListener('click', function (e) {
      if (e.target === spPickerOverlay) { spPickerClose(); }
    });
  }

  on('sp-picker-close-btn',  'click', function () { spPickerClose(); });
  on('sp-picker-cancel-btn', 'click', function () { spPickerClose(); });
  on('sp-picker-select-btn', 'click', function () { spPickerConfirm(); });


  /* =========================================================================
     CONNECT / DATA SOURCE POPUP
  ========================================================================= */

  on('popup-close-btn',   'click', function () { hideConnectPopup(); });
  on('popup-cancel-btn',  'click', function () { hideConnectPopup(); });
  on('btn-do-connect',    'click', function () { doConnect(); });

  // Source tabs
  on('tab-sharepoint', 'click', function () { switchSourceTab(this, 'sharepoint'); });
  on('tab-upload',     'click', function () { switchSourceTab(this, 'upload'); });
  on('tab-remote',     'click', function () { switchSourceTab(this, 'remote'); });
  on('tab-loadconfig', 'click', function () { switchSourceTab(this, 'loadconfig'); });

  // Upload dropzone drag-and-drop
  var uploadDropzone = document.getElementById('upload-dropzone');
  if (uploadDropzone) {
    uploadDropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadDropzone.classList.add('drag-over');
    });
    uploadDropzone.addEventListener('dragleave', function () {
      uploadDropzone.classList.remove('drag-over');
    });
    uploadDropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadDropzone.classList.remove('drag-over');
      var fileInput = document.getElementById('upload-file-input');
      if (fileInput && e.dataTransfer) { fileInput.files = e.dataTransfer.files; }
      handleUploadFiles();
    });
  }

  // Upload file input change
  on('upload-file-input', 'change', function () { handleUploadFiles(); });

  // Remote files
  on('btn-sp-browse-remote', 'click', function () { spBrowseRemoteFile(); });
  on('btn-add-remote-url',   'click', function () { handleAddRemoteUrl(); });

  // Open dashboard / config browse
  on('btn-sp-browse-config', 'click', function () { spBrowseConfig(); });


  /* =========================================================================
     TOP TOOLBAR
  ========================================================================= */

  on('btn-connect', 'click', function () { showConnectPopup(); });

  on('btn-save-config', 'click', function () { saveConfig(); });

  // Main tab navigation
  on('toolbar-button-query',    'click', function () { switchTab('query'); });
  on('toolbar-button-design',   'click', function () { switchTab('design'); });
  on('toolbar-button-preview',  'click', function () { switchTab('dashboardPreview'); });
  on('toolbar-button-generate', 'click', function () { switchTab('generate'); });

  // Report-mode toolbar
  on('toolbar-reportMode-button-1', 'click', function () { refreshDashboardPreview(); });
  on('toolbar-reportMode-button-2', 'click', function () { downloadCSV(); });
  on('toolbar-reportMode-button-3', 'click', function () { printReport(); });
  on('toolbar-reportMode-button-4', 'click', function () { shareLiveReport(); });

  on('toolbar-button-datadict', 'click', function () { openDataDictionaryPopup(); });


  /* =========================================================================
     DATA DICTIONARY POPUP
  ========================================================================= */
  var ddOverlay = document.getElementById('dd-overlay');
  if (ddOverlay) {
    ddOverlay.addEventListener('click', function(e) {
      if (e.target === ddOverlay) { ddOverlay.style.display = 'none'; }
    });
  }
  on('dd-close-btn',        'click', function() { var o = document.getElementById('dd-overlay'); if (o) o.style.display = 'none'; });
  on('dd-footer-close-btn', 'click', function() { var o = document.getElementById('dd-overlay'); if (o) o.style.display = 'none'; });
  on('dd-csv-btn',          'click', function() { _ddDownloadCSV(); });
  on('dd-search',           'input', function(e) { _ddFilterCards(/** @type {HTMLInputElement} */ (e.target).value); });


  /* =========================================================================
     FIELDS PANEL (Query tab — left panel)
  ========================================================================= */
  on('btn-expand-all-tables',   'click', function () { expandAllTables(); });
  on('btn-collapse-all-tables', 'click', function () { collapseAllTables(); });


  /* =========================================================================
     QUERY-MAIN TABS + ACTION BUTTONS
  ========================================================================= */
  on('qmt-qb',          'click', function () { switchQMTab('qb'); });
  on('qmt-sql',         'click', function () { switchQMTab('sql'); });
  on('qmt-dataPreview', 'click', function () { switchQMTab('dataPreview'); });

  on('btn-sql-locked',   'click', function () { unlockSQL(); });
  on('btn-clear-query',  'click', function () { clearQueryBuilder(); });
  on('btn-run-query',    'click', function () { runQuery(); switchQMTab('dataPreview'); });
  on('btn-use-in-design','click', function () { useResultsInDesign(); });


  /* =========================================================================
     QUERY BUILDER — ADVANCED CANVAS
  ========================================================================= */
  var qbCanvas = document.getElementById('qb-canvas');
  if (qbCanvas) {
    qbCanvas.addEventListener('dragover', function (e) { e.preventDefault(); });
    qbCanvas.addEventListener('drop',     function (e) { onDropToAdvancedQB(e); });
  }

  var qbCanvasWrap = document.getElementById('qb-canvas-wrap');
  if (qbCanvasWrap) {
    qbCanvasWrap.addEventListener('click', function (e) {
      var t = /** @type {Element} */ (e.target);
      if (t === qbCanvasWrap || t.id === 'qb-canvas' || t.id === 'qb-svg') {
        renderAdvOptionsPanel(null, null);
      }
    });
  }

  on('adv-opts-toggle',     'click', function () { toggleAdvOptionsPanel(); });
  on('btn-close-node-props','click', function () { closeNodeProps(); });


  /* =========================================================================
     SQL EDITOR TOOLBAR
  ========================================================================= */
  on('btn-format-sql', 'click', function () { formatSQL(); });
  on('btn-clear-sql',  'click', function () { clearSQLEditor(); });


  /* =========================================================================
     DESIGN TAB — TITLE BAR
  ========================================================================= */
  var titleInput = document.getElementById('title-input');
  if (titleInput) {
    titleInput.addEventListener('input', function () {
      DataLaVistaState.design.title = this.value;
    });
    titleInput.addEventListener('blur', function () {
      updateDashboardTitleProp('title', this.value);
    });
    titleInput.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    titleInput.addEventListener('drop', function (e) {
      insertTitleToken(e);
    });
  }


  /* =========================================================================
     DESIGN TAB — FILTER DROP ZONE
  ========================================================================= */
  var filterDropZone = document.getElementById('filter-drop-zone');
  if (filterDropZone) {
    filterDropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      filterDropZone.classList.add('drag-over');
    });
    filterDropZone.addEventListener('dragleave', function () {
      filterDropZone.classList.remove('drag-over');
    });
    filterDropZone.addEventListener('drop', function (e) {
      onDropToFilterBar(e);
    });
  }


  /* =========================================================================
     DESIGN TAB — CANVAS DROP ZONE
  ========================================================================= */
  var canvasDropZone = document.getElementById('canvas-drop-zone');
  if (canvasDropZone) {
    canvasDropZone.addEventListener('dragover',  function (e) { onCanvasDragOver(e); });
    canvasDropZone.addEventListener('dragleave', function (e) { onCanvasDragLeave(e); });
    canvasDropZone.addEventListener('drop',      function (e) { onDropToCanvas(e); });
    canvasDropZone.addEventListener('click',     function (e) {
      if (e.target === canvasDropZone) {
        renderDashboardTitleProperties();
        if (DataLaVistaState.drillHighlight) { _clearDrillHighlight(); }
      }
    });
  }


  /* =========================================================================
     PREVIEW TAB TOOLBAR
  ========================================================================= */
  on('preview-toolbar-button-refresh',  'click', function () { refreshDashboardPreview(); });
  on('preview-toolbar-button-download', 'click', function () { downloadCSV(); });
  on('preview-toolbar-button-print',    'click', function () { printPreview(); });
  on('preview-toolbar-button-generate', 'click', function () { switchTab('generate'); });

  // Clicking empty preview canvas clears drill highlight
  var previewCanvas = document.getElementById('preview-canvas');
  if (previewCanvas) {
    previewCanvas.addEventListener('click', function (e) {
      if (e.target === previewCanvas && DataLaVistaState.drillHighlight) {
        _clearDrillHighlight();
      }
    });
  }


  /* =========================================================================
     GENERATE & PUBLISH TAB
  ========================================================================= */
  on('btn-generate-report',    'click', function () { generateReport(); });
  on('btn-copy-json',          'click', function () { copyGenCode(); });
  on('btn-publish-sp',         'click', function () { publishToSharePoint(); });
  on('btn-save-sp-list',       'click', function () { saveToSharePointList(); });
  on('btn-download-gen-code',  'click', function () { downloadGenCode('json'); });
  on('btn-share-published-url','click', function () { sharePublishedUrl(); });

}


/* =========================================================================
   Phase 4-A: Connect queue remove buttons
========================================================================= */
registerAction('queue-remove-upload',     function(el) { ConnectQueue.removeUploadedFile(+el.dataset.index); });
registerAction('queue-remove-remote-url', function(el) { ConnectQueue.removeRemoteUrl(+el.dataset.index); });


/* =========================================================================
   Phase 4-C: Widget canvas move / delete
========================================================================= */
registerAction('widget-move',   function(el) { moveWidget(el.dataset.wid, +el.dataset.dir); });
registerAction('widget-delete', function(el) { deleteWidget(el.dataset.wid); });


/* =========================================================================
   Shared: show-prop-popup, dlv-cb, dlv-ac-cb
   Used by renderConditionRows / renderSortRows / buildFilterValueInput and
   any other shared popup callback registered with _dlvRegPopupCb.
========================================================================= */
registerAction('show-prop-popup', function(el) { showPropPopup(el); });

registerAction('dlv-cb', function(el, e) {
  var key = el.dataset.cb;
  var fn = _dlvPopupCbs[key];
  if (fn) { fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value); }
});

registerAction('dlv-ac-cb', function(el, e) {
  var key = el.dataset.cb;
  var fn = _dlvPopupCbs[key];
  if (fn) { fn(e.target.value); }
  dlvAcFilter(/** @type {HTMLInputElement} */ (el));
});


/* =========================================================================
   Phase 4-D: Widget properties panel
========================================================================= */
registerAction('widget-series-props',        function(el, e) { e.stopPropagation(); openSeriesAdvancedProps(el.dataset.wid, el.dataset.yf, +el.dataset.yi); });
registerAction('widget-field-agg',           function(el, e) { e.stopPropagation(); showWidgetFieldAggPopup(el.dataset.wid, el.dataset.yf, el, +el.dataset.yi); });
registerAction('widget-remove-yfield',       function(el)    { widgetRemoveYField(el.dataset.wid, +el.dataset.yi); });
registerAction('widget-add-yfield',          function(el)    { widgetAddYField(el.dataset.wid); });
registerAction('widget-update-yfield',       function(el, e) { widgetUpdateYField(el.dataset.wid, +el.dataset.yi, e.target.value); });
registerAction('widget-update-bool',         function(el, e) { updateWidgetProp(el.dataset.wid, el.dataset.prop, e.target.checked); });
registerAction('widget-update-prop-rerender', function(el, e) {
  var val = el.dataset.array ? [e.target.value] : e.target.value;
  updateWidgetProp(el.dataset.wid, el.dataset.prop, val);
  renderWidgetProperties(el.dataset.wid);
});


/* =========================================================================
   Phase 4-E: Advanced Query Builder
========================================================================= */
registerAction('qb-remove-node',             function(el)    { removeAdvNode(el.dataset.nodeId); });
registerAction('qb-toggle-lookup-child-off', function(el, e) { e.stopPropagation(); _toggleLookupChild(el.dataset.nodeId, el.dataset.parentAlias, el.dataset.childField, false); });
registerAction('qb-add-join-key',            function()      { addActiveJoinKey(); });
registerAction('qb-remove-join',             function()      { removeActiveJoin(); });
registerAction('qb-show-agg-popup',          function(el, e) { e.stopPropagation(); showAdvAggPopup(el.dataset.nodeId, el.dataset.field, el); });
registerAction('qb-toggle-lookup-expand',    function(el, e) { e.stopPropagation(); _toggleLookupExpand(el.dataset.nodeId, el.dataset.field); });
registerAction('qb-toggle-field',            function(el)    { advNodeToggleField(el.dataset.nodeId, el.dataset.field); });
registerAction('qb-show-less-fields',        function(el)    { _advShowLessFields(el.dataset.nodeId); });
registerAction('qb-show-more-fields',        function(el)    { _advShowMoreFields(el.dataset.nodeId); });
registerAction('qb-clear-fields',            function(el)    { advNodeClearFields(el.dataset.nodeId); });
registerAction('qb-add-all-fields',          function(el)    { advNodeAddAllFields(el.dataset.nodeId); });
registerAction('qb-add-cond',                function(el)    { advNodeAddCond(el.dataset.nodeId); });
registerAction('qb-add-sort',                function(el)    { advNodeAddSort(el.dataset.nodeId); });
registerAction('qb-add-gb',                  function(el)    { advNodeAddGB(el.dataset.nodeId); });
registerAction('qb-set-row-limit',           function(el, e) { DataLaVistaState.advancedQB.rowLimit = parseInt(e.target.value) || 500; rebuildAdvancedSQL(); });
registerAction('qb-set-alias',               function(el, e) {
  var nid = el.dataset.nodeId;
  DataLaVistaState.advancedQB.nodes[nid].alias = e.target.value;
  if (DataLaVistaState.advancedQB.nodeAliases) { DataLaVistaState.advancedQB.nodeAliases[nid] = e.target.value; }
  rebuildAdvancedSQL();
});


/* =========================================================================
   Phase 4-D (additional): Widget properties panel — actions omitted from
   initial migration.  Each action mirrors the pre-CSP inline handler.
========================================================================= */
registerAction('widget-add-cond',                 function(el)    { widgetAddCond(el.dataset.wid); });
registerAction('widget-add-sort',                 function(el)    { widgetAddSort(el.dataset.wid); });
registerAction('widget-update-prop',              function(el, e) { updateWidgetProp(el.dataset.wid, el.dataset.prop, e.target.value); });
registerAction('widget-update-num',               function(el, e) { updateWidgetProp(el.dataset.wid, el.dataset.prop, +e.target.value); });
registerAction('widget-update-num-rounded',       function(el, e) { updateWidgetProp(el.dataset.wid, el.dataset.prop, Math.round(parseFloat(e.target.value) * 4) / 4); });
registerAction('widget-update-arr-prop-rerender', function(el, e) { updateWidgetProp(el.dataset.wid, el.dataset.prop, [e.target.value]); renderWidgetProperties(el.dataset.wid); });
registerAction('widget-change-type',              function(el, e) { changeWidgetType(el.dataset.wid, e.target.value); });
registerAction('widget-clear-prop',               function(el)    { updateWidgetProp(el.dataset.wid, el.dataset.prop, undefined); renderWidgetProperties(el.dataset.wid); });
registerAction('widget-remove-tablefield',        function(el)    { removeWidgetField(el.dataset.wid, +el.dataset.yi); });
registerAction('widget-peek-sql',                 function(el)    { peekWidgetSQL(el.dataset.wid, el); });


/* =========================================================================
   Phase 4-D (additional): Dashboard title / report-settings properties panel
========================================================================= */
registerAction('dash-show-title',     function(el, e) { updateDashboardTitleProp('showDashboardTitle', e.target.checked); });
registerAction('dash-title-input',    function(el, e) { updateDashboardTitleProp('title', e.target.value); });
registerAction('dash-tooltip-change', function(el, e) { updateDashboardTitleProp('dashboardTitleTooltip', e.target.value); });
registerAction('dash-interaction',    function(el, e) { updateDashboardTitleProp('interactionMode', e.target.value); });
registerAction('dash-bg-color',       function(el, e) { updateDashboardTitleProp('themeBackgroundColor', e.target.value); });
registerAction('dash-font-family',    function(el, e) { updateDashboardTitleProp('themeFontFamily', e.target.value); });


/* =========================================================================
   Phase 4-C/D: Drill filters, cross-highlight, and table cell interactions
========================================================================= */
/* =========================================================================
   Preview tab: filter-chip select (was inline onchange= in 70-preview.js)
========================================================================= */
registerAction('preview-filter-change', function(el, e) { applyPreviewFilterAndRender(el.dataset.field, e.target.value); });


/* =========================================================================
   Widget table-field / x-field gear buttons
========================================================================= */
registerAction('widget-tablefield-props', function(el, e) { e.stopPropagation(); openSeriesAdvancedProps(el.dataset.wid, el.dataset.yf, +el.dataset.yi); });
// TODO: implement x-field advanced props (label override, axis format, etc.) once requirements are known
registerAction('widget-xfield-props',    function() { });


registerAction('drill-clear-filter',    function(el) { clearDrillFilter(el.dataset.field); });
registerAction('drill-clear-highlight', function()   { _clearDrillHighlight(); });
registerAction('table-cell-click', function(el) {
  var field = el.dataset.field;
  var value = el.dataset.value;
  var mode  = el.dataset.mode || 'cross-filter';
  if (mode === 'cross-highlight' || mode === 'highlight') {
    var hl = DataLaVistaState.drillHighlight;
    if (hl && hl.field === field && String(hl.value) === String(value)) {
      _clearDrillHighlight();
    } else {
      _applyDrillHighlight(field, String(value));
    }
  } else if (mode !== 'none') {
    applyDrillFilter(field, String(value));
  }
});