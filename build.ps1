# ============================================================
#  This file is part of DataLaVista™
#  build.ps1: DataLaVista™ build script (Windows PowerShell).
#  Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
#  Created: 2026-03-24
#  Last Modified: 2026-04-27
#  Summary: Generates datalavista.js, DataLaVista.html, DataLaVista-nojs.html, DataLaVista-dev.html.
#  Notes: See README file for documentation and full license information.
#  Website: https://github.com/DepressionCenter/datalavista
#
#  Copyright (c) 2026 The Regents of the University of Michigan
#
#  This program is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
#  GNU General Public License for more details.
#  You should have received a copy of the GNU General Public License along
#  with this program. If not, see <https://www.gnu.org/licenses/>.
#  ================================================================

$ErrorActionPreference = 'Stop'
$SRC = 'src'
$PlaceholderPattern = '(?s)<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_OPEN -->.*?<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_CLOSE -->'

# Read license template and substitute {GIT_HASH} placeholder if present
$SourceHash = (& git rev-parse --short HEAD 2>$null)
if (-not $SourceHash) { $SourceHash = 'unknown' }
$LicenseText = [System.IO.File]::ReadAllText("$SRC\license-template.txt", [System.Text.Encoding]::UTF8).TrimEnd()
$LicenseText = $LicenseText.Replace('{GIT_HASH}', $SourceHash)

# Collect JS source files in sort order
$JsFiles = Get-ChildItem "$SRC\[0-9][0-9]-*.js" | Sort-Object Name

# ── Helper: strip first /* */ block comment from a JS string ─────────────────
function Strip-LicenseJs {
    param([string]$Text)
    return [regex]::Replace($Text, '(?s)^\s*/\*.*?\*/[ \t]*(\r?\n)?', '')
}

# ── Helper: strip first <!-- --> block comment from an HTML string ────────────
function Strip-LicenseHtml {
    param([string]$Text)
    return [regex]::Replace($Text, '(?s)^\s*<!--.*?-->[ \t]*(\r?\n)?', '')
}

# ── Strip license from HTML template once; reuse the clean copy ───────────────
$CleanTemplate = Strip-LicenseHtml ([System.IO.File]::ReadAllText("$SRC\00-full-page.html", [System.Text.Encoding]::UTF8))
$HtmlLicenseComment = "<!--`n$LicenseText`n-->`n"

# ── Helper: replace placeholder and write HTML output with license prepended ──
function Write-HtmlOutput {
    param([string]$Snippet, [string]$OutputPath)
    $result = [regex]::Replace(
        $CleanTemplate,
        $PlaceholderPattern,
        [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $Snippet }
    )
    [System.IO.File]::WriteAllText($OutputPath, ($HtmlLicenseComment + $result), [System.Text.Encoding]::UTF8)
}


