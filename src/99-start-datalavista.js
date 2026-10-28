/* ============================================================
This file is part of DataLaVista™
99-start-datalavista.js: DataLaVista™ app entry point and initialization.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-10-27
Summary: Waits for the app's <div>, checks the packed libraries, and starts the app once.
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

// Starts the app once the page has a place to draw it: <div id="dlv-root"> on a built page or in the
// SharePoint web part, or <div id="app"> on the source page. SharePoint can add the web part's <div>
// after this file has run, so startup checks for it every 100 milliseconds for up to 10 seconds.
(function startDataLaVista() {
  var MOUNT_WAIT_MS = 10000;
  var MOUNT_CHECK_INTERVAL_MS = 100;
  var deadline = Date.now() + MOUNT_WAIT_MS;

  function findMount() {
    return document.getElementById('dlv-root') || document.getElementById('app');
  }

  // Replaces the contents of the mount with an alert that tells the person what went wrong.
  // Uses inline styles because the app's styles may not have been added yet.
  function showStartupError(mount, message) {
    var alertBox = document.createElement('div');
    alertBox.setAttribute('role', 'alert');
    alertBox.style.cssText = 'font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; color: #a80000; ' +
      'background: #ffffff; padding: 15px; border: 1px solid #a80000; border-radius: 4px;';
    alertBox.textContent = message;
    mount.innerHTML = '';
    mount.appendChild(alertBox);
  }

  function startInMount(mount) {
    // The Modern Script Editor can run this file again for the same <div>; start the app only once.
    if (mount.dataset.dlvStarted === 'true') { return; }
    mount.dataset.dlvStarted = 'true';
    console.log("*** Starting DataLaVista™ ***");
    var problem = _dlvCheckLibraries();
    if (problem) {
      console.error(problem);
      showStartupError(mount, problem);
      return;
    }
    init().catch(function (e) {
      console.error('DataLaVista could not start.', e);
      showStartupError(mount, 'DataLaVista could not start. Refresh the page. If this message appears again, ' +
        'ask your site administrator for help and mention the errors in the browser console.');
    });
  }

  function waitForMount() {
    var mount = findMount();
    if (mount) {
      startInMount(mount);
    } else if (Date.now() >= deadline) {
      console.error('DataLaVista could not find <div id="dlv-root"></div> on this page. ' +
        'Paste the full contents of DataLaVista-sp.html.txt into the Modern Script Editor web part.');
    } else {
      setTimeout(waitForMount, MOUNT_CHECK_INTERVAL_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForMount);
  } else {
    waitForMount();
  }
})();
