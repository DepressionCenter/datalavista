#!/usr/bin/env bash
# ============================================================
#  This file is part of DataLaVista™
#  check-repository.sh: Repository checks for pull requests and pushes.
#  Author(s): Gabriel Mongefranco.
#  Created: 2026-10-27
#  Last Modified: 2026-10-27
#  Summary: Checks JSON files, source file headers, whitespace, and edits to build outputs.
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
#  ================================================================
#
#  Usage: bash tests/check-repository.sh [BASE_COMMIT]
#  Run from the repository root. With BASE_COMMIT, it also checks the changes
#  made since that commit, such as the target branch of a pull request.
set -u

BASE="${1:-}"
PYTHON="${PYTHON:-python3}"
failures=0

fail() {
  echo "FAILED: $*" >&2
  failures=$((failures + 1))
}

### Check JSON Files ###
while IFS= read -r -d '' file; do
  if ! "$PYTHON" -c "import json, sys; json.load(open(sys.argv[1], encoding='utf-8-sig'))" "$file" 2>/dev/null; then
    fail "$file is not valid JSON. Open it in an editor that checks JSON and fix the reported line."
  fi
done < <(git ls-files -z '*.json')

### Check Source File Headers ###
for file in src/[0-9][0-9]-*.js src/00-full-page.html src/before-libraries.js src/after-libraries.js src/DataLaVista-sp.html.txt; do
  if ! grep -q "This file is part of DataLaVista" "$file"; then
    fail "$file has no license header. Copy the header from section 3 of AGENTS.md to the top of the file."
  fi
done

### Check Changes Since the Base Commit ###
if [ -n "$BASE" ]; then
  # The library copies in src/lib are checked against their checksums instead, so they are skipped here
  if ! git diff --check "$BASE"...HEAD -- . ':(exclude)src/lib'; then
    fail "the changes above add trailing spaces or leftover conflict markers. Remove them and commit again."
  fi
  # The build workflow rebuilds these files after each merge to main
  for output in DataLaVista.html DataLaVista-nojs.html datalavista.js; do
    if git diff --name-only "$BASE"...HEAD | grep -qx "$output"; then
      fail "$output was changed. Make the change in src/ instead, then run: git checkout $BASE -- $output"
    fi
  done
fi

if [ "$failures" -gt 0 ]; then
  if [ "$failures" -eq 1 ]; then noun="problem"; else noun="problems"; fi
  echo "Found $failures $noun. See the messages above." >&2
  exit 1
fi
echo "Repository checks passed."
