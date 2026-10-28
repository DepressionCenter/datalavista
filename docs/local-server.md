<!--
This file is part of DataLaVista™
docs/local-server.md
Author(s): PHJ2000.
Created: 2026-10-26
Last Modified: 2026-10-28
Summary: Runs DataLaVista with the bundled local web server.
Notes: See README file for documentation and full license information.
Copyright © 2026 The Regents of the University of Michigan
Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>.
-->

# DataLaVista™

## Local server

[Back to project README](../README.md)

Use the bundled ZippyServe server to open DataLaVista through HTTP on your own
computer. You do not need to install a programming runtime. Keep the downloaded
project together so the server can find the application and its supporting files.

### Start and stop

1. On Windows x86-64, double-click `run.bat`.
   On Linux x86-64 or macOS Intel/Apple silicon, open a terminal in the project
   folder and run `bash run.sh`.
2. Open <http://127.0.0.1:8010/DataLaVista.html> in your browser. Keep the terminal open.
3. Press Ctrl+C in that terminal when you finish.

On Linux and macOS, choose another port with `bash run.sh 9000` if port 8010 is
already occupied. On Windows, run `bin\ZippyServe.exe -port 9000 -index
DataLaVista.html` from the project folder. Do not stop another application's server.

If a Unix download loses executable permissions, run `chmod +x bin/ZippyServe-*`.
If macOS blocks an unsigned downloaded executable, follow your organization's
software approval process. Do not disable system security controls.

### Connect data

Open `/DataLaVista.html` explicitly; the root address may show the README. Supporting files and samples use the
same HTTP origin. For example, open
<http://127.0.0.1:8010/samples/data/studies.csv> or load that URL in the app.
Local hosting avoids the `file://` origin, but remote servers still control their
own CORS and authentication rules. SharePoint permissions do not change.

### Data and network access

ZippyServe listens on `127.0.0.1` only. It serves non-hidden files throughout the
project folder, with permissive CORS response headers. Other local processes and
web pages may therefore read those files while it runs. Keep private research
files and credentials outside this folder, and stop the server after use. Hidden
files are excluded by default; the launchers do not enable MCP or browser logging.
This is a local preview server, not an authenticated deployment.

### Bundled server

The four binaries in `bin/` are built with Go 1.26.10 from the unchanged
[ZippyServe source at commit 1d55cdafa42adf60dddf22376d7686d37ca03676](https://github.com/DepressionCenter/ZippyServe/tree/1d55cdafa42adf60dddf22376d7686d37ca03676).
[Provenance and checksums](../vendor/zippyserve/PROVENANCE.txt), the source,
upstream build scripts, and the [GPL license](../vendor/zippyserve/LICENSE) are
included in `vendor/zippyserve/`. To rebuild all four binaries, install Go 1.26.10
and run `bash vendor/zippyserve/rebuild.sh`. Set `GO_BIN` if Go is not on your path.
Cross-compilation does not verify execution on Windows or macOS. The launchers
leave the application build and SharePoint installation unchanged.

### Next steps

Use the application's Connect + Load controls to explore your data, then stop the
local server when done.

### Additional resources

- [Project README](../README.md)
- [ZippyServe source](https://github.com/DepressionCenter/ZippyServe/tree/1d55cdafa42adf60dddf22376d7686d37ca03676)
- [Provenance and checksums](../vendor/zippyserve/PROVENANCE.txt)
- [ZippyServe license](../vendor/zippyserve/LICENSE)

[Back to project README](../README.md)
