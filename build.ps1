# ============================================================
#  This file is part of DataLaVista™
#  build.ps1: DataLaVista™ build script (Windows PowerShell).
#  Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
#  Created: 2026-03-24
#  Last Modified: 2026-10-27
#  Summary: Packs the libraries in src/lib and the app source into datalavista.js, DataLaVista.html,
#           DataLaVista-nojs.html, and DataLaVista-sp.html.txt. build.sh does the same work in Bash.
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

### Load Configuration ###
$SRC = 'src'
$LibDir = Join-Path $SRC 'lib'
$ChecksumFile = Join-Path $LibDir 'sha256sums.txt'
# Folder that receives the built files
$OutDir = '.'
# UTF-8 without a byte order mark, so the outputs match build.sh
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Stop-Build([string]$Message) {
    [Console]::Error.WriteLine("Build failed: $Message")
    exit 1
}

# Reads a text file as UTF-8 with carriage returns removed, so a Windows checkout builds the same text as Linux.
function Read-Text([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8).Replace("`r", '')
}

# Read license template and substitute {GIT_HASH} placeholder if present
$SourceHash = (& git rev-parse --short HEAD 2>$null)
if (-not $SourceHash) { $SourceHash = 'unknown' }
$LicenseText = (Read-Text (Join-Path $SRC 'license-template.txt')).TrimEnd().Replace('{GIT_HASH}', $SourceHash)

# Collect the app source files in sort order
$JsFiles = Get-ChildItem "$SRC\[0-9][0-9]-*.js" | Sort-Object Name

