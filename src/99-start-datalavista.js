/* ============================================================
This file is part of DataLaVista™
99-start-datalavista.js: DataLaVista™ app entry point and initialization.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-04
Summary: App initialization, lazy init guard, and report URL loading.
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

// Register a DataLaVista ECharts theme that reads from the report-level theme settings.
// Called at startup and re-called after theme changes to apply font/color settings.
function applyDlvEChartsTheme() {
  const echarts = /** @type {any} */ ((/** @type {any} */ (window)).echarts);
  if (!echarts) return;
  const t = (DataLaVistaState.design && DataLaVistaState.design.theme) || {};
  echarts.registerTheme('dlv', {
    color: (t.palette && t.palette.length) ? t.palette : undefined,
    textStyle: t.fontFamily ? { fontFamily: t.fontFamily } : undefined,
    backgroundColor: t.backgroundColor || 'transparent'
  });
} // TODO: Move this to init()

// Self-init
(function startDataLaVista() {
    console.log("*** Starting DataLaVista™ ***");
    try {
      init();
      applyDlvEChartsTheme();
    } catch (e) {
      console.error('DataLaVista init crashed:', e);
    }
  }
  )();