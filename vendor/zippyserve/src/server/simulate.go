// This file is part of ZippyServe
// simulate.go
// Author(s): Gabriel Mongefranco.
// Created: 2026-08-02
// Summary: Read-only MCP tools that exercise the server's own routing/serving
//          logic in-process, without a real network round trip:
//          simulate_request (status/headers/body preview for a path) and
//          inspect_response_headers (filtered header inspection). See
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
	"encoding/json"
	"net/http/httptest"
	"strings"
)

// maxSimulatedBodyPreview caps the response body returned by simulate_request
// so a large served file can't blow out the tool response.
const maxSimulatedBodyPreview = 64 * 1024 // 64 KB

// runInternalRequest executes method+path through h's own ServeHTTP via
// httptest.NewRecorder — an in-process function call, never a real network
// dial, so this cannot be used for SSRF regardless of what path contains.
// path must be relative (leading "/", no "://") and must not target the
// reserved /__mcp prefix (no point simulating calls to the MCP server
// itself, and it avoids confusing recursive-tool-call scenarios).
func runInternalRequest(h *ZippyHandler, method, path string) (*httptest.ResponseRecorder, error) {
	if !strings.HasPrefix(path, "/") || strings.Contains(path, "://") || strings.HasPrefix(path, mcpPathPrefix) {
		return nil, errInvalidToolParams
	}
	if method != "GET" && method != "HEAD" {
		return nil, errInvalidToolParams
	}

	req := httptest.NewRequest(method, path, nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec, nil
}

// toolSimulateRequest implements the simulate_request MCP tool: evaluates
// routing, status codes, and headers for a path without a real network call.
func toolSimulateRequest(h *ZippyHandler, argsJSON json.RawMessage) (map[string]interface{}, error) {
	var args struct {
		Path   string `json:"path"`
		Method string `json:"method"`
	}
	if len(argsJSON) == 0 {
		return nil, errInvalidToolParams
	}
	if err := json.Unmarshal(argsJSON, &args); err != nil || args.Path == "" {
		return nil, errInvalidToolParams
	}
	method := args.Method
	if method == "" {
		method = "GET"
	}

	rec, err := runInternalRequest(h, method, args.Path)
	if err != nil {
		return nil, err
	}

	body := rec.Body.Bytes()
	truncated := len(body) > maxSimulatedBodyPreview
	preview := body
	if truncated {
		preview = body[:maxSimulatedBodyPreview]
	}

	headers := map[string]string{}
	for k := range rec.Header() {
		headers[k] = rec.Header().Get(k)
	}

	return map[string]interface{}{
		"status":        rec.Code,
		"headers":       headers,
		"bodyPreview":   string(preview),
		"bodyTruncated": truncated,
		"bodySizeBytes": len(body),
	}, nil
}

// headerCategories maps inspect_response_headers's filter values to the
// response header names they cover.
var headerCategories = map[string][]string{
	"cache":    {"Cache-Control", "ETag", "Last-Modified", "Expires", "Vary"},
	"cors":     {"Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers", "Access-Control-Allow-Credentials"},
	"security": {"X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Strict-Transport-Security", "Referrer-Policy"},
	"cookies":  {"Set-Cookie"},
	"encoding": {"Content-Encoding", "Content-Type", "Vary"},
}

// toolInspectResponseHeaders implements the inspect_response_headers MCP
// tool: returns response headers for a path, optionally filtered to one of
// the categories in headerCategories.
func toolInspectResponseHeaders(h *ZippyHandler, argsJSON json.RawMessage) (map[string]interface{}, error) {
	var args struct {
		Path   string `json:"path"`
		Filter string `json:"filter"`
	}
	if len(argsJSON) == 0 {
		return nil, errInvalidToolParams
	}
	if err := json.Unmarshal(argsJSON, &args); err != nil || args.Path == "" {
		return nil, errInvalidToolParams
	}
	if args.Filter != "" && args.Filter != "all" {
		if _, ok := headerCategories[args.Filter]; !ok {
			return nil, errInvalidToolParams
		}
	}

	rec, err := runInternalRequest(h, "GET", args.Path)
	if err != nil {
		return nil, err
	}

	headers := map[string]string{}
	if args.Filter == "" || args.Filter == "all" {
		for k := range rec.Header() {
			headers[k] = rec.Header().Get(k)
		}
	} else {
		for _, name := range headerCategories[args.Filter] {
			if v := rec.Header().Get(name); v != "" {
				headers[name] = v
			}
		}
	}

	return map[string]interface{}{
		"status":  rec.Code,
		"headers": headers,
	}, nil
}
