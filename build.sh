#!/usr/bin/env bash
# ============================================================
#  This file is part of DataLaVista™
#  build.sh: DataLaVista™ build script (Linux / macOS / GitHub Actions).
#  Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
#  Created: 2026-03-24
#  Last Modified: 2026-04-27
#  Summary: Generates datalavista.js, DataLaVista.html, DataLaVista-nojs.html.
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
set -e

SRC="src"

# Read license template and substitute {GIT_HASH} placeholder if present
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
LICENSE_TEXT=$(sed "s/{GIT_HASH}/$GIT_HASH/g" "$SRC/license-template.txt")

# Collect JS source files in sort order
JS_FILES=$(ls "$SRC"/[0-9][0-9]-*.js | sort)

# ── Helper: get or download esbuild ───────────────────────────────────────────
ESBUILD_VERSION="0.28.0"
ESBUILD_CACHE="$HOME/.cache/datalavista-build/esbuild"

get_esbuild() {
  if command -v esbuild >/dev/null 2>&1; then echo "esbuild"; return; fi
  if [ -x "$ESBUILD_CACHE" ]; then echo "$ESBUILD_CACHE"; return; fi
  echo "  Downloading esbuild v${ESBUILD_VERSION}..." >&2
  mkdir -p "$(dirname "$ESBUILD_CACHE")"
  curl -fsSL "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-${ESBUILD_VERSION}.tgz" -o /tmp/esbuild.tgz
  mkdir -p /tmp/esbuild-extract
  tar -xzf /tmp/esbuild.tgz -C /tmp/esbuild-extract
  EXTRACTED_BIN=$(find /tmp/esbuild-extract -name 'esbuild' -type f | head -1)
  cp "$EXTRACTED_BIN" "$ESBUILD_CACHE"
  chmod +x "$ESBUILD_CACHE"
  rm -rf /tmp/esbuild.tgz /tmp/esbuild-extract
  echo "$ESBUILD_CACHE"
}
ESBUILD=$(get_esbuild)

# ── Helper: strip first block comment (/* */ or <!-- -->) from a file ────────
# Usage: strip_license <filepath> <js|html>
strip_license() {
  local file="$1"
  local type="$2"
  python3 - "$file" "$type" <<'PYEOF'
import sys, re
path, ftype = sys.argv[1], sys.argv[2]
text = open(path, encoding='utf-8').read()
if ftype == 'js':
    text = re.sub(r'(?s)^\s*/\*.*?\*/[ \t]*(\r?\n)?', '', text, count=1)
elif ftype == 'html':
    text = re.sub(r'(?s)^\s*<!--.*?-->[ \t]*(\r?\n)?', '', text, count=1)
sys.stdout.write(text)
PYEOF
}

# ── Helper: replace placeholder in template using Python (portable) ───────────
replace_placeholder() {
  local template="$1"
  local replacement_file="$2"
  local output="$3"
  python3 - "$template" "$replacement_file" "$output" <<'PYEOF'
import sys, re
template_path, replacement_file, output_path = sys.argv[1], sys.argv[2], sys.argv[3]
template = open(template_path, encoding='utf-8').read()
replacement = open(replacement_file, encoding='utf-8').read()
result = re.sub(
    r'<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_OPEN -->.*?<!-- DATALAVISTA_SCRIPTS_PLACEHOLDER_CLOSE -->',
    lambda m: replacement,
    template,
    count=1,
    flags=re.DOTALL
)
open(output_path, 'w', encoding='utf-8').write(result)
PYEOF
}

# ── Helper: prepend HTML license comment to an already-written output file ────
prepend_html_license() {
  local output="$1"
  local tmp
  tmp=$(mktemp)
  { printf '<!--\n'; printf '%s\n' "$LICENSE_TEXT"; printf '-->\n'; cat "$output"; } > "$tmp"
  mv "$tmp" "$output"
}

# ── Strip license from HTML template once; reuse the clean copy ───────────────
strip_license "$SRC/00-full-page.html" "html" > /tmp/dlv_clean_template.html

# ── 1. Build datalavista.js ──────────────────────────────────────────────────
echo "Building datalavista.js..."
{
  echo "(() => {"
  echo "  'use strict';"
  for f in $JS_FILES; do
    echo ""
    echo "  /* === $(basename "$f") === */"
    strip_license "$f" "js"
  done
  echo ""
  echo "})();"
} > /tmp/dlv_js_body.js

"$ESBUILD" /tmp/dlv_js_body.js \
  --bundle=false --platform=browser \
  --minify-whitespace --minify-syntax \
  --log-level=error > /tmp/dlv_js_minified.js

{
  echo "/* ============================================================"
  printf '%s\n' "$LICENSE_TEXT"
  echo "================================================================ */"
  echo ""
  cat /tmp/dlv_js_minified.js
} > datalavista.js
echo "  -> datalavista.js ($(wc -l < datalavista.js) lines)"

# ── 2. Build DataLaVista-nojs.html ─────────────────────────────────────────
echo "Building DataLaVista-nojs.html..."
cp /tmp/dlv_clean_template.html DataLaVista-nojs.html
prepend_html_license DataLaVista-nojs.html
echo "  -> DataLaVista-nojs.html"

# ── 3. Build DataLaVista.html (inline) ──────────────────────────────────────
echo "Building DataLaVista.html (inline)..."
{
  echo "  <script>"
  cat /tmp/dlv_js_minified.js
  echo "  </script>"
} > /tmp/dlv_snippet.txt
replace_placeholder /tmp/dlv_clean_template.html /tmp/dlv_snippet.txt DataLaVista.html
prepend_html_license DataLaVista.html
echo "  -> DataLaVista.html"

rm -f /tmp/dlv_snippet.txt /tmp/dlv_clean_template.html /tmp/dlv_js_body.js /tmp/dlv_js_minified.js
echo ""
echo "Build completed at $(date '+%Y-%m-%d %I:%M:%S %p')."
