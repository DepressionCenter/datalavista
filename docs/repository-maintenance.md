<!--
This file is part of DataLaVista™
docs/repository-maintenance.md
Author(s): Gabriel Mongefranco.
Created: 2026-10-25
Last Modified: 2026-10-28
Summary: Explains where the application source lives, how to build and test it, and how the website, the help pages, and releases are published.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Repository maintenance

[Back to help home](README.md)

This guide helps maintainers find the application source, build its browser
files, and run the automated tests. It also explains how the website and the
help pages are published, how a release is made, and where the shared
instructions, citation metadata, and preview images live.

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
The publish workflow, described under "Publishing the website" below, rebuilds
`dist/` after each push to `main` and commits it when it changed. The committed
copy is the one people download from GitHub, and it is what Zenodo preserves
inside the repository zip of each release.

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
and on manual dispatch. It runs one job that usually finishes in about a minute.
The only installation is the two Python packages in `requirements-docs.txt`:

1. `tests/check-repository.sh` checks that every JSON file is valid and that
   every source file in `src/`, every page in `docs/`, and the website files have
   their license header. On a pull request, it also rejects trailing spaces
   outside `src/lib` and any change under `dist/`.
2. MkDocs builds the help pages from `docs/` with `mkdocs build --strict`, so a
   broken link or a page missing from `mkdocs.yml` fails the pull request, and
   Python runs the unit tests for the link hook in `tests/docs_links_test.py`.
3. `build.sh` builds the outputs, and Node.js checks `dist/datalavista.js` for
   syntax errors.
