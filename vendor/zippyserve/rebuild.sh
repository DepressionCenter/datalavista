#!/usr/bin/env bash
# This file is part of DataLaVista™
# vendor/zippyserve/rebuild.sh
# Author(s): PHJ2000.
# Created: 2026-10-28
# Last Modified: 2026-10-28
# Summary: Builds the bundled ZippyServe binaries from the included source.
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
GO_BIN="${GO_BIN:-go}"
if [[ "$("$GO_BIN" version)" != "go version go1.26.10 "* ]]; then
    echo "Go 1.26.10 is required to reproduce the bundled binaries. Set GO_BIN to that toolchain." >&2
    exit 1
fi
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/src/server"
BIN_DIR="$(cd -- "$SOURCE_DIR/../../../.." && pwd)/bin"
mkdir -p "$BIN_DIR"
for target in 'linux amd64 ZippyServe-linux-amd64' 'windows amd64 ZippyServe.exe' 'darwin amd64 ZippyServe-mac-amd64' 'darwin arm64 ZippyServe-mac-arm64'; do
    read -r goos goarch filename <<< "$target"
    GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 GOTOOLCHAIN=local \
        "$GO_BIN" build -C "$SOURCE_DIR" -trimpath -buildvcs=false -o "$BIN_DIR/$filename" .
done
