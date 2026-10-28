<!--
This file is part of DataLaVista™
docs/architecture.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Describes the pieces of DataLaVista, how data moves from a source to each widget, and how the app is deployed.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Architecture

[Back to help home](README.md)

This page describes how DataLaVista is put together and how data moves through
it. It is for developers, maintainers, and reviewers who need to understand the
app before changing it or deciding whether it fits their environment. DataLaVista
is a single script that runs in the browser, with no server of its own.

### The pieces

The built file `dist/datalavista.js` holds everything the app needs:

| Piece | Role |
| --- | --- |
| Application code, from the numbered files in `src/` | The tabs, the query builder, the designer, the preview, and the report generator. |
| AlaSQL | Runs SQL queries in the browser against the loaded tables. |
| sql.js | Reads SQLite files. AlaSQL hands those files to it. |
| SheetJS | Reads Excel files. |
| ECharts, with the violin chart add-on | Draws the charts. |
| CodeMirror | The SQL editor, with highlighting and suggestions. |
| lz-string | Compresses the report configuration for links. |
| Page markup and styles | Built into the script, so one `div` on any page is enough. |

The same script is packed three ways: inline in `dist/DataLaVista.html`, loaded
by `dist/DataLaVista-nojs.html`, and loaded from a SharePoint site's Site Assets
library by the web part code in `dist/DataLaVista-sp.html.txt`. The
[Repository maintenance](repository-maintenance.md) page explains the build, and
[Third-party notices](../THIRD-PARTY-NOTICES.md) lists each library's license.

### Data flow

Data moves through six stages in the browser, so each widget stays fast and
independent of the others:

1. Raw table. The data as loaded from the source: a SharePoint list, a file on
   the web, or an uploaded file.
2. Views. A virtual copy of each raw table with the extra fields DataLaVista
   adds for lookups, people, links, and lists, described in
   [Connect to data](how-to/connect-to-data.md).
3. Query. The SQL from the Query Builder or the SQL Editor, which joins,
   filters, renames, and reshapes the views into one flat table.
4. Materialized view. The query result, kept in memory. This is the table the
   dashboard uses.
5. View with global filters. The materialized view with the dashboard's filter
   selections applied.
6. Query per widget. Each widget runs its own small query against the filtered
   view to group and total the values it shows.

A change to a filter reruns stages 5 and 6 only. A change to the query reruns
stages 3 to 6. Reconnecting a source starts again from stage 1.

### Deployment

DataLaVista is distributed as one script with no file to install on a server.
It runs:

- inside a SharePoint page, where it reads the site's lists with the signed-in
  person's own permissions,
- inside another web application, as an `iframe` or an embedded script,
- from a file on a computer, with uploaded files, or
- from any static web server, such as this website.

There is no backend service, no database of its own, and no server-side
interface. Permissions come from the platform that hosts the page and the
places that hold the data.

### Conclusion

You now know the pieces inside the built script, the six stages data passes
through, and where the app can run. For the build, the tests, and how the
website is published, read [Repository maintenance](repository-maintenance.md).
For the security and accessibility controls, read [Compliance](compliance.md).

### Additional resources

- [Help home](README.md)
- [Repository maintenance](repository-maintenance.md)
- [Compliance](compliance.md)
- [Connect to data](how-to/connect-to-data.md)
- [Third-party notices](../THIRD-PARTY-NOTICES.md)

[Back to help home](README.md)
