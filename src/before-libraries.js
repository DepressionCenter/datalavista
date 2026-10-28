/* ============================================================
This file is part of DataLaVista™
before-libraries.js: Hides the page's module loaders while the packed libraries run.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: The build places this file before the packed libraries in datalavista.js. It hides
         define.amd, window.exports, and window.module so every library creates its usual
         global (alasql, echarts, XLSX, CodeMirror, LZString, initSqlJs) instead of handing
         itself to RequireJS or to another script's exports object. after-libraries.js puts
         the loaders back. This file runs outside the app's strict-mode function on purpose.
Notes: See README file for documentation and full license information.
Website: https://github.com/DepressionCenter/datalavista

Copyright © 2026 The Regents of the University of Michigan

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

// This must stay the first statement of the built file: alasql.min.js starts with a
// "use strict" statement, which would turn the whole file strict if it came first.
var _dlvRestoreModuleLoaders = (function () {
  var saved = [];
  var restoreAmd = function () {};

  // define.amd is replaced with an accessor that reads as null. Every packed library checks that
  // define.amd is truthy before registering with RequireJS, and the FileSaver code inside AlaSQL
  // checks that it is not null, so null satisfies all of them. SharePoint's Modern Script Editor
  // puts define.amd back as soon as a script has run, so a plain assignment could be undone too
  // early. Values assigned while hidden are kept, and the latest one is put back afterward.
  var loader = window.define;
  if (typeof loader === 'function') {
    var hadOwnAmd = Object.prototype.hasOwnProperty.call(loader, 'amd');
    var latestAmd = loader.amd;
    try {
      Object.defineProperty(loader, 'amd', {
        configurable: true,
        enumerable: true,
        get: function () { return null; },
        set: function (value) { latestAmd = value; }
      });
      restoreAmd = function () {
        delete loader.amd;
        if (hadOwnAmd || latestAmd !== undefined) { loader.amd = latestAmd; }
      };
    } catch (e) {
      // define.amd can't be replaced, so hide it the simple way. The library check at startup reports it if this was not enough.
      try { loader.amd = null; } catch (e2) { /* Nothing more can be done here. */ }
      restoreAmd = function () { try { loader.amd = latestAmd; } catch (e3) { /* Nothing more can be done here. */ } };
    }
  }

  // A page-level exports or module object makes SheetJS and ECharts fill it instead of their own global.
  ['exports', 'module'].forEach(function (name) {
    if (window[name] === undefined || window[name] === null) { return; }
    try {
      saved.push({ name: name, value: window[name] });
      window[name] = undefined;
    } catch (e) { /* A read-only name can't be hidden. The library check at startup reports it if this was not enough. */ }
  });

  return function restoreModuleLoaders() {
    restoreAmd();
    saved.forEach(function (item) {
      try { window[item.name] = item.value; } catch (e) { /* Nothing more can be done here. */ }
    });
  };
})();
