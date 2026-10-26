// This file is part of ZippyServe
// main.go
// Author(s): Gabriel Mongefranco.
// Created: 2026-07-26
// Summary: Go compiled binary serving static files securely. Main entry point.
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
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"errors"
	"flag"
	"fmt"
	"html"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	DefaultPort        = 8010
	ServerName         = "ZippyServe"
	Version            = "0.1.2"
	MaxArchiveFileSize = 500 * 1024 * 1024 // 500 MB
)

var (
	IndexFiles   = []string{"index.html", "index.htm", "app.html", "README.md", "app.md"}
	ArchiveFiles = []string{"index.zip", "app.zip", "index.tar.gz", "app.tar.gz"}
	tempDirs     []string
	tempDirsMu   sync.Mutex
)

// WebMimeTypes are explicitly registered at startup instead of trusting the host
// OS's MIME database (Windows registry, /etc/mime.types, etc.), which can be
// missing or wrong for common web extensions — e.g. a broken/absent Windows
// registry entry causes Go's net/http to content-sniff .css as text/plain instead
// of text/css. List based on MDN's "Common MIME types" reference:
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types
var WebMimeTypes = map[string]string{
	".css":         "text/css; charset=utf-8",
	".js":          "text/javascript; charset=utf-8",
	".mjs":         "text/javascript; charset=utf-8",
	".json":        "application/json",
	".svg":         "image/svg+xml",
	".ico":         "image/x-icon",
	".woff":        "font/woff",
	".woff2":       "font/woff2",
	".ttf":         "font/ttf",
	".otf":         "font/otf",
	".eot":         "application/vnd.ms-fontobject",
	".map":         "application/json",
	".txt":         "text/plain; charset=utf-8",
	".csv":         "text/csv; charset=utf-8",
	".xml":         "application/xml",
	".pdf":         "application/pdf",
	".mp4":         "video/mp4",
	".webm":        "video/webm",
	".ogg":         "audio/ogg",
	".mp3":         "audio/mpeg",
	".wav":         "audio/wav",
	".avif":        "image/avif",
	".webp":        "image/webp",
	".gif":         "image/gif",
	".png":         "image/png",
	".jpg":         "image/jpeg",
	".jpeg":        "image/jpeg",
	".zip":         "application/zip",
	".gz":          "application/gzip",
	".wasm":        "application/wasm",
	".webmanifest": "application/manifest+json",
}

// Flags
var (
	portFlag          = flag.Int("port", DefaultPort, "Port to listen on")
	dirFlag           = flag.String("dir", "", "Directory to serve")
	zipFlag           = flag.String("zip", "", "Zip/Tar file to serve")
	compressedFlag    = flag.String("compressed", "", "Alias for --zip")
	tarFlag           = flag.String("tar", "", "Alias for --zip")
	gzFlag            = flag.String("gz", "", "Alias for --zip")
	indexFlag         = flag.String("index", "", "Specific file to use as index")
	mcpFlag           = flag.Bool("mcp", false, "Enable the built-in MCP server at "+mcpPathPrefix+" (read-only, localhost-only)")
	mcpBrowserFlag    = flag.Bool("mcp-browser", false, "Enable browser-side instrumentation (requires -mcp): injects a script into served HTML to capture console output, uncaught errors, and unhandled promise rejections, exposed via the get_console_log MCP tool")
	serveDotfilesFlag = flag.Bool("serve-dotfiles", false, "Serve dotfiles and dot-directories (.git, .github, .claude, etc.) instead of excluding them by default. .well-known is always served regardless of this flag (RFC 8615)")
)

// serverStartTime is recorded once at startup for the MCP get_server_info tool's
// uptime field.
var serverStartTime time.Time

