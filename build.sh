#!/usr/bin/env bash
# ============================================================
#  This file is part of DataLaVista™
#  build.sh: DataLaVista™ build script (Linux / macOS / GitHub Actions).
#  Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
#  Created: 2026-03-24
#  Last Modified: 2026-10-27
#  Summary: Packs the libraries in src/lib and the app source into datalavista.js, DataLaVista.html,
#           DataLaVista-nojs.html, and DataLaVista-sp.html.txt. build.ps1 does the same work in PowerShell.
#  Notes: See README file for documentation and full license information.
#  Website: https://github.com/DepressionCenter/datalavista
#
#  Copyright © 2026 The Regents of the University of Michigan
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
#  ================================================================ */
set -euo pipefail

### Load Configuration ###
SRC="src"
LIB_DIR="$SRC/lib"
CHECKSUM_FILE="$LIB_DIR/sha256sums.txt"
# Folder that receives the built files
OUT_DIR="."
# Python 3 is used for the small text transformations; set PYTHON when the command has another name.
# Each snippet writes UTF-8 bytes itself, so the build gives the same result whatever the console encoding is.
PYTHON="${PYTHON:-python3}"

fail() {
  echo "Build failed: $1" >&2
  exit 1
}

# Read license template and substitute {GIT_HASH} placeholder if present
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
LICENSE_TEXT=$(sed "s/{GIT_HASH}/$GIT_HASH/g" "$SRC/license-template.txt")

# Collect the app source files in sort order
JS_FILES=$(ls "$SRC"/[0-9][0-9]-*.js | sort)

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Helper: get or download esbuild ───────────────────────────────────────────
ESBUILD_VERSION="0.28.0"
ESBUILD_CACHE_DIR="$HOME/.cache/datalavista-build"

# Prints the esbuild package name for an operating system and a processor, as reported by
# "uname -s" and "uname -m", such as linux-x64 or darwin-arm64. Prints nothing when esbuild
# publishes no package for that pair. Windows users run build.ps1 instead of this script.
esbuild_platform() {
  local os="" arch=""
  case "$1" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
  esac
  case "$2" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
  esac
  if [ -n "$os" ] && [ -n "$arch" ]; then echo "${os}-${arch}"; fi
}

# Prints the path of an esbuild executable: one already on the PATH, one cached by an earlier
# build, or one downloaded now. Each platform and version gets its own cached file, so a cache
# shared between computers can never hand out an executable built for another system.
get_esbuild() {
  if command -v esbuild >/dev/null 2>&1; then echo "esbuild"; return; fi
  local platform cached tmpdir extracted
  platform="$(esbuild_platform "$(uname -s)" "$(uname -m)")"
  if [ -z "$platform" ]; then
    echo "Build failed: esbuild $ESBUILD_VERSION has no package for $(uname -s) on $(uname -m). Install esbuild $ESBUILD_VERSION and put it on your PATH, or run build.ps1 on Windows." >&2
    exit 1
  fi
  cached="$ESBUILD_CACHE_DIR/esbuild-${ESBUILD_VERSION}-${platform}"
  if [ -x "$cached" ]; then echo "$cached"; return; fi
  echo "  Downloading esbuild v${ESBUILD_VERSION} for ${platform}..." >&2
  mkdir -p "$ESBUILD_CACHE_DIR"
  tmpdir="$(mktemp -d)"
  curl -fsSL "https://registry.npmjs.org/@esbuild/${platform}/-/${platform}-${ESBUILD_VERSION}.tgz" -o "$tmpdir/esbuild.tgz"
  tar -xzf "$tmpdir/esbuild.tgz" -C "$tmpdir"
  extracted="$(find "$tmpdir" -name 'esbuild' -type f | head -1)"
  if [ -z "$extracted" ]; then
    echo "Build failed: the esbuild package for ${platform} did not contain an executable. Delete $tmpdir and run the build again." >&2
    exit 1
  fi
  cp "$extracted" "$cached"
  chmod +x "$cached"
  rm -rf "$tmpdir"
  echo "$cached"
}
ESBUILD=$(get_esbuild)

