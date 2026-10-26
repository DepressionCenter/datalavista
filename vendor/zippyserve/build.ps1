# This file is part of ZippyServe
# build.ps1
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

param(
    # Path or command name for the Go toolchain. Defaults to "go" on PATH;
    # override if your toolchain isn't on PATH (e.g. -GoExe "C:\bin\go\bin\go.exe").
    [string]$GoExe = "go"
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$ServerDir = Join-Path $RepoRoot "src\server"
$BinDir = Join-Path $RepoRoot "bin"

### Resolve Go toolchain ###
$ResolvedGo = Get-Command $GoExe -ErrorAction SilentlyContinue
if (-not $ResolvedGo) {
    Write-Error "Go toolchain '$GoExe' not found. Add Go to PATH, or pass -GoExe <path-to-go.exe>."
    exit 1
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

### Build targets: GOOS, GOARCH, output filename ###
$Targets = @(
    @{ GOOS = "windows"; GOARCH = "amd64"; Out = "ZippyServe.exe" },
    @{ GOOS = "linux";   GOARCH = "amd64"; Out = "ZippyServe-linux-amd64" },
    @{ GOOS = "darwin";  GOARCH = "amd64"; Out = "ZippyServe-mac-amd64" },
    @{ GOOS = "darwin";  GOARCH = "arm64"; Out = "ZippyServe-mac-arm64" }
)

foreach ($Target in $Targets) {
    $OutPath = Join-Path $BinDir $Target.Out
    Write-Host "Building $($Target.GOOS)/$($Target.GOARCH) -> bin\$($Target.Out)"

    $env:GOOS = $Target.GOOS
    $env:GOARCH = $Target.GOARCH
    $env:CGO_ENABLED = "0"

    & $ResolvedGo.Source build -C $ServerDir -o $OutPath .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed for $($Target.GOOS)/$($Target.GOARCH)"
        exit $LASTEXITCODE
    }

    $Size = (Get-Item $OutPath).Length
    Write-Host "  OK  ($([math]::Round($Size / 1MB, 2)) MB)"
}

Remove-Item Env:\GOOS, Env:\GOARCH, Env:\CGO_ENABLED -ErrorAction SilentlyContinue
Write-Host "All targets built into $BinDir"