func main() {
	flag.Parse()
	log.SetPrefix("[ZippyServe] ")

	if *mcpBrowserFlag && !*mcpFlag {
		log.Fatalf("-mcp-browser requires -mcp to also be enabled; pass both -mcp -mcp-browser")
	}

	serverStartTime = time.Now()

	// Ensure common web MIME types are set explicitly (see WebMimeTypes doc above)
	for ext, typ := range WebMimeTypes {
		mime.AddExtensionType(ext, typ)
	}

	serveRoot, indexFile := determineServingRoot()
	log.Printf("Starting %s v%s", ServerName, Version)
	log.Printf("Serving root: %s", serveRoot)
	if indexFile != "" {
		log.Printf("Index file: %s", indexFile)
	}

	// rootFS is opened once at startup and is what actually enforces the
	// served-root boundary (see ZippyHandler.RootFS doc comment below) — the
	// server cannot serve anything without it, so a failure here is fatal
	// rather than a soft-degrade.
	rootFS, err := os.OpenRoot(serveRoot)
	if err != nil {
		log.Fatalf("Could not open serving root %q: %v", serveRoot, err)
	}

	handler := &ZippyHandler{Root: serveRoot, Index: indexFile, RootFS: rootFS}
	server := &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%d", *portFlag),
		Handler: handler,
	}

	go func() {
		log.Printf("Listening on http://127.0.0.1:%d", *portFlag)
		if *mcpFlag {
			mcpURL := fmt.Sprintf("http://127.0.0.1:%d%s", *portFlag, mcpPathPrefix)
			log.Printf("MCP server enabled at %s (read-only, localhost-only)", mcpURL)
			// No auto-discovery mechanism exists (no .well-known manifest, no
			// registration file) — an agent/MCP client must be pointed at
			// mcpURL explicitly. Printing the exact command plus a
			// copy-pasteable agent prompt here, once, avoids tripling this
			// guidance across run-windows.ps1/run-linux.sh/run-mac.command,
			// which don't know the resolved port at doc-writing time anyway.
			log.Printf("To connect Claude Code: claude mcp add --transport http zippyserve %s", mcpURL)
			log.Printf("Or paste this prompt into your AI coding agent:")
			log.Printf("  A ZippyServe dev server is running with its MCP server at %s . ", mcpURL)
			log.Printf("  Connect to it and use its tools (list_files, get_recent_requests, ")
			log.Printf("  read_served_file, scan_for_secrets, etc.) to inspect what it's serving.")
		}
		if *mcpBrowserFlag {
			log.Printf("Browser instrumentation enabled: injecting %s into served HTML", mcpInjectScriptPath)
		}
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}

	if err := handler.RootFS.Close(); err != nil {
		log.Printf("Error closing serving root: %v", err)
	}
	cleanupTempDirs()
}

func determineServingRoot() (string, string) {
	// 1. Specific index
	if *indexFlag != "" {
		return filepath.Dir(*indexFlag), filepath.Base(*indexFlag)
	}

	// 2. Zip/Tar archive
	zipFile := *zipFlag
	if zipFile == "" {
		zipFile = *compressedFlag
	}
	if zipFile == "" {
		zipFile = *tarFlag
	}
	if zipFile == "" {
		zipFile = *gzFlag
	}

	// Positional arguments
	args := flag.Args()
	if len(args) == 1 && zipFile == "" && *dirFlag == "" {
		arg := args[0]
		stat, err := os.Stat(arg)
		if err == nil {
			if stat.IsDir() {
				*dirFlag = arg
			} else if strings.HasSuffix(arg, ".zip") || strings.HasSuffix(arg, ".tar") || strings.HasSuffix(arg, ".tar.gz") {
				zipFile = arg
			} else {
				return filepath.Dir(arg), filepath.Base(arg)
			}
		}
	}

	if zipFile != "" {
		tmpDir, err := extractArchive(zipFile)
		if err != nil {
			log.Fatalf("Failed extracting archive %s: %v", zipFile, err)
		}
		return tmpDir, ""
	}

	// 3. Directory
	if *dirFlag != "" {
		return *dirFlag, ""
	}

	// 4. Binary location fallback
	exe, err := os.Executable()
	if err != nil {
		pwd, _ := os.Getwd()
		return pwd, ""
	}
	return filepath.Dir(exe), ""
}

