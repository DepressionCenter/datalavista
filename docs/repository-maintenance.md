<!--
This file is part of DataLaVista™
docs/repository-maintenance.md
Author(s): Gabriel Mongefranco.
Created: 2026-10-25
Last Modified: 2026-10-27
Summary: Explains the application build, the library copies, the dist/ outputs, automated tests, shared instructions, citation metadata, and previews.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Repository maintenance

[Back to project README](../README.md)

This guide helps maintainers find the application source, build its browser
files, and run the automated tests. It also explains the shared repository
instructions, citation metadata, and preview images.

### Application files and builds

The numbered JavaScript fragments and HTML under `src/` are application source.
`src/lib/` holds exact copies of the third-party libraries the app uses, with
their license texts and `sha256sums.txt`. The build scripts pack both into four
files under `dist/`:

| File | Contents |
| --- | --- |
| `dist/datalavista.js` | The app, every library, the page markup, and the styles in one script. |
| `dist/DataLaVista.html` | A page with that script inline. Open it from disk or host it. |
| `dist/DataLaVista-nojs.html` | A page that loads `datalavista.js` from the same folder. |
| `dist/DataLaVista-sp.html.txt` | The code to paste into a SharePoint web part. See the [SharePoint guide](how-to/install-in-sharepoint.md). |

From the repository root, run the shell build with Bash and Python 3 available:

```sh
bash build.sh
```

Windows maintainers run `.uild.ps1`. Both scripts write the same files; only
the escaping of non-ASCII text inside the packed markup differs.

The script uses an esbuild executable that is already on your PATH or cached by
an earlier build. If neither exists, it downloads esbuild 0.28.0 for your computer:
Linux or macOS, on an x64 or ARM64 processor. Each platform gets its own cached
file under `~/.cache/datalavista-build`, so a cache copied between computers never
supplies the wrong executable. On any other system the script stops and tells you
to install esbuild yourself. `build.ps1` picks the x64 or ARM64 Windows package
the same way.

Both scripts empty `dist/` first, then check every file listed in
`src/lib/sha256sums.txt`. They stop with an error when a copy does not match its
checksum, when a listed file is missing, when a file in `src/lib` is not listed,
or when an output lacks the page markup, the styles, or a library. Only the app
source is minified. The libraries are copied unchanged, in the listed order, so
their checksums and license banners stay intact.

Inside `dist/datalavista.js`, `src/before-libraries.js` runs first and hides
`define.amd`, `window.exports`, and `window.module`, so each library creates its
usual global instead of registering with RequireJS on a SharePoint page.
`src/after-libraries.js` puts them back before the app starts. Both files run
outside the app's strict-mode function on purpose.

Review the outputs in `dist/` after a source change, but do not commit them.
The Build workflow runs on pushes to `main` that change `src/` or `build.sh`,
and on manual dispatch, and commits the rebuilt `dist/` when it changed.

### Library copies

To update a library, download the release file from the source named in
[THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) into `src/lib`, keeping the
file name used there. Then:

1. Compute its checksum with `sha256sum src/lib/<file>` or, in PowerShell,
   `Get-FileHash src/lib/<file>`, and replace its line in `src/lib/sha256sums.txt`.
2. Update the version in the table in `THIRD-PARTY-NOTICES.md` and in
   `docs/compliance.md`, and copy any changed license text into both places.
3. Run the build and the tests, then open `dist/DataLaVista.html` and
   `dist/DataLaVista-nojs.html` in a browser and confirm the app starts.

Libraries that register with a module loader must keep working when
`define.amd` reads as null and `exports` and `module` are undefined, because that
is what the guard files arrange while the libraries run.

Documentation and metadata changes do not need a rebuild. Confirm that the source,
stylesheet, build workflow, and `dist/` remain unchanged.

### Automated tests

The Tests workflow in `.github/workflows/tests.yml` runs on every pull request
and on manual dispatch. It runs one job that usually finishes in under a minute
and installs nothing:

1. `tests/check-repository.sh` checks that every JSON file is valid and that
   every source file in `src/` has its license header. On a pull request, it also
   rejects trailing spaces outside `src/lib` and any change under `dist/`.
