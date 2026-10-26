// This file is part of ZippyServe
// files.go
// Author(s): Gabriel Mongefranco.
// Created: 2026-08-02
// Summary: Read-only MCP tool for reading a single served file's raw text
//          content, bounded by size and restricted to valid UTF-8. See
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
	"unicode/utf8"
)

// maxReadFileSize bounds read_served_file so a large served asset can't
// blow out a tool response or the agent's context window.
const maxReadFileSize = 10 * 1024 * 1024 // 10 MB

var errFileTooLarge = simpleError("file exceeds the 10 MB read_served_file limit")
var errFileNotUTF8 = simpleError("file is not valid UTF-8 text; read_served_file only supports served text assets, not arbitrary binaries")

// toolReadServedFile implements the read_served_file MCP tool: returns the
// raw text content of a single file under the served root. Refuses (rather
// than silently truncating) files over maxReadFileSize or files that aren't
// valid UTF-8, since a truncated or garbled result would be actively
// misleading for a debugging tool.
func toolReadServedFile(h *ZippyHandler, argsJSON json.RawMessage) (map[string]interface{}, error) {
	var args struct {
		Path string `json:"path"`
	}
	if len(argsJSON) == 0 {
		return nil, errInvalidToolParams
	}
	if err := json.Unmarshal(argsJSON, &args); err != nil || args.Path == "" {
		return nil, errInvalidToolParams
	}

	relPath, err := resolveServedPath(h, args.Path)
	if err != nil {
		return nil, err
	}

	info, statErr := h.RootFS.Stat(relPath)
	if statErr != nil || info.IsDir() {
		return nil, simpleError("file not found: " + args.Path)
	}
	if info.Size() > maxReadFileSize {
		return nil, errFileTooLarge
	}

	data, readErr := h.RootFS.ReadFile(relPath)
	if readErr != nil {
		return nil, simpleError("could not read file: " + readErr.Error())
	}
	if !utf8.Valid(data) {
		return nil, errFileNotUTF8
	}

	return map[string]interface{}{
		"path":      args.Path,
		"sizeBytes": info.Size(),
		"content":   string(data),
	}, nil
}
