// This file is part of ZippyServe
// assets.go
// Author(s): Gabriel Mongefranco.
// Created: 2026-08-02
// Summary: Read-only MCP tools for analyzing served web assets: raw/gzip size
//          and compression ratio (get_asset_metrics), and source map presence
//          and structural validity (validate_source_maps). See
//          docs/mcp-design.md for the full design.
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
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"
)

// maxAssetMetricsResults bounds get_asset_metrics the same way
// maxListFilesResults (mcp.go) bounds list_files, so a large served tree
// can't produce an unbounded response.
const maxAssetMetricsResults = 500

// assetMetric is one file's entry in the get_asset_metrics result.
//
// NOTE: no brotli field. Go's standard library has no brotli encoder, and
// vendoring one would violate the zero-dependency constraint (see
// docs/mcp-design.md) — this is a permanent scope limit, not a TODO.
type assetMetric struct {
	Path              string  `json:"path"`
	RawSizeBytes      int64   `json:"rawSizeBytes"`
	GzipSizeBytes     int64   `json:"gzipSizeBytes"`
	CompressionRatio  float64 `json:"compressionRatio"` // gzipSizeBytes / rawSizeBytes
	ComputeDurationMs float64 `json:"computeDurationMs"`
}

// toolGetAssetMetrics implements the get_asset_metrics MCP tool: raw size,
// in-memory gzip size, and compression ratio for a served file or (walking
// recursively, bounded by maxAssetMetricsResults) every file under a served
// directory. computeDurationMs is the wall-clock cost of reading+compressing
// the file — a proxy for "how expensive is this asset to serve," not a
// network transfer-time measurement (localhost transfer time isn't
// meaningful to measure).
func toolGetAssetMetrics(h *ZippyHandler, argsJSON json.RawMessage) (map[string]interface{}, error) {
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

	info, statErr := h.RootFS.Stat(base)
	if statErr != nil {
		return nil, simpleError("path not found: " + args.Path)
	}

	var files []string
	if info.IsDir() {
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
			if len(files) >= maxAssetMetricsResults {
				return fs.SkipAll
			}
			files = append(files, p)
			return nil
		})
		if walkErr != nil {
			return nil, simpleError("could not walk path: " + walkErr.Error())
		}
	} else {
		files = []string{base}
	}

	var (
		metrics                       []assetMetric
		totalRawBytes, totalGzipBytes int64
		skippedOversize, skippedError int
	)
	for _, p := range files {
		fi, statErr := h.RootFS.Stat(p)
		if statErr != nil || fi.Size() > maxReadFileSize {
			skippedOversize++
			continue
		}
		start := time.Now()
		data, readErr := h.RootFS.ReadFile(p)
		if readErr != nil {
			skippedError++
			continue
		}
		var gzBuf bytes.Buffer
		gw := gzip.NewWriter(&gzBuf)
		_, _ = gw.Write(data)
		_ = gw.Close()
		duration := time.Since(start)

		raw := fi.Size()
		gz := int64(gzBuf.Len())
		ratio := 0.0
		if raw > 0 {
			ratio = float64(gz) / float64(raw)
		}
		metrics = append(metrics, assetMetric{
			Path:              p,
			RawSizeBytes:      raw,
			GzipSizeBytes:     gz,
			CompressionRatio:  ratio,
			ComputeDurationMs: float64(duration.Microseconds()) / 1000,
		})
		totalRawBytes += raw
		totalGzipBytes += gz
	}
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].Path < metrics[j].Path })

	return map[string]interface{}{
		"files":           metrics,
		"totalRawBytes":   totalRawBytes,
		"totalGzipBytes":  totalGzipBytes,
		"skippedOversize": skippedOversize, // files over maxReadFileSize, not measured
		"skippedError":    skippedError,    // files that could not be read, not measured
	}, nil
}

// jsSourceMappingURLRegex matches a JS "//# sourceMappingURL=..." (or the
// older "//@" form) comment. CSS uses a block-comment form instead.
var (
	jsSourceMappingURLRegex  = regexp.MustCompile(`(?m)^//[#@]\s*sourceMappingURL=(\S+)\s*$`)
	cssSourceMappingURLRegex = regexp.MustCompile(`/\*#\s*sourceMappingURL=(\S+?)\s*\*/`)
)