2. `build.sh` builds the outputs, and Node.js checks `dist/datalavista.js` for
   syntax errors.
3. Node.js runs the unit tests in `tests/*.test.cjs` with its built-in test
   runner.

The unit tests don't open a browser. `tests/load-source.cjs` runs the `src/`
files in build order inside a Node.js sandbox, with small stand-ins for the page.
The tests then call the application's functions directly, such as `parseCSV`,
`buildWidgetSQL`, and `makeColumnNamesQueryable`. `tests/bundle-guard.test.cjs`
runs the two guard files around a probe, and `tests/build-platform.test.cjs`
runs the esbuild platform choice from `build.sh` through Bash. Code that needs a
real page, such as drawing the interface or running a query in AlaSQL, isn't
covered.

The functions on `window.dlv`, listed in `src/95-public-api.js`, are the app's
public interface. Browser checks and other pages call the app through it, and
nothing else inside the built script is reachable from outside. The page's own
buttons and inputs reach the app through `data-action` attributes, which
`registerAction` in `src/80-events.js` routes, so no function has to be global.

The build needs only Bash, Python 3, and esbuild. Node.js 18 or later is needed
only to run the tests. From the repository root, run:

```sh
bash tests/check-repository.sh main
node --test tests/*.test.cjs
```

On Windows, set `PYTHON=python` before the first command if your computer has no
`python3` command.

### Shared instructions and documentation

Start with [AGENTS.md](../AGENTS.md), then read the
[project preferences](../skills/project-preferences/SKILL.md) and applicable
guides in [SKILLS.md](../SKILLS.md). The root instruction files and
`.github/copilot-instructions.md` direct each supported client to `AGENTS.md`.

The shared guidance comes from the
[EFDC repository template](https://github.com/DepressionCenter/EFDC-Repo-Template).
The template's `src/code-sample-*` files are omitted because this repository
already has application source. Use the exact header text in `AGENTS.md` when
adding source files.

Preserve the existing main README. Add detailed guides under `docs/` and link
them from [the documentation index](README.md). The
[documentation template](doc-template.md) intentionally retains page-specific
placeholders for future guides. Replace those fields when copying it to a real page.

### Citation and licenses

[CITATION.cff](../CITATION.cff) uses the title, authors, and DOI already credited in
the README. `.zenodo.json` uses the same authors and identifies JavaScript as the
programming language. No unverified author identifiers are included.

Preserve the software license in [LICENSE](../LICENSE) and the software and
documentation notices in [NOTICE](../NOTICE).

### Preview images

The previews use [screenshot 2](../images/datalavista-screenshot-2.png), which shows
the data connection dialog, query builder, SQL editor, and dashboard designer.
The original screenshot stays unchanged.

- [Repository preview](../images/Repo-preview.png): 912×512 pixels.
- [Repository thumbnail](../images/Repo-preview-thumb.png): 360×202 pixels.

Keep the screenshot centered and preserve its proportions when cropping and
resizing. Use the same composition at both sizes.

### Conclusion

Use the source files for application changes and the local guides for repository
maintenance. Review the outputs in `dist/` only when a source change requires a build.

### Additional resources

- [Project instructions](../AGENTS.md)
- [Node.js test runner](https://nodejs.org/api/test.html)
- [Project preferences](../skills/project-preferences/SKILL.md)
- [Skills index](../SKILLS.md)
- [Documentation index](README.md)
- [Third-party notices](../THIRD-PARTY-NOTICES.md)
- [SharePoint installation guide](how-to/install-in-sharepoint.md)
- [Documentation template](doc-template.md)
- [EFDC repository template](https://github.com/DepressionCenter/EFDC-Repo-Template)
- [Citation metadata](../CITATION.cff)
- [Software license](../LICENSE)
- [License notices](../NOTICE)
- [Original screenshot 2](../images/datalavista-screenshot-2.png)
- [Repository preview](../images/Repo-preview.png)
- [Repository thumbnail](../images/Repo-preview-thumb.png)

[Back to project README](../README.md)
