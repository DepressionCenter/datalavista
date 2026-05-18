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
     Note: #btn-connect retains its HTML onclick="ensureInit();showConnectPopup()"
     as a fallback in case scripts load late. Once 80-events.js executes, we
     replace the handler so only showConnectPopup() fires (ensureInit already ran).
  ========================================================================= */

  var btnConnect = document.getElementById('btn-connect');
  if (btnConnect) {
    btnConnect.onclick = function () { showConnectPopup(); };
  }

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