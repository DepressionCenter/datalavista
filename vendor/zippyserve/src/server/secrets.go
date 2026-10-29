// This file is part of ZippyServe
// secrets.go
// Author(s): Gabriel Mongefranco.
// Created: 2026-08-02
// Summary: Read-only MCP tool that heuristically scans served text files for
//          patterns resembling common credential formats (AWS keys, private
//          key headers, GitHub/Slack tokens, generic secret assignments).
//          Output is fully redacted — file/line/rule only, never the matched
//          text — so a detected secret never itself flows into an agent's
//          context. See docs/mcp-design.md for the full design.
// Notes: See README file for documentation and full license information.
//
// Copyright © 2026 The Regents of the University of Michigan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
// You should have received a copy of the GNU General Public License along
// with this program. If not, see <https://www.gnu.org/licenses/>.

package main

import (
	"bufio"
	"encoding/json"
	"io/fs"
	"path"
	"regexp"
	"strings"
)

const (
	// maxSecretScanFileSize skips files larger than this — scanning huge
	// files for text patterns is wasted work and not where hand-typed
	// secrets end up.
	maxSecretScanFileSize = 2 * 1024 * 1024 // 2 MB

	// maxSecretScanResults bounds the number of matches returned, consistent
	// with every other tool's bounded-output posture.
	maxSecretScanResults = 200
)

// secretScanSkipExtensions are binary/media file types not worth scanning
// for text patterns (both wasted work and a source of false-positive noise
// from compressed/binary byte sequences).
var secretScanSkipExtensions = map[string]bool{
	".ico": true, ".woff": true, ".woff2": true, ".ttf": true, ".otf": true, ".eot": true,
	".mp4": true, ".webm": true, ".ogg": true, ".mp3": true, ".wav": true,
	".avif": true, ".webp": true, ".gif": true, ".png": true, ".jpg": true, ".jpeg": true,
	".zip": true, ".gz": true, ".wasm": true, ".pdf": true,
}

// secretRule is one heuristic pattern in the scan_for_secrets rule table.
// This is intentionally a small, high-confidence set chosen to minimize
// false positives — not an exhaustive secret-scanning product. A clean scan
// is not proof of absence of secrets; this is a best-effort heuristic, not a
// compliance control (see AGENTS.md: do not claim compliance without
// evidence).
type secretRule struct {
	Name    string
	Pattern *regexp.Regexp
}

var secretRules = []secretRule{
	{"aws_access_key_id", regexp.MustCompile(`AKIA[0-9A-Z]{16}`)},
	{"aws_secret_access_key_assignment", regexp.MustCompile(`(?i)aws_secret_access_key\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]`)},
	{"pem_private_key", regexp.MustCompile(`-----BEGIN[A-Z ]*PRIVATE KEY-----`)},
	{"github_token", regexp.MustCompile(`gh[pousr]_[A-Za-z0-9]{36,}`)},
	{"slack_token", regexp.MustCompile(`xox[baprs]-[A-Za-z0-9-]+`)},
	{"generic_secret_assignment", regexp.MustCompile(`(?i)(api[_-]?key|apikey|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{16,}['"]`)},
}

// secretFinding is one redacted match: file, line, and rule name only — the
// matched text itself is never included, logged, or otherwise surfaced,
// per the locked design decision to fully redact scan_for_secrets output.
type secretFinding struct {
	File string `json:"file"`
	Line int    `json:"line"`
	Rule string `json:"rule"`
}

// toolScanForSecrets implements the scan_for_secrets MCP tool.
func toolScanForSecrets(h *ZippyHandler, argsJSON json.RawMessage) (map[string]interface{}, error) {
	var args struct {
		Path string `json:"path"`
	}
	if len(argsJSON) > 0 {
		if err := json.Unmarshal(argsJSON, &args); err != nil {
			return nil, errInvalidToolParams
		}
	}

	base, err := resolveServedPath(h, args.Path)
	if err != nil {
		return nil, err
	}

	var findings []secretFinding
	truncated := false
	filesScanned := 0

	walkErr := fs.WalkDir(h.RootFS.FS(), base, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if p != base && isDotExcluded(p) {
				return fs.SkipDir
			}
			return nil
		}
		if isDotExcluded(p) {
			return nil
		}
		if len(findings) >= maxSecretScanResults {
			truncated = true
			return fs.SkipAll
		}
		if secretScanSkipExtensions[strings.ToLower(path.Ext(p))] {
			return nil
		}
		info, infoErr := d.Info()
		if infoErr != nil || info.Size() > maxSecretScanFileSize {
			return nil
		}

		f, openErr := h.RootFS.Open(p)
		if openErr != nil {
			return nil
		}
		defer f.Close()
		filesScanned++

		scanner := bufio.NewScanner(f)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()
			for _, rule := range secretRules {
				if rule.Pattern.MatchString(line) {
					findings = append(findings, secretFinding{File: p, Line: lineNum, Rule: rule.Name})
					if len(findings) >= maxSecretScanResults {
						truncated = true
						return fs.SkipAll
					}
				}
			}
		}
		return nil
	})
	if walkErr != nil {
		return nil, simpleError("could not scan path: " + walkErr.Error())
	}

	return map[string]interface{}{
		"findings":     findings,
		"filesScanned": filesScanned,
		"truncated":    truncated,
	}, nil
}
