// This file is part of ZippyServe
// instrument.go
// Author(s): Gabriel Mongefranco.
// Created: 2026-08-02
// Summary: Optional browser-side instrumentation, enabled with -mcp-browser (on
//          top of -mcp), that injects a first-party script into served HTML so
//          uncaught errors, unhandled promise rejections, and console output can
//          be captured and exposed via the get_console_log MCP tool. See
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
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	// mcpReportPath is where the injected browser script POSTs one telemetry
	// event at a time (console output, uncaught error, or unhandled promise
	// rejection). Reserved under mcpPathPrefix so it inherits ServeHTTP's
	// "always intercepted, 404 when disabled" routing (see main.go).
	mcpReportPath = mcpPathPrefix + "/report"

	// mcpInjectScriptPath serves the instrumentation script as an external
	// file — not inlined into injected HTML — specifically so a page's own
	// Content-Security-Policy only needs script-src 'self' to allow it, not
	// 'unsafe-inline'.
	mcpInjectScriptPath = mcpPathPrefix + "/inject.js"

	// maxConsoleLogEntries bounds the in-memory console-log ring buffer.
	// Larger than maxRequestLogEntries (200, mcp.go) because a page under
	// active development can log far more chattily than the server sees
	// HTTP requests.
	maxConsoleLogEntries = 500

	// Per-field length caps applied server-side to every ingested report, as
	// defense-in-depth even though the injected client script also
	// self-truncates before sending (see browserInstrumentScript).
	maxConsoleMessageLen = 4000 // bytes
	maxConsoleStackLen   = 8000 // bytes
	maxConsoleURLLen     = 2000 // bytes; applied to Source and PageURL

	// maxReportBodySize caps the POST /__mcp/report request body. One
	// telemetry event, not a batch — much smaller than handleMCPRequest's
	// 1 MB JSON-RPC cap (mcp.go).
	maxReportBodySize = 1 << 16 // 64 KB
)

var (
	// headOpenTagRegex matches an opening <head> tag, case-insensitively,
	// with or without attributes. The (\s[^>]*)? group requires a whitespace
	// boundary before any attributes, so this does NOT also match
	// <header ...> — a bare [^>]* would happily absorb "er" before '>'.
	headOpenTagRegex = regexp.MustCompile(`(?i)<head(\s[^>]*)?>`)

	// bodyCloseTagRegex matches </body> (closing tags carry no attributes,
	// so only optional trailing whitespace is allowed before '>').
	bodyCloseTagRegex = regexp.MustCompile(`(?i)</body\s*>`)

	consoleLog   []consoleLogEntry
	consoleLogMu sync.Mutex

	errBrowserInstrumentationDisabled = simpleError("browser instrumentation is disabled; restart ZippyServe with both -mcp and -mcp-browser to use get_console_log")

	// cspMetaTagRegex loosely matches a page-authored
	// <meta http-equiv="Content-Security-Policy" ...> tag, case-insensitively.
	// It only detects presence — it does not parse directives (source
	// lists, nonces, hashes), which is real complexity not attempted here;
	// see warnIfCSPMightBlockInjection and docs/mcp-design.md.
	cspMetaTagRegex = regexp.MustCompile(`(?i)<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>`)

	// cspWarnedPaths dedupes warnIfCSPMightBlockInjection's log line per
	// request path, so an actively-reloaded page during development doesn't
	// spam the log on every request.
	cspWarnedPaths   = map[string]bool{}
	cspWarnedPathsMu sync.Mutex
)