// ZippyHandler handles HTTP requests
type ZippyHandler struct {
	// Root is the original, as-configured serving root path — kept only for
	// display (get_server_info, startup logging) and as the base directory
	// for the (separate, ZippyServe-owned) archive-extraction temp trees.
	// It is never used directly to open or stat served content; RootFS is.
	Root  string
	Index string
	// RootFS is an *os.Root opened once at startup (os.OpenRoot(Root)) and
	// is what actually enforces the served-root boundary: every method on
	// Root refuses to resolve a name that would reference a location
	// outside the directory it was opened on, including through a symlink
	// or Windows junction placed inside the tree — enforced by the OS at
	// the file-open level (openat-style), not by a separate userspace
	// check performed before the real read.
	//
	// This replaced a hand-rolled per-component os.Lstat walk
	// (isWithinRealRoot) that rejected ANY reparse point unconditionally
	// (fs.ModeSymlink or fs.ModeIrregular). That blanket rejection was
	// broader than intended: on Windows, Go sets fs.ModeIrregular for any
	// reparse point Go doesn't specifically recognize as a symlink,
	// AF_UNIX socket, or dedup entry — which includes cloud-sync
	// placeholder tags (e.g. OneDrive Files On-Demand), not just directory
	// junctions. A served tree living under such a folder (common on a
	// managed/redirected Windows profile) would have legitimate, harmless
	// files rejected with a 403 as if they were escape attempts. os.Root's
	// own Windows implementation instead checks specifically for
	// "name surrogate" reparse tags (symlinks and mount points/junctions —
	// the ones that actually redirect a name elsewhere), so it does not
	// misclassify a cloud placeholder file as a traversal risk. See
	// docs/mcp-design.md for the full incident writeup.
	RootFS *os.Root
}

// isDotExcluded reports whether relPath (a "/"-separated path relative to
// the served root, already path.Clean-normalized by the caller) has a
// segment starting with "." — e.g. ".git", ".github", ".claude", or a bare
// ".env" — and should therefore be excluded from being served or inspected
// by default. ".well-known" is always allowed (RFC 8615: well-known URIs
// such as ACME challenges and security.txt are a real static-file-server
// use case). -serve-dotfiles disables this check entirely.
//
// This is a visibility policy, not a containment boundary: os.Root (see
// ZippyHandler.RootFS above) already prevents escaping the served root
// regardless of this check. isDotExcluded exists because the served root is
// commonly a project's working directory, which routinely holds VCS/tool
// metadata (.git, .github, .claude, and similar) that was never meant to be
// reachable over HTTP or readable by an MCP client. It is the single choke
// point for this policy: ServeHTTP below applies it to plain file/directory
// serving (which simulate_request/inspect_response_headers inherit
// in-process via runInternalRequest in simulate.go), and resolveServedPath
// (mcp.go) plus each MCP tool's fs.WalkDir callback apply it to MCP tools
// that touch the filesystem directly instead of going through ServeHTTP.
func isDotExcluded(relPath string) bool {
	if *serveDotfilesFlag {
		return false
	}
	for _, seg := range strings.Split(relPath, "/") {
		if seg == "" || seg == "." || seg == ".well-known" {
			continue
		}
		if strings.HasPrefix(seg, ".") {
			return true
		}
	}
	return false
}

func (h *ZippyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	sr := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	w = sr
	defer func() {
		recordRequest(requestLogEntry{Method: r.Method, Path: r.URL.Path, Status: sr.status, DurationMS: float64(time.Since(start).Microseconds()) / 1000, Time: start})
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sr.status, time.Since(start))
	}()

	// Security headers. REST/WebWorkers/HTMX supported by design.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Service-Worker-Allowed", "/")

	// Reserved MCP endpoint and its two browser-instrumentation sub-paths.
	// Always intercepted here so a served file can never shadow or be
	// shadowed by them, regardless of whether -mcp/-mcp-browser are enabled.
	if strings.HasPrefix(r.URL.Path, mcpPathPrefix) {
		if !*mcpFlag {
			http.NotFound(w, r)
			return
		}
		switch r.URL.Path {
		case mcpPathPrefix:
			handleMCPRequest(w, r, h)
		case mcpReportPath:
			if !*mcpBrowserFlag {
				http.NotFound(w, r)
				return
			}
			handleMCPReport(w, r)
		case mcpInjectScriptPath:
			if !*mcpBrowserFlag {
				http.NotFound(w, r)
				return
			}
			handleMCPInjectScript(w, r)
		default:
			http.NotFound(w, r)
		}
		return
	}

	// relPath is a Root-relative, "/"-separated path derived from the
	// request URL. path.Clean neutralizes ".." (an absolute path can't
	// climb above "/"), and containment beyond that is enforced by h.RootFS
	// itself — every RootFS method refuses to resolve outside the
	// directory it was opened on, including through an internal symlink or
	// junction that points elsewhere (see ZippyHandler.RootFS doc comment).
	relPath := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if relPath == "" {
		relPath = "."
	}
	if strings.Contains(relPath, "\x00") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if isDotExcluded(relPath) {
		http.NotFound(w, r)
		return
	}

	stat, err := h.RootFS.Stat(relPath)
	if err != nil {
		// Not found, or a path-escape attempt rejected by RootFS — either
		// way there's nothing here. SPA fallback logic still applies for
		// extensionless paths.
		if !strings.Contains(path.Base(relPath), ".") {
			h.serveIndexFallback(w, r)
			return
		}
		http.NotFound(w, r)
		return
	}

	if stat.IsDir() {
		h.serveDirectory(w, r, relPath)
		return
	}

	h.serveFile(w, r, relPath)
}

