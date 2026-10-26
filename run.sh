#!/usr/bin/env bash
# This file is part of DataLaVista™
# run.sh
# Author(s): PHJ2000.
# Created: 2026-10-26
# Last Modified: 2026-10-26
# Summary: Starts DataLaVista over local HTTP on Linux or macOS.
# Notes: See README file for documentation and full license information.
# 
# Copyright © 2026 The Regents of the University of Michigan
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License along
# with this program. If not, see <https://www.gnu.org/licenses/>.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8010}"
if [[ $# -gt 1 || ! "$PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$PORT < 1 || 10#$PORT > 65535 )); then
    echo "Usage: bash run.sh [port from 1 to 65535]" >&2
    exit 2
fi
PORT=$((10#$PORT))
case "$(uname -s):$(uname -m)" in
    Linux:x86_64) EXE="ZippyServe-linux-amd64" ;;
    Darwin:x86_64) EXE="ZippyServe-mac-amd64" ;;
    Darwin:arm64) EXE="ZippyServe-mac-arm64" ;;
    *) echo "This system is not supported. Use Linux x86-64 or macOS Intel/Apple silicon." >&2; exit 1 ;;
esac
if [[ ! -x "$SCRIPT_DIR/bin/$EXE" ]]; then
    echo "ZippyServe is missing or not executable. Restore bin/ and its executable permissions." >&2
    exit 1
fi
if [[ ! -f "$SCRIPT_DIR/DataLaVista.html" ]]; then
    echo "DataLaVista.html is missing. Restore it from the project download." >&2
    exit 1
fi
printf 'Open http://127.0.0.1:%s/DataLaVista.html in your browser. Press Ctrl+C to stop.
' "$PORT"
exec "$SCRIPT_DIR/bin/$EXE" -port "$PORT" -index "$SCRIPT_DIR/DataLaVista.html"