// toolValidateSourceMaps implements the validate_source_maps MCP tool.
// path may be a .map file (validated directly) or a .js/.css file (its
// sourceMappingURL comment is located and the referenced .map validated).
// issues is a plain-English list of problems found; never includes file
// contents beyond what's needed to name the issue.
func toolValidateSourceMaps(h *ZippyHandler, argsJSON json.RawMessage) (map[string]interface{}, error) {
	var args struct {
		Path string `json:"path"`
	}
	if len(argsJSON) == 0 {
		return nil, errInvalidToolParams
	}
	if err := json.Unmarshal(argsJSON, &args); err != nil || args.Path == "" {
		return nil, errInvalidToolParams
	}

	lower := strings.ToLower(args.Path)
	switch {
	case strings.HasSuffix(lower, ".map"):
		return validateMapFile(h, args.Path)
	case strings.HasSuffix(lower, ".js") || strings.HasSuffix(lower, ".css"):
		return validateSourceFileMapping(h, args.Path, strings.HasSuffix(lower, ".css"))
	default:
		return nil, errInvalidToolParams
	}
}

func validateSourceFileMapping(h *ZippyHandler, relPath string, isCSS bool) (map[string]interface{}, error) {
	rootRelPath, err := resolveServedPath(h, relPath)
	if err != nil {
		return nil, err
	}
	data, readErr := h.RootFS.ReadFile(rootRelPath)
	if readErr != nil {
		return nil, simpleError("could not read file: " + readErr.Error())
	}

	var mappingURL string
	if isCSS {
		if m := cssSourceMappingURLRegex.FindAllStringSubmatch(string(data), -1); len(m) > 0 {
			mappingURL = m[len(m)-1][1]
		}
	} else {
		if m := jsSourceMappingURLRegex.FindAllStringSubmatch(string(data), -1); len(m) > 0 {
			mappingURL = m[len(m)-1][1]
		}
	}
	if mappingURL == "" {
		return map[string]interface{}{
			"path":   relPath,
			"valid":  false,
			"issues": []string{"no sourceMappingURL comment found"},
		}, nil
	}

	var mapRelPath string
	if strings.HasPrefix(mappingURL, "/") {
		mapRelPath = mappingURL
	} else {
		mapRelPath = path.Join(path.Dir(relPath), mappingURL)
	}
	return validateMapFile(h, mapRelPath)
}

func validateMapFile(h *ZippyHandler, relPath string) (map[string]interface{}, error) {
	rootRelPath, err := resolveServedPath(h, relPath)
	if err != nil {
		return map[string]interface{}{
			"path":   relPath,
			"valid":  false,
			"issues": []string{"referenced map path is invalid or escapes the served root"},
		}, nil
	}

	issues := []string{}

	data, readErr := h.RootFS.ReadFile(rootRelPath)
	if readErr != nil {
		return map[string]interface{}{
			"path":   relPath,
			"valid":  false,
			"issues": []string{"referenced map file does not exist"},
		}, nil
	}

	var parsed map[string]interface{}
	if jsonErr := json.Unmarshal(data, &parsed); jsonErr != nil {
		return map[string]interface{}{
			"path":   relPath,
			"valid":  false,
			"issues": []string{"map file is not valid JSON: " + jsonErr.Error()},
		}, nil
	}
	for _, field := range []string{"version", "sources", "mappings"} {
		if _, ok := parsed[field]; !ok {
			issues = append(issues, "map JSON missing required field: "+field)
		}
	}

	// Sanity-check that a source file this map likely corresponds to exists
	// (foo.js.map -> foo.js), when the map follows that convention.
	if strings.HasSuffix(relPath, ".map") {
		sourceRel := strings.TrimSuffix(relPath, ".map")
		if rootRelSource, srcErr := resolveServedPath(h, sourceRel); srcErr == nil {
			if _, statErr := h.RootFS.Stat(rootRelSource); statErr != nil {
				issues = append(issues, "no corresponding source file found at "+sourceRel)
			}
		}
	}

	return map[string]interface{}{
		"path":   relPath,
		"valid":  len(issues) == 0,
		"issues": issues,
	}, nil
}