4. Node.js runs the unit tests in `tests/*.test.cjs` with its built-in test
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
pip install -r requirements-docs.txt
mkdocs build --strict
python -m unittest tests/docs_links_test.py
node --test tests/*.test.cjs
```

On Windows, set `PYTHON=python` before the first command if your computer has no
`python3` command.

### Publishing the website

The website at `https://code.depressioncenter.org/datalavista/` is built and
published by the publish workflow in `.github/workflows/publish.yml`. It runs on
every push to `main` that changes `src/`, `docs/`, `build.sh`, `mkdocs.yml`,
`requirements-docs.txt`, or one of the folders the website serves, and on manual
dispatch. The repository's Pages source is set to "GitHub Actions" in the
repository settings, so the website is whatever the last successful run
uploaded, and no branch holds it.

The run does these things in order:

1. Builds the help pages from `docs/` with `mkdocs build --strict`. The settings
   are in `mkdocs.yml`, which lists every page under `nav` with the title shown
   in the navigation. The hook in `src/website/docs-links.py` rewrites each link
   that leaves `docs/`: a link into `dist`, `images`, `samples`, `styles`, or
   `presentations` points at that folder on the website, and a link to any
   other repository file points at GitHub. `docs/doc-template.md` is left out of
   the website because its placeholder text sits in angle brackets. The header,
   the footer, and the colors of the help pages come from
   `src/website/mkdocs-overrides/`, described below.
2. Runs `build.sh`, and commits `dist/` to `main` when it changed, with a
   message that ends in `[skip ci]` so the push does not start the workflow
   again.
3. Assembles the website in `_site/`: `src/website/index.html` and
   `src/website/404.html` at the root, `.nojekyll`, `dist/`, the help pages under
   `docs/`, and the `images`, `samples`, `styles`, and `presentations` folders.
4. Uploads `_site/` and deploys it to GitHub Pages.

The two packages in `requirements-docs.txt` are pinned. Material for MkDocs
has announced that it reaches end of life on May 5, 2027, with Zensical as its
successor, so plan to move the theme before then and check for a newer pinned
version when you update the other dependencies.

To preview the website on your computer, install the two packages in
`requirements-docs.txt`, run `mkdocs serve` to view the help pages while you
edit them, or build everything and serve the assembled folder:

```sh
mkdocs build --strict
bash build.sh
mkdir -p _site && cp src/website/index.html src/website/404.html .nojekyll _site/
cp -r dist images samples styles presentations _site/
python -m http.server 8000 --directory _site
```

Then open `http://localhost:8000/` in a browser. `_site/` is ignored by git.

When you add a page under `docs/`, add it to `nav` in `mkdocs.yml`, or the
strict build fails. The [documentation skill](../skills/documentation/SKILL.md)
has the page structure.

#### Header, footer, and colors of the help pages

The folder `src/website/mkdocs-overrides/` replaces three parts of the theme:

- `partials/header.html` is the theme's header with a Home button added. The
  button opens the address in `app_home_url` under `extra` in `mkdocs.yml`.
- `partials/footer.html` keeps the theme's previous and next page links and
  replaces the rest of the footer: the copyright and the Depression Center
  link on the left, and the View code and More apps links on the right. The
  text comes from `copyright`, and the addresses from `organization_name`,
  `organization_url`, `code_url`, and `more_apps_url` under `extra`. The
  theme's own "Made with Material for MkDocs" line is turned off with
  `generator: false`, and the README credits MkDocs and the theme instead.
- `assets/stylesheets/help.css` gives the pages the red of the home page in
  place of the theme's indigo, in both the light and the dark color schemes,
  and draws the Home button and the footer links. The palette entries in
  `mkdocs.yml` are set to `custom` so the theme leaves those colors to this
  file. The fonts stay the reader's system fonts.

To change an address or the copyright, edit `mkdocs.yml`, not the templates.
The two templates copy the theme's own markup from Material for MkDocs 9.8.0,
so after you change the pinned theme version, compare them with the theme's
`partials/header.html` and `partials/footer.html` and carry over any change.

#### Look of the website pages

`styles/datalavista-style.css` holds the colors, fonts, links, buttons, and
footer of the home page as a stylesheet that other pages on the website can
share. The 404 page uses it. The home page keeps its own copy of those rules
inside `src/website/index.html`, next to its animation styles, so change both
when a color or font changes. `styles/um-style.css` is the University of
Michigan palette that the media pack skill uses as a starting point for
artwork; no page on the website uses it. The DataLaVista app in `dist/` has
its own styles and does not use either file.

### Releases

Create a release on GitHub from a commit on `main` that already includes the
rebuilt `dist/` folder, which means waiting for the publish workflow's
"chore: rebuild outputs from src" commit after the last source change. The
release workflow in `.github/workflows/release.yml` then checks out the tag,
rebuilds `dist/`, and compares each file with the committed copy. If they match,
it attaches the four files to the release page. If they differ, it fails and
tells you to delete the release and its tag and create the release again from
the rebuild commit.

Zenodo archives the repository zip of each release through its GitHub
integration, and that zip holds the committed `dist/` folder. The files attached
to the release page are the same files, offered for download without opening
the zip.

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

Preserve the existing main README. Add detailed guides under `docs/`, link
them from [the help home](README.md), and add them to `nav` in `mkdocs.yml`. The
[documentation template](https://github.com/DepressionCenter/datalavista/blob/main/docs/doc-template.md)
intentionally retains page-specific placeholders for future guides. Replace
those fields when copying it to a real page.

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
maintenance. Review the outputs in `dist/` only when a source change requires a
build, and let the publish workflow commit them and publish the website.

### Additional resources

- [Help home](README.md)
- [Project instructions](../AGENTS.md)
- [Node.js test runner](https://nodejs.org/api/test.html)
- [MkDocs](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)
- [Publishing sources for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Project preferences](../skills/project-preferences/SKILL.md)
- [Documentation skill](../skills/documentation/SKILL.md)
- [Skills index](../SKILLS.md)
- [Third-party notices](../THIRD-PARTY-NOTICES.md)
- [SharePoint installation guide](how-to/install-in-sharepoint.md)
- [Architecture](architecture.md)
- [Documentation template](https://github.com/DepressionCenter/datalavista/blob/main/docs/doc-template.md)
- [EFDC repository template](https://github.com/DepressionCenter/EFDC-Repo-Template)
- [Citation metadata](../CITATION.cff)
- [Software license](../LICENSE)
- [License notices](../NOTICE)
- [Original screenshot 2](../images/datalavista-screenshot-2.png)
- [Repository preview](../images/Repo-preview.png)
- [Repository thumbnail](../images/Repo-preview-thumb.png)

[Back to help home](README.md)