// warnIfCSPMightBlockInjection logs a one-time-per-path heads-up when
// htmlBytes contains its own Content-Security-Policy meta tag, since the
// injected instrumentation <script src="/__mcp/inject.js"> tag will be
// silently dropped by the browser if that policy's script-src doesn't
// allow 'self' — an undetectable-from-the-server failure mode otherwise
// (see "Known residual risk: page CSP" in docs/mcp-design.md). This is
// presence detection only, not directive parsing: a false "might block"
// warning (e.g. a policy that already allows 'self') is an acceptable
// trade-off for a dev-tool nicety that doesn't need a real CSP parser.
func warnIfCSPMightBlockInjection(pageURL string, htmlBytes []byte) {
	if !cspMetaTagRegex.Match(htmlBytes) {
		return
	}
	cspWarnedPathsMu.Lock()
	defer cspWarnedPathsMu.Unlock()
	if cspWarnedPaths[pageURL] {
		return
	}
	cspWarnedPaths[pageURL] = true
	log.Printf("Warning: %s declares its own Content-Security-Policy meta tag; the injected MCP instrumentation script may be silently blocked unless script-src allows 'self'", pageURL)
}

// consoleLogEntry is both the wire shape POSTed by the injected browser
// script to mcpReportPath and the shape returned by the get_console_log MCP
// tool. Time is always server-stamped in handleMCPReport (any client-
// supplied value is ignored/overwritten) so entries can't be spoofed to
// misrepresent ordering.
type consoleLogEntry struct {
	Type    string    `json:"type"`            // "error" | "unhandledrejection" | "console"
	Level   string    `json:"level,omitempty"` // console.* level; empty for error/unhandledrejection
	Message string    `json:"message"`
	Source  string    `json:"source,omitempty"` // window.onerror source file URL
	Line    int       `json:"line,omitempty"`
	Col     int       `json:"col,omitempty"`
	Stack   string    `json:"stack,omitempty"`
	PageURL string    `json:"pageUrl"`
	Time    time.Time `json:"time"`
}

// recordConsoleLog appends an entry to the in-memory console-log ring
// buffer, evicting the oldest entry once maxConsoleLogEntries is reached.
// Safe for concurrent use.
func recordConsoleLog(entry consoleLogEntry) {
	consoleLogMu.Lock()
	defer consoleLogMu.Unlock()
	consoleLog = append(consoleLog, entry)
	if len(consoleLog) > maxConsoleLogEntries {
		consoleLog = consoleLog[len(consoleLog)-maxConsoleLogEntries:]
	}
}

// recentConsoleLog returns up to limit of the most recent console-log
// entries, newest first, optionally filtered to a single Type. Safe for
// concurrent use.
func recentConsoleLog(limit int, typeFilter string) []consoleLogEntry {
	consoleLogMu.Lock()
	defer consoleLogMu.Unlock()
	result := make([]consoleLogEntry, 0, limit)
	for i := len(consoleLog) - 1; i >= 0 && len(result) < limit; i-- {
		if typeFilter != "" && consoleLog[i].Type != typeFilter {
			continue
		}
		result = append(result, consoleLog[i])
	}
	return result
}

// isLocalOrigin reports whether origin exactly matches this server
// instance's local origin — http://127.0.0.1:<port> or
// http://localhost:<port>. ZippyServe only binds 127.0.0.1 (main.go's
// http.Server.Addr), but the shipped run scripts (run-windows.ps1,
// run-linux.sh, run-mac.command) open the browser at
// http://localhost:<port>, not http://127.0.0.1:<port> — both resolve to
// the same listener, and a page loaded via either hostname sends that same
// hostname back as Origin on a same-origin POST, so both are accepted.
//
// Shared by reportOriginAllowed (below) and mcpOriginAllowed (mcp.go) —
// both need this exact-origin comparison but differ on what to do when
// Origin is ABSENT, so that presence policy is deliberately left to each
// caller rather than folded in here.
func isLocalOrigin(origin string, port int) bool {
	return origin == fmt.Sprintf("http://127.0.0.1:%d", port) ||
		origin == fmt.Sprintf("http://localhost:%d", port)
}

