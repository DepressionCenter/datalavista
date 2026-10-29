#!/bin/bash
# This file is part of ZippyServe
# build.sh
# Author(s): Gabriel Mongefranco; Eisenberg Family Depression Center.
# Created: 2026-07-26
# Summary: Cross-compiles ZippyServe for Windows, Linux, and macOS (amd64 + arm64)
#          into /bin, using plain Go cross-compilation (no CGO, no external deps).
# Notes: See README file for documentation and full license information.
#
# Copyright © 2026 The Regents of the University of Michigan
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
# You should have received a copy of the GNU General Public License along
# with this program. If not, see <https://www.gnu.org/licenses/>.

set -euo pipefail

# Path or command name for the Go toolchain. Defaults to "go" on PATH;
# override with GO_BIN=/path/to/go ./build.sh if your toolchain isn't on PATH.
GO_BIN="${GO_BIN:-go}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$REPO_ROOT/src/server"
BIN_DIR="$REPO_ROOT/bin"

### Resolve Go toolchain ###
if ! command -v "$GO_BIN" &> /dev/null; then
    echo "Go toolchain '$GO_BIN' not found. Add Go to PATH, or run: GO_BIN=/path/to/go ./build.sh" >&2
    exit 1
fi

mkdir -p "$BIN_DIR"

### Build targets: GOOS GOARCH output-filename ###
TARGETS=(
    "windows amd64 ZippyServe.exe"
    "linux amd64 ZippyServe-linux-amd64"
    "darwin amd64 ZippyServe-mac-amd64"
    "darwin arm64 ZippyServe-mac-arm64"
)

for target in "${TARGETS[@]}"; do
    read -r goos goarch out <<< "$target"
    echo "Building $goos/$goarch -> bin/$out"

    GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 \
        "$GO_BIN" build -C "$SERVER_DIR" -o "$BIN_DIR/$out" .

    chmod +x "$BIN_DIR/$out" 2>/dev/null || true
    size=$(du -h "$BIN_DIR/$out" | cut -f1)
    echo "  OK  ($size)"
done

echo "All targets built into $BIN_DIR"
