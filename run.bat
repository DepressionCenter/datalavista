@rem This file is part of DataLaVista™
@rem run.bat
@rem Author(s): PHJ2000.
@rem Created: 2026-10-26
@rem Last Modified: 2026-10-26
@rem Summary: Starts DataLaVista over local HTTP on Windows.
@rem Notes: See README file for documentation and full license information.
@rem
@rem Copyright © 2026 The Regents of the University of Michigan
@rem
@rem This program is free software: you can redistribute it and/or modify
@rem it under the terms of the GNU General Public License as published by
@rem the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
@rem
@rem This program is distributed in the hope that it will be useful,
@rem but WITHOUT ANY WARRANTY; without even the implied warranty of
@rem MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
@rem GNU General Public License for more details.
@rem
@rem You should have received a copy of the GNU General Public License along
@rem with this program. If not, see <https://www.gnu.org/licenses/>.

@echo off
setlocal
if not exist "%~dp0bin\ZippyServe.exe" (
    echo ZippyServe is missing. Restore bin from the project download.
    exit /b 1
)
if not exist "%~dp0DataLaVista.html" (
    echo DataLaVista.html is missing. Restore it from the project download.
    exit /b 1
)
echo Open http://127.0.0.1:8010/DataLaVista.html in your browser. Press Ctrl+C to stop.
"%~dp0bin\ZippyServe.exe" -port 8010 -index "%~dp0DataLaVista.html"
exit /b %errorlevel%