// reportOriginAllowed reports whether r's Origin header matches this server
// instance. Origin is required here (missing → reject) because
// /__mcp/report is only ever called by the browser-injected first-party
// script via a real fetch/sendBeacon, which per the Fetch spec always sends
// Origin on a POST. Contrast with mcpOriginAllowed (mcp.go), which allows a
// missing Origin because /__mcp is also called by non-browser MCP clients
// that never send one.
//
// This check exists because ServeHTTP already sets
// Access-Control-Allow-Origin: * on every response (main.go), and that
// header only governs whether a cross-origin script may READ a response —
// it does not stop the request from being sent and taking effect
// server-side. Without this check, any origin's JS could POST fabricated
// events into a log an AI agent later reads and trusts (a confused-deputy /
// log-poisoning risk).
func reportOriginAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}
	return isLocalOrigin(origin, *portFlag)
}

// handleMCPReport is the HTTP entry point for POST /__mcp/report — the
// injected browser script's fire-and-forget telemetry sink. One event per
// request; not the JSON-RPC protocol used by mcpPathPrefix itself.
func handleMCPReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	if !reportOriginAllowed(r) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxReportBodySize))
	if err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	var entry consoleLogEntry
	if err := json.Unmarshal(body, &entry); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	if entry.Type != "error" && entry.Type != "unhandledrejection" && entry.Type != "console" {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	entry.Message = truncateString(entry.Message, maxConsoleMessageLen)
	entry.Stack = truncateString(entry.Stack, maxConsoleStackLen)
	entry.Source = truncateString(entry.Source, maxConsoleURLLen)
	entry.PageURL = truncateString(entry.PageURL, maxConsoleURLLen)
	entry.Time = time.Now().UTC()

	recordConsoleLog(entry)
	w.WriteHeader(http.StatusNoContent)
}

// handleMCPInjectScript serves the instrumentation script at
// GET /__mcp/inject.js.
func handleMCPInjectScript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	_, _ = w.Write([]byte(browserInstrumentScript))
}

// truncateString caps s at maxBytes, dropping any trailing partial UTF-8
// rune left by the cut so the result stays valid UTF-8.
func truncateString(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	return strings.ToValidUTF8(s[:maxBytes], "") + "...(truncated)"
}

// injectBrowserScript inserts a <script src="mcpInjectScriptPath"> tag into
// htmlBytes: immediately after the opening <head> tag if present, else
// immediately before </body> if present, else appended at the end of the
// document (covers bare HTML fragments with neither tag). Regex-based, not a
// real HTML parser — consistent with this codebase's existing
// regex-based renderMarkdown (main.go); "good enough for a dev tool," not a
// new pattern.
func injectBrowserScript(htmlBytes []byte) []byte {
	tag := []byte(`<script src="` + mcpInjectScriptPath + `"></script>`)

	if loc := headOpenTagRegex.FindIndex(htmlBytes); loc != nil {
		return spliceBytes(htmlBytes, loc[1], tag)
	}
	if loc := bodyCloseTagRegex.FindIndex(htmlBytes); loc != nil {
		return spliceBytes(htmlBytes, loc[0], tag)
	}
	out := make([]byte, 0, len(htmlBytes)+len(tag))
	out = append(out, htmlBytes...)
	return append(out, tag...)
}

func spliceBytes(orig []byte, at int, insert []byte) []byte {
	out := make([]byte, 0, len(orig)+len(insert))
	out = append(out, orig[:at]...)
	out = append(out, insert...)
	return append(out, orig[at:]...)
}

// toolGetConsoleLog implements the get_console_log MCP tool. Mirrors
// toolGetRecentRequests (mcp.go) exactly for limit handling, plus an
// optional type filter.
func toolGetConsoleLog(argsJSON json.RawMessage) (map[string]interface{}, error) {
	if !*mcpBrowserFlag {
		return nil, errBrowserInstrumentationDisabled
	}

	var args struct {
		Limit int    `json:"limit"`
		Type  string `json:"type"`
	}
	if len(argsJSON) > 0 {
		if err := json.Unmarshal(argsJSON, &args); err != nil {
			return nil, errInvalidToolParams
		}
	}
	if args.Type != "" && args.Type != "error" && args.Type != "unhandledrejection" && args.Type != "console" {
		return nil, errInvalidToolParams
	}

	limit := args.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > maxConsoleLogEntries {
		limit = maxConsoleLogEntries
	}

	return map[string]interface{}{
		"entries": recentConsoleLog(limit, args.Type),
	}, nil
}

