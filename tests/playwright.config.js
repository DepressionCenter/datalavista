/* ============================================================
This file is part of DataLaVista™
playwright.config.js: Settings for the browser tests.
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Serves the repository over local HTTP and runs the browser tests in Chromium.
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

const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.DLV_TEST_PORT || 8765);
// Windows installs often name the interpreter "python" instead of "python3"
const PYTHON = process.env.PYTHON || 'python3';

module.exports = defineConfig({
  testDir: './browser',
  timeout: 90_000,
  // One retry in CI absorbs a slow response from a public CDN
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The pages fetch files and blob addresses, which browsers block on file:// pages
  webServer: {
    command: `${PYTHON} -m http.server ${PORT} --bind 127.0.0.1 --directory ..`,
    url: `http://127.0.0.1:${PORT}/DataLaVista.html`,
    reuseExistingServer: !process.env.CI,
    // The server logs every request, which hides the test results
    stderr: 'ignore',
  },
});