$TmpDir = Join-Path $env:TEMP ("datalavista-build-" + [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

# ── Helper: get or download esbuild ──────────────────────────────────────────
$EsBuildVersion  = '0.28.0'
$EsBuildCacheDir = "$env:LOCALAPPDATA\datalavista-build"

# Returns the esbuild package name for a Windows processor as reported by PROCESSOR_ARCHITECTURE,
# such as win32-x64 or win32-arm64, or an empty string when esbuild publishes no package for it.
function Get-EsBuildPlatform {
    param([string]$Architecture)
    switch (($Architecture -as [string]).ToUpperInvariant()) {
        'AMD64' { return 'win32-x64' }
        'ARM64' { return 'win32-arm64' }
        'X86'   { return 'win32-ia32' }
        default { return '' }
    }
}

# Returns the path of an esbuild executable: one already on the PATH, one cached by an earlier
# build, or one downloaded now. Each platform and version gets its own cached file.
function Get-EsBuild {
    if (Get-Command esbuild -ErrorAction SilentlyContinue) { return 'esbuild' }
    $platform = Get-EsBuildPlatform $env:PROCESSOR_ARCHITECTURE
    if (-not $platform) {
        Stop-Build "esbuild $EsBuildVersion has no package for a $env:PROCESSOR_ARCHITECTURE processor. Install esbuild $EsBuildVersion and put it on your PATH."
    }
    $cached = Join-Path $EsBuildCacheDir "esbuild-$EsBuildVersion-$platform.exe"
    if (Test-Path $cached) { return $cached }
    Write-Host "  Downloading esbuild v$EsBuildVersion for $platform..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $EsBuildCacheDir | Out-Null
    $extractDir = Join-Path $env:TEMP ("datalavista-esbuild-" + [System.IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Force -Path $extractDir | Out-Null
    $tgz = Join-Path $extractDir 'esbuild.tgz'
    Invoke-WebRequest "https://registry.npmjs.org/@esbuild/$platform/-/$platform-$EsBuildVersion.tgz" -OutFile $tgz
    tar -xzf $tgz -C $extractDir
    $bin = Get-ChildItem $extractDir -Filter 'esbuild.exe' -Recurse | Select-Object -First 1
    if (-not $bin) {
        Stop-Build "the esbuild package for $platform did not contain esbuild.exe. Delete $extractDir and run the build again."
    }
    Copy-Item $bin.FullName $cached
    Remove-Item $extractDir -Recurse -Force
    return $cached
}
$EsBuild = Get-EsBuild

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

### Validate Inputs ###
foreach ($sourceFile in @('00-full-page.html', 'before-libraries.js', 'after-libraries.js', 'DataLaVista-sp.html.txt', 'license-template.txt', 'lib\sha256sums.txt')) {
    if (-not (Test-Path -LiteralPath (Join-Path $SRC $sourceFile) -PathType Leaf)) {
        Stop-Build "src/$sourceFile is missing. Restore it from git and run the build again."
    }
}

# Every file in src/lib/sha256sums.txt must exist and match, in the order listed, which is also the
# order the scripts are packed in. Scripts are packed, style sheets are inlined, and the one .wasm
# file is embedded as base64 for the SQLite reader.
$LibScripts = @()
$LibStyles = @()
$LibWasm = ''
$Listed = @()
foreach ($checksumLine in (Read-Text $ChecksumFile).Split("`n")) {
    if ($checksumLine.Trim().Length -eq 0) { continue }
    $parts = $checksumLine.Trim() -split '\s+', 2
    $expectedHash = $parts[0].ToLowerInvariant()
    $libraryName = $parts[1]
    $libraryPath = Join-Path $LibDir $libraryName
    if (-not (Test-Path -LiteralPath $libraryPath -PathType Leaf)) {
        Stop-Build "src/lib/$libraryName is listed in src/lib/sha256sums.txt but the file is missing."
    }
    $actualHash = (Get-FileHash -LiteralPath $libraryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        Stop-Build "src/lib/$libraryName does not match its checksum in src/lib/sha256sums.txt. If you replaced this library on purpose, update its line in that file and in THIRD-PARTY-NOTICES.md."
    }
    if ($libraryName.EndsWith('.js')) { $LibScripts += $libraryName }
    elseif ($libraryName.EndsWith('.css')) { $LibStyles += $libraryName }
    elseif ($libraryName.EndsWith('.wasm')) {
        if ($LibWasm) { Stop-Build 'src/lib/sha256sums.txt lists more than one .wasm file, but the build embeds exactly one for the SQLite reader.' }
        $LibWasm = $libraryName
    } else {
        Stop-Build "src/lib/$libraryName has a file type the build does not handle. List only .js, .css, and .wasm files in src/lib/sha256sums.txt."
    }
    $Listed += $libraryName
}
if ($LibScripts.Count -eq 0) { Stop-Build 'src/lib/sha256sums.txt lists no script files.' }
if (-not $LibWasm) { Stop-Build 'src/lib/sha256sums.txt lists no .wasm file for the SQLite reader.' }
foreach ($libraryFile in Get-ChildItem -LiteralPath $LibDir -File) {
    $name = $libraryFile.Name
    if ($name -eq 'sha256sums.txt' -or $name.EndsWith('.license.txt') -or $name.EndsWith('.notice.txt')) { continue }
    if ($Listed -notcontains $name) {
        Stop-Build "src/lib/$name is not listed in src/lib/sha256sums.txt. Add its checksum there, or delete the file."
    }
}

### Prepare Output Folder ###
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Host "Building DataLaVista into $OutDir/..."

# ── Strip license from HTML template once; reuse the clean copy ───────────────
$RawHtml = Read-Text (Join-Path $SRC '00-full-page.html')
$CleanTemplate = Strip-LicenseHtml $RawHtml
$HtmlLicenseComment = "<!--`n$LicenseText`n-->`n"

# ── Extract body content for _DLV_SHELL_HTML ─────────────────────────────────
# Extract inner body content (between <body> and </body>), strip the scripts placeholder block.
$bodyMatch = [regex]::Match($RawHtml, '(?s)<body>(.*)</body>')
$bodyRaw = $bodyMatch.Groups[1].Value
$bodyContent = [regex]::Replace($bodyRaw, '(?s)\s*<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_OPEN -->.*?<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_CLOSE -->', '')
$ShellHtmlVar = 'var _DLV_SHELL_HTML = ' + ($bodyContent | ConvertTo-Json -Compress) + ';'

# ── Build _DLV_HEAD_CSS: the library style sheets, then the app's own styles ──
# The library styles come first so the app's rules win where they overlap.
$styleContent = [regex]::Match($RawHtml, '(?s)<style>(.*?)</style>').Groups[1].Value
$vendorCss = ''
foreach ($styleName in $LibStyles) {
    $css = Read-Text (Join-Path $LibDir $styleName)
    if ($css.ToLowerInvariant().Contains('</style')) {
        Stop-Build "src/lib/$styleName contains `"</style>`", which would end the style block early. Remove it from the file."
    }
    $vendorCss += $css + "`n"
}
$headCssHtml = '<style id="dlv-vendor-styles">' + $vendorCss + '</style>' + "`n" + '<style id="dlv-styles">' + $styleContent + '</style>'
$DlvHeadCssVar = 'var _DLV_HEAD_CSS = ' + ($headCssHtml | ConvertTo-Json -Compress) + ';'

# ── Embed the SQLite reader's WebAssembly file as base64 ─────────────────────
$WasmVar = 'var _DLV_SQL_WASM_BASE64 = "' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $LibDir $LibWasm))) + '";'

# ── Extract <head>...</head> for the minimal pages ───────────────────────────
# The built script adds the styles itself, so the head keeps only the metadata and title.
$headEnd = $CleanTemplate.IndexOf('</head>') + '</head>'.Length
$HeadSection = $CleanTemplate.Substring(0, $headEnd)
$HeadSection = [regex]::Replace($HeadSection, '\s*<link[^>]+rel=["\x27]stylesheet["\x27][^>]*/>', '')
$HeadSection = [regex]::Replace($HeadSection, '(?s)\s*<!--[^-]*Custom styles[^-]*-->\s*<style>.*?</style>', '')

# ── 1. Minify the app source ─────────────────────────────────────────────────
# Only the app is minified. The libraries are copied as they are, so they still match
# src/lib/sha256sums.txt and keep their own license banners.
Write-Host 'Building datalavista.js...'
$appSb = [System.Text.StringBuilder]::new()
$null = $appSb.Append("(() => {`n  'use strict';`n")
foreach ($f in $JsFiles) {
    $null = $appSb.Append("`n  /* === $($f.Name) === */`n")
    $null = $appSb.Append((Strip-LicenseJs (Read-Text $f.FullName)))
    $null = $appSb.Append("`n")
}
$null = $appSb.Append("`n})();`n")
$appPath = Join-Path $TmpDir 'app.js'
$appMinPath = Join-Path $TmpDir 'app.min.js'
[System.IO.File]::WriteAllText($appPath, $appSb.ToString(), $Utf8NoBom)
& $EsBuild $appPath --bundle=false --platform=browser --minify-whitespace --minify-syntax --log-level=error "--outfile=$appMinPath"
if ($LASTEXITCODE -ne 0) { Stop-Build 'esbuild could not minify the app source. Fix the errors it printed and run the build again.' }
$appMinified = Read-Text $appMinPath

# ── 2. Assemble datalavista.js ───────────────────────────────────────────────
# Order matters: the loader guard must be the first statement, each library runs at the top
# level so it creates its global, and the app runs last inside its own strict-mode function.
$sb = [System.Text.StringBuilder]::new()
$null = $sb.Append("/* ============================================================`n")
$null = $sb.Append($LicenseText + "`n`n")
$null = $sb.Append("This file also contains the third-party libraries listed in THIRD-PARTY-NOTICES.md,`n")
$null = $sb.Append("each under its own license. Their license texts are in that file and in src/lib.`n")
$null = $sb.Append("================================================================ */`n`n")
$null = $sb.Append((Strip-LicenseJs (Read-Text (Join-Path $SRC 'before-libraries.js'))))
foreach ($libraryName in $LibScripts) {
    $null = $sb.Append("`n/* === src/lib/$libraryName === */`n")
    $null = $sb.Append((Read-Text (Join-Path $LibDir $libraryName)))
    $null = $sb.Append("`n")
}
$null = $sb.Append("`n")
$null = $sb.Append((Strip-LicenseJs (Read-Text (Join-Path $SRC 'after-libraries.js'))))
$null = $sb.Append("`n" + $ShellHtmlVar + "`n" + $DlvHeadCssVar + "`n" + $WasmVar + "`n`n" + $appMinified)
$finalJs = $sb.ToString()

# A script that contains "</script" cannot be placed inline in DataLaVista.html
if ($finalJs.ToLowerInvariant().Contains('</script')) {
    Stop-Build 'the built script contains "</script", which would end the inline script in DataLaVista.html early. Find the source of that text and change it.'
}
$jsOut = Join-Path $OutDir 'datalavista.js'
[System.IO.File]::WriteAllText($jsOut, $finalJs, $Utf8NoBom)
Write-Host "  -> $OutDir/datalavista.js ($((Get-Item $jsOut).Length) bytes)"

# ── 3. Build DataLaVista-nojs.html ───────────────────────────────────────────
Write-Host 'Building DataLaVista-nojs.html...'
$noJsShell = "<!DOCTYPE html>`n" + $HeadSection + "`n<body>`n  <div id=`"dlv-root`"></div>`n  <script src=`"datalavista.js`"></script>`n</body>`n</html>`n"
[System.IO.File]::WriteAllText((Join-Path $OutDir 'DataLaVista-nojs.html'), ($HtmlLicenseComment + $noJsShell), $Utf8NoBom)
Write-Host "  -> $OutDir/DataLaVista-nojs.html"

# ── 4. Build DataLaVista.html (everything inline) ────────────────────────────
Write-Host 'Building DataLaVista.html (inline)...'
$inlineShell = "<!DOCTYPE html>`n" + $HeadSection + "`n<body>`n  <div id=`"dlv-root`"></div>`n  <script>`n" + $finalJs + "`n  </script>`n</body>`n</html>`n"
[System.IO.File]::WriteAllText((Join-Path $OutDir 'DataLaVista.html'), ($HtmlLicenseComment + $inlineShell), $Utf8NoBom)
Write-Host "  -> $OutDir/DataLaVista.html"

# ── 5. Copy the SharePoint web part snippet ──────────────────────────────────
[System.IO.File]::WriteAllText((Join-Path $OutDir 'DataLaVista-sp.html.txt'), (Read-Text (Join-Path $SRC 'DataLaVista-sp.html.txt')), $Utf8NoBom)
Write-Host "  -> $OutDir/DataLaVista-sp.html.txt"

Remove-Item $TmpDir -Recurse -Force

# ── 6. Check the outputs that run the application ────────────────────────────
# Without these the page shows nothing, a library is missing, or the SQLite reader cannot start.
foreach ($output in @((Join-Path $OutDir 'datalavista.js'), (Join-Path $OutDir 'DataLaVista.html'))) {
    $outputText = [System.IO.File]::ReadAllText($output, [System.Text.Encoding]::UTF8)
    foreach ($marker in @('var _DLV_SHELL_HTML = ', 'var _DLV_HEAD_CSS = ', 'var _DLV_SQL_WASM_BASE64 = ', '_dlvRestoreModuleLoaders', 'make_xlsx_lib', 'registerCustomSeries', 'initSqlJs')) {
        if (-not $outputText.Contains($marker)) {
            Stop-Build "$output is missing '$marker', so the page would not work. Check src/lib/sha256sums.txt and the source files, then build again."
        }
    }
}

Write-Host ''
Write-Host ("Build completed at {0:yyyy-MM-dd hh:mm:ss tt}." -f (Get-Date))

# Simple web server for testing; pass --start to start the server or --stop to stop it
$StartPage = if ($OutDir -eq '.') { 'DataLaVista.html' } else { "$OutDir/DataLaVista.html" }
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

            if ([string]::IsNullOrWhiteSpace(`$path)) { `$path = '$StartPage' }
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
    Start-Process "http://localhost:$Port/$StartPage"

    # 4. Print helpful instructions
    Write-Host "--------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Server is running at http://localhost:$Port" -ForegroundColor Green
    Write-Host "To stop the server, run: .\build.ps1 --stop" -ForegroundColor Cyan
}