// serveDirectory looks for an index or archive file directly inside
// relDir (a path relative to h.RootFS). Archive files found this way are
// extracted to a fresh, ZippyServe-owned temp directory (see
// extractArchive) and served via their own ephemeral os.Root — that temp
// tree is a separate trust domain from the served root (its names were
// already validated on extraction; see validateAndExtract), not a location
// reachable through h.RootFS.
func (h *ZippyHandler) serveDirectory(w http.ResponseWriter, r *http.Request, relDir string) {
	for _, idx := range IndexFiles {
		idxRel := path.Join(relDir, idx)
		if info, err := h.RootFS.Stat(idxRel); err == nil && !info.IsDir() {
			h.serveFile(w, r, idxRel)
			return
		}
	}

	for _, arc := range ArchiveFiles {
		arcRel := path.Join(relDir, arc)
		if info, err := h.RootFS.Stat(arcRel); err == nil && !info.IsDir() {
			arcAbs := filepath.Join(h.Root, filepath.FromSlash(arcRel))
			if h.serveFromExtractedArchive(w, r, arcAbs) {
				return
			}
		}
	}

	http.Error(w, "Forbidden", http.StatusForbidden)
}

// serveFromExtractedArchive extracts arcAbs (an absolute path resolved
// through h.RootFS above) to a new temp directory, opens its own os.Root
// scoped to that directory, and serves from it via a throwaway
// ZippyHandler — reusing serveDirectory/serveFile/serveIndexFallback
// unchanged, so archive-extracted content gets the same containment
// enforcement as the served root itself. Returns false (having logged the
// error) if extraction failed, so the caller can keep trying other
// candidates.
func (h *ZippyHandler) serveFromExtractedArchive(w http.ResponseWriter, r *http.Request, arcAbs string) bool {
	tmpDir, err := extractArchive(arcAbs)
	if err != nil {
		log.Printf("Error extracting fallback archive %s: %v", arcAbs, err)
		return false
	}
	tmpRoot, err := os.OpenRoot(tmpDir)
	if err != nil {
		log.Printf("Error opening extracted archive dir %s: %v", tmpDir, err)
		return false
	}
	defer tmpRoot.Close()

	tmpHandler := &ZippyHandler{Root: tmpDir, Index: h.Index, RootFS: tmpRoot}
	tmpHandler.serveDirectory(w, r, ".")
	return true
}

func (h *ZippyHandler) serveIndexFallback(w http.ResponseWriter, r *http.Request) {
	if h.Index != "" {
		if info, err := h.RootFS.Stat(h.Index); err == nil && !info.IsDir() {
			h.serveFile(w, r, h.Index)
			return
		}
	}
	for _, idx := range IndexFiles {
		if info, err := h.RootFS.Stat(idx); err == nil && !info.IsDir() {
			h.serveFile(w, r, idx)
			return
		}
	}
	http.NotFound(w, r)
}

