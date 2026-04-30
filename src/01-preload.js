/* ============================================================
This file is part of DataLaVista™
01-preload.js: Prevents DataLaVista scripts from loading more than once.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-04-28
Last Modified: 2026-04-28
Summary: Prevents DataLaVista scripts from loading more than once,
        to allow using multiple script tags with src
        to accomodate CSP issues in SP without needing to
        manually edit the script tag.
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

if (window._dlvLoaded) { return; }
window._dlvLoaded = true;
