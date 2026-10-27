/* ============================================================
This file is part of DataLaVista™
app.js: Shared helpers for the browser tests.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Opens a built DataLaVista page and loads synthetic files through the upload queue.
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

const { test, expect } = require('@playwright/test');

/**
 * Open a built page and wait until its libraries are loaded and it has started.
 * @param {import('@playwright/test').Page} page
 * @param {string} [file] Page to open, relative to the repository root.
 * @returns {Promise<string[]>} Uncaught script errors, collected for as long as the page stays open.
 */
async function openApp(page, file = 'DataLaVista.html') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/' + file);
  // The libraries load from public CDNs, so allow for a slow network
  await page.waitForFunction(
    () => window.dlv && window.alasql && window.XLSX && window.DataLaVistaState && window.DataLaVistaState._initialized,
    null, { timeout: 60_000 });
  return errors;
}

/**
 * Load file contents through the same upload queue the Connect popup uses.
 * @param {import('@playwright/test').Page} page
 * @param {{name: string, type: string, prefix: string, text: string}} file
 *   File name, file type (csv, json, or xlsx), data source name, and contents.
 * @returns {Promise<string>} Name of the queryable view for the loaded table.
 */
async function uploadFile(page, file) {
  return page.evaluate(async ({ name, type, prefix, text }) => {
    dlv.ConnectQueue.addUploadedFile(new File([text], name), type, prefix);
    await dlv.processConnectQueue('upload');
    // View names are normalized, so match on the data source name without case
    return Object.keys(dlv.CyberdynePipeline.views).find(v => v.toLowerCase().startsWith(prefix.toLowerCase()));
  }, file);
}

module.exports = { test, expect, openApp, uploadFile };
