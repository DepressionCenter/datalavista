<!--
This file is part of DataLaVista™
skills/README.md
Author(s): Gabriel Mongefranco.
Created: 2026-09-05
Last Modified: 2026-10-25
Summary: Explains the layout, format, and review of repository skills.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Skills folder

[Back to project README](../README.md)

Keep all project-specific preferences and workflows in
[project-preferences/SKILL.md](project-preferences/SKILL.md). This folder also
contains the skills that every project inherits, which [SKILLS.md](../SKILLS.md)
lists, plus this guide and a copyable template for reusable skills.

### Skills that belong here

Each future skill lives at `skills/<skill-name>/SKILL.md`, with lowercase letters,
digits, and hyphens in the folder name. Start the file with YAML frontmatter
containing `name` (matching the folder) and `description` (what it does and when to
use it). Immediately after the closing `---`, include the required license heading
as a hidden HTML comment (`<!-- ... -->`). YAML must come first so the skill parser
can read the metadata; the license heading is still required. Follow it with the
Markdown workflow, relevant constraints, and ways to verify the result.

Copy [skill-template.md](skill-template.md) into `skills/<skill-name>/SKILL.md`
to start with the frontmatter, HTML license heading, and workflow sections in place.
Replace the example name, description, project title, year, and workflow with your
project details. Set the header's filename, authors, dates, and summary for the
new file. After copying into the skill folder, update the links to
`../../AGENTS.md` and `../project-preferences/SKILL.md` so they resolve from the new
location. The template itself is not an installed skill.

Keep project-specific skills together in
[project-preferences/SKILL.md](project-preferences/SKILL.md); do not split them
across separate files. `response-style`, `accessibility`, and `documentation` are the
exceptions, because they are reusable guidance rather than project-specific
preference, and they hold the detail that `AGENTS.md` sections 1, 9, and 16 summarize.
Carry all three into new repositories unchanged so agents behave the same way
everywhere.
Add `references/`, `scripts/`, or `assets/` inside a skill only when needed. Link
supporting files from `SKILL.md`; keep project rules in `AGENTS.md` and list each
reviewed skill in [the root index](../SKILLS.md). Never store secrets, real research
data, generated caches, or unrelated manuals here.

### Review before adoption

Prefer official documentation for the project's actual runtime and version.
Review third-party instructions, scripts, dependencies, licenses, network access,
and side effects before installation. Popularity is not evidence of safety.
Adapt the [authoring examples](../docs/skill-examples.md) to real project commands;
do not copy every example into every project.

### Conclusion

Keep this folder small and task-focused. Add a skill when it captures useful
project knowledge, then update the root index and verify its behavior.

[Back to project README](../README.md)
