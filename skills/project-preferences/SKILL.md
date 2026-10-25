---
name: project-preferences
description: Apply repository-specific preferences when planning, implementing, or reviewing changes in this project.
---

<!--
This file is part of DataLaVista™
Copyright © 2026 The Regents of the University of Michigan
Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Project preferences

Use this skill when planning, implementing, or reviewing changes in this repository.
Keep all project-specific preferences and workflows in this single file. This skill
supplements `AGENTS.md` and cannot weaken its security, privacy, accessibility,
licensing, testing, or authorization rules.

### Purpose and scope

DataLaVista™ is a client-side JavaScript dashboard and reporting toolkit. It
supports browser use and installation in a SharePoint Modern Script Editor web
part. Preserve the existing framework and deployment approach.

### Environment and structure

Follow the repository’s existing file and folder naming conventions when adding new files.

- `src/` holds the application HTML, ordered JavaScript fragments, license text,
  and SharePoint formatting JSON. The EFDC template's source samples do not belong here.
- `DataLaVista.html`, `DataLaVista-nojs.html`, and `datalavista.js` are generated
  outputs. Keep changes to them consistent with the build scripts.
- `samples/` contains example data, dashboard configurations, and sample generators.
- `images/` contains project screenshots and preview assets. `styles/um-style.css`
  is the existing project stylesheet; preserve its established behavior.
- Keep local documentation in `docs/`. Keep shared instructions in `AGENTS.md`
  and project-specific preferences in this file.

### Setup and verification

- Read `build.sh`, `build.ps1`, and `.github/workflows/build.yml` before changing
  the build. The shell build uses Bash, Python 3, and esbuild; it downloads
  esbuild 0.28.0 if no executable or cached copy is available.
- Run `bash build.sh` from the repository root after source changes and inspect
  all three generated outputs. Use `build.ps1` for the PowerShell build.
- The build workflow runs on pushes to `main` that change `src/` or `build.sh`,
  and on manual dispatch. It can commit generated outputs.
- For documentation and metadata changes, run `git diff --check`, validate JSON
  and citation metadata, and check local links. Confirm that application files
  and generated outputs are unchanged when the change does not affect behavior.

### Project constraints

- Preserve the main README's content, structure, credits, trademarks, and license
  notices. New detailed guides belong in `docs/`.
- Preserve the existing DOI, `10.5281/zenodo.19245606`, and the credited authors:
  Gabriel Mongefranco, Jeremy Gluskin, and Shelley Boa. Do not invent ORCIDs.
- Use the exact header wording in `AGENTS.md` for new source files. Do not
  rewrite existing source headers as part of an unrelated documentation change.
- Keep the instruction files in the root and `.github/copilot-instructions.md`
  tracked. Ignore local tool settings, caches, and real environment files.
- The preview images use `images/datalavista-screenshot-2.png`. Preserve the
  source screenshot. `Repo-preview.png` is 912×512 pixels and
  `Repo-preview-thumb.png` is 360×202 pixels, with matching centered crops.

### Terms

- DataLaVista™: the project name.
- Data source: a connected SharePoint list or file used by a query.
- Dashboard: the tables and visuals assembled in the designer.
- Report configuration: the JSON used to save and reopen a dashboard.

### Project skills

Read the applicable reusable guidance listed in `SKILLS.md`. Keep future
DataLaVista-specific workflows in this file.

### Conclusion

Keep repository maintenance separate from changes to application behavior, and
verify generated outputs whenever source changes require a build.

### Additional resources

- [Project README](../../README.md)
- [Repository maintenance](../../docs/repository-maintenance.md)
- [Project instructions](../../AGENTS.md)
- [Skills index](../../SKILLS.md)