if command -v sha256sum > /dev/null 2>&1; then
  file_sha256() { sha256sum "$1" | cut -d ' ' -f 1; }
elif command -v shasum > /dev/null 2>&1; then
  file_sha256() { shasum -a 256 "$1" | cut -d ' ' -f 1; }
else
  fail "this script needs sha256sum or shasum to check the library files. Install one of them and run the build again."
fi

# ── Helper: strip first block comment (/* */ or <!-- -->) from a file ────────
# Usage: strip_license <filepath> <js|html>
strip_license() {
  local file="$1"
  local type="$2"
  "$PYTHON" - "$file" "$type" <<'PYEOF'
import sys, re
path, ftype = sys.argv[1], sys.argv[2]
text = open(path, encoding='utf-8-sig').read()
if ftype == 'js':
    text = re.sub(r'(?s)^\s*/\*.*?\*/[ \t]*(\r?\n)?', '', text, count=1)
elif ftype == 'html':
    text = re.sub(r'(?s)^\s*<!--.*?-->[ \t]*(\r?\n)?', '', text, count=1)
sys.stdout.buffer.write(text.encode('utf-8'))
PYEOF
}

# ── Helper: prepend HTML license comment to an already-written output file ────
prepend_html_license() {
  local output="$1"
  local tmp
  tmp=$(mktemp)
  { printf '<!--\n'; printf '%s\n' "$LICENSE_TEXT"; printf '%s\n' '-->'; cat "$output"; } > "$tmp"
  mv "$tmp" "$output"
}

### Validate Inputs ###
for source_file in 00-full-page.html before-libraries.js after-libraries.js DataLaVista-sp.html.txt license-template.txt lib/sha256sums.txt; do
  [ -f "$SRC/$source_file" ] || fail "src/$source_file is missing. Restore it from git and run the build again."
done

# Every file in src/lib/sha256sums.txt must exist and match, in the order listed, which is also the
# order the scripts are packed in. Scripts are packed, style sheets are inlined, and the one .wasm
# file is embedded as base64 for the SQLite reader.
LIB_SCRIPTS=()
LIB_STYLES=()
LIB_WASM=""
LISTED=" "
while read -r expected_hash library_name; do
  [ -n "${expected_hash:-}" ] || continue
  [ -f "$LIB_DIR/$library_name" ] || fail "src/lib/$library_name is listed in src/lib/sha256sums.txt but the file is missing."
  actual_hash="$(file_sha256 "$LIB_DIR/$library_name")"
  if [ "$actual_hash" != "$expected_hash" ]; then
    fail "src/lib/$library_name does not match its checksum in src/lib/sha256sums.txt. If you replaced this library on purpose, update its line in that file and in THIRD-PARTY-NOTICES.md."
  fi
  case "$library_name" in
    *.js) LIB_SCRIPTS+=("$library_name") ;;
    *.css) LIB_STYLES+=("$library_name") ;;
    *.wasm)
      [ -z "$LIB_WASM" ] || fail "src/lib/sha256sums.txt lists more than one .wasm file, but the build embeds exactly one for the SQLite reader."
      LIB_WASM="$library_name" ;;
    *) fail "src/lib/$library_name has a file type the build does not handle. List only .js, .css, and .wasm files in src/lib/sha256sums.txt." ;;
  esac
  LISTED="$LISTED$library_name "