# ── 1. Build datalavista.js ──────────────────────────────────────────────────
Write-Host 'Building datalavista.js...'
$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine('/* ============================================================')
$null = $sb.AppendLine($LicenseText)
$null = $sb.AppendLine('================================================================ */')
$null = $sb.AppendLine('')
$null = $sb.AppendLine('(() => {')
$null = $sb.AppendLine("  'use strict';")
foreach ($f in $JsFiles) {
    $null = $sb.AppendLine('')
    $null = $sb.AppendLine("  /* === $($f.Name) === */")
    $rawJs = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $null = $sb.Append((Strip-LicenseJs $rawJs))
    $null = $sb.AppendLine('')
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('})();')
$null = $sb.AppendLine('')
$null = $sb.AppendLine('// Backward-compat shim: re-expose all dlv methods as globals so')
$null = $sb.AppendLine('// onclick="foo()" HTML attributes continue to work.')
$null = $sb.AppendLine('if (window.dlv) {')
$null = $sb.AppendLine('  for (const [k, v] of Object.entries(window.dlv)) {')
$null = $sb.AppendLine("    if (typeof v === 'function' && !Object.prototype.hasOwnProperty.call(window, k)) {")
$null = $sb.AppendLine('      window[k] = (...a) => window.dlv[k](...a);')
$null = $sb.AppendLine('    }')
$null = $sb.AppendLine('  }')
$null = $sb.AppendLine('}')
[System.IO.File]::WriteAllText('datalavista.js', $sb.ToString(), [System.Text.Encoding]::UTF8)
$lineCount = (Get-Content 'datalavista.js').Count
Write-Host "  -> datalavista.js ($lineCount lines)"

# ── 2. Build DataLaVista-nojs.html ─────────────────────────────────────────
Write-Host 'Building DataLaVista-nojs.html...'
Write-HtmlOutput '  <script src="datalavista.js"></script>' 'DataLaVista-nojs.html'
Write-Host '  -> DataLaVista-nojs.html'

# ── 3. Build DataLaVista-dev.html ────────────────────────────────────────────
Write-Host 'Building DataLaVista-dev.html...'
$devTags = ($JsFiles | ForEach-Object { "  <script src=`"$SRC/$($_.Name)`"></script>" }) -join "`n"
Write-HtmlOutput $devTags 'DataLaVista-dev.html'
Write-Host '  -> DataLaVista-dev.html'

# ── 4. Build DataLaVista.html (inline) ──────────────────────────────────────
Write-Host 'Building DataLaVista.html (inline)...'
$inlineSb = [System.Text.StringBuilder]::new()
$null = $inlineSb.AppendLine('  <script>')
foreach ($f in $JsFiles) {
    $rawJs = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $null = $inlineSb.Append((Strip-LicenseJs $rawJs))
    $null = $inlineSb.AppendLine('')
}
$null = $inlineSb.Append('  </script>')
Write-HtmlOutput $inlineSb.ToString() 'DataLaVista.html'
Write-Host '  -> DataLaVista.html'

Write-Host ''
Write-Host ("Build completed at {0:yyyy-MM-dd hh:mm:ss tt}." -f (Get-Date))

# Simple web server for testing; pass --start to start the server or --stop to stop it
if ($args -contains '--stop') {
    $Port = 8080
    Write-Host "Stopping server on port $Port..." -ForegroundColor Yellow
    
    # Finds the specific process using the port and kills it
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process -and $process -gt 4) {
        Stop-Process -Id $process -Force
        Write-Host "Server stopped successfully." -ForegroundColor Green
    } elseif ($process -and $process -le 4) {
        Invoke-WebRequest -Uri "http://localhost:$Port/shutdown" -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "Server stopped successfully." -ForegroundColor Green
    } else {
        Write-Host "No server found running on port $Port." -ForegroundColor Gray
    }
}
elseif ($args -contains '--start') {
    $Port = 8080
    $RootPath = $PSScriptRoot

    # 1. Clean up any existing server first
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
        Select-Object -ExpandProperty OwningProcess -Unique | 
        Stop-Process -Force -ErrorAction SilentlyContinue

    # 2. Server Logic
    $ServerBlock = "
    `$listener = New-Object System.Net.HttpListener
    `$listener.Prefixes.Add('http://localhost:$Port/')
    try {
        `$listener.Start()
        while (`$listener.IsListening) {
            `$context = `$listener.GetContext()
            `$path = `$context.Request.Url.LocalPath.TrimStart('/')

            # --- SHUTDOWN HANDLING ---
            if (`$path -eq 'shutdown') {
                `$context.Response.StatusCode = 200
                `$context.Response.Close() # Send response first
                `$listener.Stop()          # Then stop
                break                      # Exit loop
            }
            
            if ([string]::IsNullOrWhiteSpace(`$path)) { `$path = 'DataLaVista.html' }
            `$fullPath = Join-Path '$RootPath' `$path
            
            if (Test-Path `$fullPath -PathType Leaf) {
                `$ext = [System.IO.Path]::GetExtension(`$fullPath).ToLower()
                if (`$ext -eq '.html') { `$context.Response.ContentType = 'text/html' }
                elseif (`$ext -eq '.js') { `$context.Response.ContentType = 'application/javascript' }
                elseif (`$ext -eq '.css') { `$context.Response.ContentType = 'text/css' }

                `$bytes = [System.IO.File]::ReadAllBytes(`$fullPath)
                `$context.Response.ContentLength64 = `$bytes.Length
                `$context.Response.OutputStream.Write(`$bytes, 0, `$bytes.Length)
            } else {
                `$context.Response.StatusCode = 404
            }
            `$context.Response.Close()
        }
    } finally { `$listener.Stop() }
    "

    # 3. Launch background process
    Start-Process powershell -ArgumentList "-NoProfile", "-Command", $ServerBlock -WindowStyle Hidden
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:$Port/DataLaVista.html"

    # 4. Print helpful instructions
    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Server is running at http://localhost:$Port" -ForegroundColor Green
    Write-Host "To stop the server, run: .\build.ps1 --stop" -ForegroundColor Cyan
}