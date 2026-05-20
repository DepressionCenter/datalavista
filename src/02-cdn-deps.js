/* ============================================================
This file is part of DataLaVista™
02-cdn-deps.js: CDN dependency list for async loading.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-05-20
Last Modified: 2026-05-20
Summary: Defines _DLV_CDN_DEPS, the two-group array of CDN scripts loaded
         dynamically by _dlvLoadCdnDeps() at startup (minimal shell mode only).
         Group 0: init() awaits these before proceeding (core deps with SRI).
         Group 1: fire-and-forget after group 0 (plugins/extras, no SRI required).
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

var _DLV_CDN_DEPS = [
  // Group 0: loaded sequentially, init() awaits all before proceeding.
  // Scripts that require a specific load order or need to be ready at init time go here.
  [
    {src: 'https://cdn.jsdelivr.net/npm/alasql@4.17.2/dist/alasql.min.js', integrity: 'sha256-cSUWm7ESD8Wh7fMFQMkVwlbYugKkhpH1q6bPGIZy9bg=', crossorigin: 'anonymous'},
    {src: 'https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js', integrity: 'sha256-uqjf5+HZM2uY6Jhrp+IOoV582+oe9CpZ1ZR4Yy+kWh0=', crossorigin: 'anonymous'},
    {src: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', integrity: 'sha256-yVBhl8r4CaB1tt7h2g02+xnacVj/6KiOewyWxdhiPJk=', crossorigin: 'anonymous'},
    {src: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js'},
    {src: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/sql/sql.min.js'},
    {src: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/show-hint.min.js'},
    {src: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/hint/sql-hint.min.js'}
  ],
  // Group 1: fire-and-forget after group 0, init() does not wait
  [
    {src: 'https://cdn.jsdelivr.net/npm/@echarts-x/custom-stage/dist/stage.auto.js'},
    {src: 'https://cdn.jsdelivr.net/npm/@echarts-x/custom-line-range/dist/line-range.auto.js'},
    {src: 'https://cdn.jsdelivr.net/npm/@echarts-x/custom-bar-range/dist/bar-range.auto.js'},
    {src: 'https://cdn.jsdelivr.net/npm/@echarts-x/custom-violin/dist/violin.auto.js'}
  ]
];