done < <(tr -d '\r' < "$CHECKSUM_FILE")
[ "${#LIB_SCRIPTS[@]}" -gt 0 ] || fail "src/lib/sha256sums.txt lists no script files."
[ -n "$LIB_WASM" ] || fail "src/lib/sha256sums.txt lists no .wasm file for the SQLite reader."
for library_path in "$LIB_DIR"/*; do
  library_name="$(basename "$library_path")"
  case "$library_name" in sha256sums.txt|*.license.txt|*.notice.txt) continue ;; esac
  case "$LISTED" in *" $library_name "*) ;; *) fail "src/lib/$library_name is not listed in src/lib/sha256sums.txt. Add its checksum there, or delete the file." ;; esac
done

### Prepare Output Folder ###
mkdir -p "$OUT_DIR"
echo "Building DataLaVista into $OUT_DIR/..."

# ── Strip license from HTML template once; reuse the clean copy ───────────────
strip_license "$SRC/00-full-page.html" "html" > "$TMP_DIR/clean_template.html"

# ── Extract body content for _DLV_SHELL_HTML ─────────────────────────────────
# Extract inner body (between <body> and </body>), strip the scripts placeholder block.
DLV_SHELL_VAR=$("$PYTHON" - "$SRC/00-full-page.html" <<'PYEOF'
import sys, re, json
html = open(sys.argv[1], encoding='utf-8-sig').read()
body_match = re.search(r'(?s)<body>(.*)</body>', html)
body_raw = body_match.group(1)
body_content = re.sub(
    r'(?s)\s*<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_OPEN -->.*?<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_CLOSE -->',
    '',
    body_raw
)
sys.stdout.buffer.write(('var _DLV_SHELL_HTML = ' + json.dumps(body_content) + ';').encode('utf-8'))
PYEOF
)

# ── Build _DLV_HEAD_CSS: the library style sheets, then the app's own styles ──
# The library styles come first so the app's rules win where they overlap.
STYLE_PATHS=()
for style_name in ${LIB_STYLES[@]+"${LIB_STYLES[@]}"}; do STYLE_PATHS+=("$LIB_DIR/$style_name"); done
DLV_HEAD_CSS_VAR=$("$PYTHON" - "$SRC/00-full-page.html" ${STYLE_PATHS[@]+"${STYLE_PATHS[@]}"} <<'PYEOF'
import sys, re, json
html = open(sys.argv[1], encoding='utf-8-sig').read()
style_content = re.search(r'(?s)<style>(.*?)</style>', html).group(1)
vendor_css = ''
for path in sys.argv[2:]:
    css = open(path, encoding='utf-8-sig').read().replace('\r\n', '\n')
    if '</style' in css.lower():
        sys.exit('Build failed: ' + path + ' contains "</style>", which would end the style block early. Remove it from the file.')
    vendor_css += css + '\n'
head_css_html = '<style id="dlv-vendor-styles">' + vendor_css + '</style>\n<style id="dlv-styles">' + style_content + '</style>'
sys.stdout.buffer.write(('var _DLV_HEAD_CSS = ' + json.dumps(head_css_html) + ';').encode('utf-8'))
PYEOF
)

# ── Embed the SQLite reader's WebAssembly file as base64 ─────────────────────
{
  printf 'var _DLV_SQL_WASM_BASE64 = "'
  base64 < "$LIB_DIR/$LIB_WASM" | tr -d '\n'
  printf '";\n'
} > "$TMP_DIR/wasm_var.js"

# ── Extract <head>...</head> for the minimal pages ───────────────────────────
# The built script adds the styles itself, so the head keeps only the metadata and title.
DLV_HEAD_SECTION=$("$PYTHON" - "$TMP_DIR/clean_template.html" <<'PYEOF'
import sys, re
html = open(sys.argv[1], encoding='utf-8-sig').read()
m = re.search(r'(?s)^.*?</head>', html)
head = m.group(0)
head = re.sub(r'\s*<link[^>]+rel=[\'"]stylesheet[\'"][^>]*/>', '', head)
head = re.sub(r'(?s)\s*<!--[^-]*Custom styles[^-]*-->\s*<style>.*?</style>', '', head)
sys.stdout.buffer.write(head.encode('utf-8'))
PYEOF
)

# ── 1. Minify the app source ─────────────────────────────────────────────────
# Only the app is minified. The libraries are copied byte for byte, so they still match
# src/lib/sha256sums.txt and keep their own license banners.
echo "Building datalavista.js..."
{
  echo "(() => {"
  echo "  'use strict';"
  for f in $JS_FILES; do
    echo ""
    echo "  /* === $(basename "$f") === */"
    strip_license "$f" "js"
    echo ""
  done
  echo ""
  echo "})();"
} > "$TMP_DIR/app.js"

"$ESBUILD" "$TMP_DIR/app.js" \
  --bundle=false --platform=browser \
  --minify-whitespace --minify-syntax \
  --log-level=error > "$TMP_DIR/app.min.js"