// browserInstrumentScript is served verbatim at GET /__mcp/inject.js. Field
// names in the JSON it POSTs to mcpReportPath must match consoleLogEntry's
// JSON tags exactly (type, level, message, source, line, col, stack,
// pageUrl) — keep both sides in sync if either changes.
const browserInstrumentScript = `// ZippyServe browser instrumentation (injected because -mcp-browser is
// enabled). Captures console output, uncaught errors, and unhandled promise
// rejections, and reports them to this server's get_console_log MCP tool.
// Not a general-purpose analytics/RUM script. See docs/mcp-design.md.
(function () {
  "use strict";
  if (window.__zippyServeInstrumented) return;
  window.__zippyServeInstrumented = true;

  var REPORT_URL = "/__mcp/report";
  var MAX_MESSAGE_LEN = 4000;
  var MAX_STACK_LEN = 8000;

  var originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };

  var sending = false; // reentrancy guard: never let report-sending itself trigger another report

  function truncate(str, max) {
    if (typeof str !== "string") return str;
    return str.length > max ? str.slice(0, max) + "...(truncated)" : str;
  }

  function safeStringifyValue(value) {
    if (typeof value === "string") return value;
    if (value === undefined) return "undefined";
    if (value instanceof Error) {
      return value.stack || (value.name + ": " + value.message);
    }
    try {
      var seen = [];
      return JSON.stringify(value, function (key, val) {
        if (typeof val === "function") return "[Function]";
        if (typeof val === "object" && val !== null) {
          if (seen.indexOf(val) !== -1) return "[Circular]";
          seen.push(val);
        }
        return val;
      });
    } catch (e) {
      try { return String(value); } catch (e2) { return "[Unstringifiable]"; }
    }
  }

  function safeStringifyArgs(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      parts.push(safeStringifyValue(args[i]));
    }
    return parts.join(" ");
  }

  function send(payload) {
    if (sending) return;
    sending = true;
    try {
      payload.pageUrl = location.href;
      var body = JSON.stringify(payload);
      var sent = false;
      if (navigator.sendBeacon) {
        try {
          var blob = new Blob([body], { type: "application/json" });
          sent = navigator.sendBeacon(REPORT_URL, blob);
        } catch (e) { sent = false; }
      }
      if (!sent) {
        try {
          fetch(REPORT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body,
            keepalive: true
          }).catch(function () {});
        } catch (e) { /* give up silently: never let telemetry break the page */ }
      }
    } finally {
      sending = false;
    }
  }

  window.addEventListener("error", function (event) {
    send({
      type: "error",
      message: truncate(event.message || String(event.error), MAX_MESSAGE_LEN),
      source: event.filename || "",
      line: event.lineno || 0,
      col: event.colno || 0,
      stack: truncate((event.error && event.error.stack) || "", MAX_STACK_LEN)
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    var message, stack;
    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack || "";
    } else {
      message = safeStringifyValue(reason);
      stack = "";
    }
    send({
      type: "unhandledrejection",
      message: truncate(message, MAX_MESSAGE_LEN),
      stack: truncate(stack, MAX_STACK_LEN)
    });
  });

  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    console[level] = function () {
      var args = arguments;
      try {
        send({
          type: "console",
          level: level,
          message: truncate(safeStringifyArgs(args), MAX_MESSAGE_LEN)
        });
      } catch (e) { /* never let instrumentation break the page's own console call */ }
      originalConsole[level].apply(console, args);
    };
  });
})();
`
