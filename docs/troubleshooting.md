<!--
This file is part of DataLaVista™
docs/troubleshooting.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Lists the problems people run into with DataLaVista, what causes each one, and how to fix it.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Troubleshooting

[Back to help home](README.md)

This page lists the problems people run into most often, with the cause and
the fix for each. It is for anyone whose dashboard, page, or file is not doing
what they expect. Each entry starts with what you see.

### A file on the web does not load

Cause: the website that hosts the file does not allow other sites to read it,
or you do not have permission to read the file. DataLaVista tries to download
the file directly first. If that fails, it asks whether it may use a relay
service, and names the services it would use.

Fix: put the file in a document library on your own SharePoint site and connect
to it there, which always works. If the file must stay where it is, check that
you can open its address in a new browser tab, and ask the owner of the website
to allow access from the site that hosts DataLaVista.

### The SharePoint page stays blank

Cause: the page cannot find or run the DataLaVista script.

Fix: open the browser console with F12 and read the first error.

- If it says the script could not be found, check that `datalavista.js` is in
  the `scripts` folder of the Site Assets library and that the page is directly
  in Site Pages, as the [install guide](how-to/install-in-sharepoint.md) describes.
- If it says the script was blocked, ask your SharePoint administrator whether
  the tenant's content security policy allows scripts from the site's own Site
  Assets library.
- If it says DataLaVista could not find the `dlv-root` element, the web part
  code was not pasted in full. Paste the whole contents of
  `DataLaVista-sp.html.txt` again.

### "DataLaVista could not start because its built-in ... library did not load"

Cause: another script on the same page kept one of DataLaVista's built-in
libraries from loading.

Fix: remove other code from the page's web parts and refresh the page. If the
message appears again, ask your site administrator and mention the errors shown
in the browser console.

### The numbers do not match the source

Cause: almost always the query. A join that matches too many rows multiplies
the numbers, a filter drops rows you expected, or a number came through as
text and was not added up.

Fix: go back to the Query tab and compare the results preview with the source.
Check the row count first. Then check that the fields you add up are numbers.
The [Build a query](how-to/build-a-query.md) guide lists the checks to make.

### The share link downloads a file instead of opening the dashboard

Cause: the link points at the report configuration file itself instead of at
the DataLaVista page with the file's address in its `report` part.

Fix: use the link that **Publish to SharePoint** shows, or copy it with
**Share**. To make report files open from a document library, apply the
formatting files described in
[Publish and share a dashboard](how-to/publish-and-share.md).

### A shared dashboard shows no data for someone else

Cause: that person can open the DataLaVista page but cannot read one of the
data sources, such as a SharePoint list or a file in a library.

Fix: give them read access to the data source, or share a dashboard built from
data they can read. DataLaVista adds no permissions of its own, so SharePoint's
permissions decide what each person sees.

### The dashboard is slow

Cause: the viewer's browser is doing all the work, and the query returns more
data than the dashboard needs.

Fix: on the Query tab, remove unneeded fields and filter unneeded rows. Keep
the number of widgets reasonable, and preview after each change.

### An older version keeps showing after an update

Cause: the browser kept a copy of the old `datalavista.js`.

Fix: press Ctrl+F5 on the page, or clear the browser's saved files for the
site, and open the page again.

### Conclusion

Most problems come from the data source or the query, and the fix is on the
Query tab or in SharePoint permissions. If a problem is not listed here, report
it on the [issue tracker on GitHub](https://github.com/DepressionCenter/datalavista/issues)
with the steps that lead to it and the message in the browser console.

### Additional resources

- [Help home](README.md)
- [Frequently asked questions](faq.md)
- [Install DataLaVista in SharePoint](how-to/install-in-sharepoint.md)
- [Build a query](how-to/build-a-query.md)
- [Publish and share a dashboard](how-to/publish-and-share.md)
- [Compliance](compliance.md), for how the relay services are approved
- [DataLaVista issue tracker](https://github.com/DepressionCenter/datalavista/issues)

[Back to help home](README.md)