# ── 2. Assemble datalavista.js ───────────────────────────────────────────────
# Order matters: the loader guard must be the first statement, each library runs at the top
# level so it creates its global, and the app runs last inside its own strict-mode function.
{
  echo "/* ============================================================"
  printf '%s\n' "$LICENSE_TEXT"
  echo ""
  echo "This file also contains the third-party libraries listed in THIRD-PARTY-NOTICES.md,"
  echo "each under its own license. Their license texts are in that file and in src/lib."
  echo "================================================================ */"
  echo ""
  strip_license "$SRC/before-libraries.js" "js"
  for library_name in "${LIB_SCRIPTS[@]}"; do
    echo ""
    echo "/* === src/lib/$library_name === */"
    tr -d '\r' < "$LIB_DIR/$library_name"
    echo ""
  done
  echo ""
  strip_license "$SRC/after-libraries.js" "js"
  echo ""
  echo "$DLV_SHELL_VAR"
  echo "$DLV_HEAD_CSS_VAR"
  cat "$TMP_DIR/wasm_var.js"
  echo ""
  cat "$TMP_DIR/app.min.js"
} > "$TMP_DIR/datalavista.js"

# A script that contains "</script" cannot be placed inline in DataLaVista.html
if grep -qi '</script' "$TMP_DIR/datalavista.js"; then
  fail "the built script contains \"</script\", which would end the inline script in DataLaVista.html early. Find the source of that text and change it."
fi
cp "$TMP_DIR/datalavista.js" "$OUT_DIR/datalavista.js"
echo "  -> $OUT_DIR/datalavista.js ($(wc -c < "$OUT_DIR/datalavista.js") bytes)"

# ── 3. Build DataLaVista-nojs.html ───────────────────────────────────────────
echo "Building DataLaVista-nojs.html..."
{
  printf '<!DOCTYPE html>\n'
  printf '%s\n' "$DLV_HEAD_SECTION"
  printf '<body>\n  <div id="dlv-root"></div>\n  <script src="datalavista.js"></script>\n</body>\n</html>\n'
} > "$OUT_DIR/DataLaVista-nojs.html"
prepend_html_license "$OUT_DIR/DataLaVista-nojs.html"
echo "  -> $OUT_DIR/DataLaVista-nojs.html"

# ── 4. Build DataLaVista.html (everything inline) ────────────────────────────
echo "Building DataLaVista.html (inline)..."
{
  printf '<!DOCTYPE html>\n'
  printf '%s\n' "$DLV_HEAD_SECTION"
  printf '<body>\n  <div id="dlv-root"></div>\n  <script>\n'
  cat "$TMP_DIR/datalavista.js"
  printf '\n  </script>\n</body>\n</html>\n'
} > "$OUT_DIR/DataLaVista.html"
prepend_html_license "$OUT_DIR/DataLaVista.html"
echo "  -> $OUT_DIR/DataLaVista.html"

# ── 5. Copy the SharePoint web part snippet ──────────────────────────────────
tr -d '\r' < "$SRC/DataLaVista-sp.html.txt" > "$OUT_DIR/DataLaVista-sp.html.txt"
echo "  -> $OUT_DIR/DataLaVista-sp.html.txt"

# ── 6. Check the outputs that run the application ────────────────────────────
# Without these the page shows nothing, a library is missing, or the SQLite reader cannot start.
for output in "$OUT_DIR/datalavista.js" "$OUT_DIR/DataLaVista.html"; do
  for marker in 'var _DLV_SHELL_HTML = ' 'var _DLV_HEAD_CSS = ' 'var _DLV_SQL_WASM_BASE64 = ' '_dlvRestoreModuleLoaders' 'make_xlsx_lib' 'registerCustomSeries' 'initSqlJs'; do
    if ! grep -qF "$marker" "$output"; then
      fail "$output is missing '$marker', so the page would not work. Check src/lib/sha256sums.txt and the source files, then build again."
    fi
  done
done
echo ""
echo "Build completed at $(date '+%Y-%m-%d %I:%M:%S %p')."