func (h *ZippyHandler) serveFile(w http.ResponseWriter, r *http.Request, relPath string) {
	lower := strings.ToLower(relPath)

	if strings.HasSuffix(lower, ".md") {
		data, err := h.RootFS.ReadFile(relPath)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		htmlData := renderMarkdown(data)
		if *mcpBrowserFlag {
			warnIfCSPMightBlockInjection(r.URL.Path, htmlData)
			htmlData = injectBrowserScript(htmlData)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(htmlData)
		return
	}

	if *mcpBrowserFlag && (strings.HasSuffix(lower, ".html") || strings.HasSuffix(lower, ".htm")) {
		// Manual read+inject instead of http.ServeFileFS, so the
		// instrumentation script tag can be spliced into the bytes.
		// Trade-off: loses Range/ETag/If-Modified-Since support for
		// .html/.htm, but ONLY while -mcp-browser is on; http.ServeFileFS
		// still handles everything else, and .html/.htm too when
		// -mcp-browser is off.
		data, err := h.RootFS.ReadFile(relPath)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		warnIfCSPMightBlockInjection(r.URL.Path, data)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(injectBrowserScript(data))
		return
	}

	http.ServeFileFS(w, r, h.RootFS.FS(), relPath)
}

// Markdown Parser Engine
func renderMarkdown(md []byte) []byte {
	str := string(md)

	// Pre-process code blocks to avoid rendering inside them
	codeBlockRegex := regexp.MustCompile("(?s)```(.*?)```")
	codeBlocks := []string{}
	str = codeBlockRegex.ReplaceAllStringFunc(str, func(match string) string {
		inner := strings.TrimPrefix(match, "```")
		inner = strings.TrimSuffix(inner, "```")
		parts := strings.SplitN(inner, "\n", 2)
		lang := ""
		code := inner
		if len(parts) == 2 && !strings.Contains(parts[0], " ") {
			lang = parts[0]
			code = parts[1]
		} else {
			code = strings.TrimPrefix(code, "\n")
		}
		codeBlocks = append(codeBlocks, fmt.Sprintf("<pre><code class=\"language-%s\">%s</code></pre>", html.EscapeString(lang), html.EscapeString(code)))
		return fmt.Sprintf("%%CODEBLOCK_%d%%", len(codeBlocks)-1)
	})

	// @mentions
	mentionRegex := regexp.MustCompile(`(^|\s)@([a-zA-Z0-9_-]+)`)
	str = mentionRegex.ReplaceAllString(str, `$1<a href="https://github.com/$2"><img src="https://github.com/$2.png?size=20" width="20" height="20" alt="@$2" onerror="this.style.display='none'"> @$2</a>`)

	// Headings
	str = regexp.MustCompile(`(?m)^###### (.*?)$`).ReplaceAllString(str, "<h6>$1</h6>")
	str = regexp.MustCompile(`(?m)^##### (.*?)$`).ReplaceAllString(str, "<h5>$1</h5>")
	str = regexp.MustCompile(`(?m)^#### (.*?)$`).ReplaceAllString(str, "<h4>$1</h4>")
	str = regexp.MustCompile(`(?m)^### (.*?)$`).ReplaceAllString(str, "<h3>$1</h3>")
	str = regexp.MustCompile(`(?m)^## (.*?)$`).ReplaceAllString(str, "<h2>$1</h2>")
	str = regexp.MustCompile(`(?m)^# (.*?)$`).ReplaceAllString(str, "<h1>$1</h1>")

	// Formatting
	str = regexp.MustCompile(`\*\*(.*?)\*\*`).ReplaceAllString(str, "<strong>$1</strong>")
	str = regexp.MustCompile(`__(.*?)__`).ReplaceAllString(str, "<strong>$1</strong>")
	str = regexp.MustCompile(`\*(.*?)\*`).ReplaceAllString(str, "<em>$1</em>")
	str = regexp.MustCompile(`_(.*?)_`).ReplaceAllString(str, "<em>$1</em>")
	str = regexp.MustCompile(`~~(.*?)~~`).ReplaceAllString(str, "<del>$1</del>")

	// Inline Code
	str = regexp.MustCompile("`(.*?)`").ReplaceAllStringFunc(str, func(m string) string {
		inner := m[1 : len(m)-1]
		return "<code>" + html.EscapeString(inner) + "</code>"
	})

	// Links and Images
	str = regexp.MustCompile(`!\[(.*?)\]\((.*?)\)`).ReplaceAllString(str, `<img src="$2" alt="$1">`)
	str = regexp.MustCompile(`\[(.*?)\]\((.*?)\)`).ReplaceAllString(str, `<a href="$2">$1</a>`)

	// Lists
	str = regexp.MustCompile(`(?m)^[*-] \[ \] (.*?)$`).ReplaceAllString(str, `<li><input type="checkbox" disabled> $1</li>`)
	str = regexp.MustCompile(`(?m)^[*-] \[x\] (.*?)$`).ReplaceAllString(str, `<li><input type="checkbox" disabled checked> $1</li>`)
	str = regexp.MustCompile(`(?m)^[*-] (.*?)$`).ReplaceAllString(str, "<li>$1</li>")

	// Paragraphs
	str = strings.ReplaceAll(str, "\r\n", "\n")
	paras := strings.Split(str, "\n\n")
	for i, p := range paras {
		if !strings.HasPrefix(p, "<h") && !strings.HasPrefix(p, "<li") && !strings.HasPrefix(p, "%CODEBLOCK") {
			paras[i] = "<p>" + strings.ReplaceAll(p, "\n", "<br>") + "</p>"
		}
	}
	str = strings.Join(paras, "\n")

	// Reinsert Code Blocks
	for i, cb := range codeBlocks {
		str = strings.Replace(str, fmt.Sprintf("%%CODEBLOCK_%d%%", i), cb, 1)
	}

	htmlHeader := `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ZippyServe Document</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; }
code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; background: #f6f8fa; padding: .2em .4em; border-radius: 3px; font-size: 85%; }
pre code { background: none; padding: 0; }
a { color: #0969da; text-decoration: none; }
img { max-width: 100%; }
blockquote { border-left: .25em solid #d0d7de; padding: 0 1em; color: #57606a; margin: 0; }
</style>
</head>
<body>
`
	htmlFooter := `
</body>
</html>`

	return []byte(htmlHeader + str + htmlFooter)
}

// Archive Extraction Engine
func extractArchive(src string) (string, error) {
	tmpDir, err := os.MkdirTemp("", "zippyserve-*")
	if err != nil {
		return "", err
	}

	tempDirsMu.Lock()
	tempDirs = append(tempDirs, tmpDir)
	tempDirsMu.Unlock()

	lower := strings.ToLower(src)
	if strings.HasSuffix(lower, ".zip") {
		return tmpDir, unzip(src, tmpDir)
	} else if strings.HasSuffix(lower, ".tar") || strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz") {
		return tmpDir, untar(src, tmpDir)
	}
	return "", errors.New("unsupported archive format")
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if err := validateAndExtract(f.Name, dest, f.FileInfo(), func() (io.ReadCloser, error) { return f.Open() }); err != nil {
			return err
		}
	}
	return nil
}

