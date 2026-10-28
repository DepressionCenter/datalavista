<!--
This file is part of DataLaVista™
docs/repository-maintenance.md
Author(s): Gabriel Mongefranco.
Created: 2026-10-25
Last Modified: 2026-10-27
Summary: Explains the application build, automated tests, shared instructions, citation metadata, and previews.
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
The build scripts combine them into `datalavista.js`, `DataLaVista.html`, and
`DataLaVista-nojs.html`. The last file loads the separate JavaScript file.

From the repository root, run the shell build with Bash and Python 3 available:

```sh
bash build.sh
```

The script uses an esbuild executable that is already on your PATH or cached by
an earlier build. If neither exists, it downloads esbuild 0.28.0 for your computer:
Linux or macOS, on an x64 or ARM64 processor. Each platform gets its own cached
file under `~/.cache/datalavista-build`, so a cache copied between computers never
supplies the wrong executable. On any other system the script stops and tells you
to install esbuild yourself. Windows maintainers use `build.ps1`, which picks the
x64 or ARM64 Windows package the same way.

Both scripts stop with an error if `datalavista.js` or `DataLaVista.html` is
missing the page layout or the styles. Without them, the page opens blank.

Review all three generated outputs after a source change. The existing build
workflow runs on pushes to `main` that change `src/` or `build.sh`, and on manual
dispatch. It commits generated outputs when the build changes them.

Documentation and metadata changes do not need a rebuild. Confirm that the source,
stylesheet, build workflow, and generated browser files remain unchanged.

### Automated tests

The Tests workflow in `.github/workflows/tests.yml` runs on every pull request
and on manual dispatch. It runs one job that usually finishes in under a minute
and installs nothing:

1. `tests/check-repository.sh` checks that every JSON file is valid and that
   every source file in `src/` has its license header. On a pull request, it also
   rejects trailing spaces and changes to the three generated outputs.
2. `build.sh` builds the outputs, and Node.js checks `datalavista.js` for syntax
   errors.
3. Node.js runs the unit tests in `tests/*.test.cjs` with its built-in test
   runner.

The unit tests don't open a browser. `tests/load-source.cjs` runs the `src/`
files in build order inside a Node.js sandbox, with small stand-ins for the page.
The tests then call the application's functions directly, such as `parseCSV`,
`buildWidgetSQL`, and `makeColumnNamesQueryable`. Code that needs a real page,
such as drawing the interface or running a query in AlaSQL, isn't covered.

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
maintenance. Review generated outputs only when a source change requires a build.

### Additional resources

- [Project instructions](../AGENTS.md)
- [Node.js test runner](https://nodejs.org/api/test.html)
- [Project preferences](../skills/project-preferences/SKILL.md)
- [Skills index](../SKILLS.md)
- [Documentation index](README.md)
- [Documentation template](doc-template.md)
- [EFDC repository template](https://github.com/DepressionCenter/EFDC-Repo-Template)
- [Citation metadata](../CITATION.cff)
- [Software license](../LICENSE)
- [License notices](../NOTICE)
- [Original screenshot 2](../images/datalavista-screenshot-2.png)
- [Repository preview](../images/Repo-preview.png)
- [Repository thumbnail](../images/Repo-preview-thumb.png)

[Back to project README](../README.md)
