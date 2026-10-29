// This file is part of ZippyServe
// visible.go
// Author(s): PHJ2000.
// Created: 2026-10-29
// Summary: Opens visible HTTP content without following unchecked link targets.
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
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type visibleFiles struct{ handler *ZippyHandler }

func (v visibleFiles) Open(name string) (fs.File, error) {
	return v.handler.openVisible(name)
}

func (h *ZippyHandler) visibleFS() fs.FS { return visibleFiles{h} }

// openVisible follows relative links only after checking every target component.
// Directory handles pin the parents. Comparing each opened object with its Lstat
// result rejects a concurrent replacement with a link to another object.
// os.Root still enforces containment; public internal links remain supported.
func (h *ZippyHandler) openVisible(name string) (*os.File, error) {
	if !fs.ValidPath(name) {
		return nil, fs.ErrNotExist
	}
	if *serveDotfilesFlag {
		return h.RootFS.Open(filepath.FromSlash(name))
	}
	roots := []*os.Root{h.RootFS}
	defer func() {
		for _, root := range roots[1:] {
			root.Close()
		}
	}()
	parts := strings.Split(name, "/")
	links := 0
	for len(parts) > 0 {
		part := parts[0]
		parts = parts[1:]
		if part == "" || part == "." {
			continue
		}
		if part == ".." {
			if len(roots) == 1 {
				return nil, fs.ErrNotExist
			}
			roots[len(roots)-1].Close()
			roots = roots[:len(roots)-1]
			continue
		}
		if isDotExcluded(part) || filepath.Base(part) != part || filepath.VolumeName(part) != "" {
			return nil, fs.ErrNotExist
		}
		parent := roots[len(roots)-1]
		info, err := parent.Lstat(part)
		if err != nil {
			return nil, err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			links++
			if links > 40 {
				return nil, fs.ErrNotExist
			}
			target, err := parent.Readlink(part)
			if err != nil {
				return nil, err
			}
			if filepath.IsAbs(target) || filepath.VolumeName(target) != "" {
				return nil, fs.ErrNotExist
			}
			parts = append(strings.Split(filepath.ToSlash(target), "/"), parts...)
			continue
		}
		if info.IsDir() {
			child, err := parent.OpenRoot(part)
			if err != nil {
				return nil, err
			}
			opened, err := child.Stat(".")
			if err != nil || !os.SameFile(info, opened) {
				child.Close()
				return nil, fs.ErrNotExist
			}
			roots = append(roots, child)
			continue
		}
		if len(parts) != 0 {
			return nil, fs.ErrNotExist
		}
		file, err := parent.Open(part)
		if err != nil {
			return nil, err
		}
		opened, err := file.Stat()
		if err != nil || !os.SameFile(info, opened) {
			file.Close()
			return nil, fs.ErrNotExist
		}
		return file, nil
	}
	return roots[len(roots)-1].Open(".")
}