func untar(src, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()

	var r io.Reader = f
	if strings.HasSuffix(strings.ToLower(src), ".gz") || strings.HasSuffix(strings.ToLower(src), ".tgz") {
		gz, err := gzip.NewReader(f)
		if err != nil {
			return err
		}
		defer gz.Close()
		r = gz
	}

	tr := tar.NewReader(r)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if err := validateAndExtract(hdr.Name, dest, hdr.FileInfo(), func() (io.ReadCloser, error) { return io.NopCloser(tr), nil }); err != nil {
			return err
		}
	}
	return nil
}

func validateAndExtract(name string, dest string, info fs.FileInfo, openFunc func() (io.ReadCloser, error)) error {
	cleanName := filepath.Clean(name)
	if strings.Contains(cleanName, "..") || strings.Contains(cleanName, "\x00") {
		return fmt.Errorf("invalid path inside archive: %s", name)
	}

	target := filepath.Join(dest, cleanName)
	if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
		return fmt.Errorf("illegal file path: %s", target)
	}

	if info.IsDir() {
		return os.MkdirAll(target, 0755)
	}

	if info.Size() > MaxArchiveFileSize {
		return fmt.Errorf("file %s exceeds maximum allowed size", name)
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}

	srcFile, err := openFunc()
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, info.Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.CopyN(dstFile, srcFile, MaxArchiveFileSize)
	if err != nil && err != io.EOF {
		return err
	}
	return nil
}

func cleanupTempDirs() {
	tempDirsMu.Lock()
	defer tempDirsMu.Unlock()
	for _, dir := range tempDirs {
		log.Printf("Cleaning up temp dir: %s", dir)
		os.RemoveAll(dir)
	}
	tempDirs = nil
}
