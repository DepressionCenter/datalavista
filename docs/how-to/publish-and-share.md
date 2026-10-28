<!--
This file is part of DataLaVista™
docs/how-to/publish-and-share.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Explains the Generate Report tab: saving a dashboard to SharePoint or to a file, the share link, clickable report files in SharePoint, and permissions.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Publish and share a dashboard

[Back to help home](../README.md)

This page explains how to save a finished dashboard and share it. It covers
the Generate Report tab, the share link, and who can see a shared dashboard. It
is for anyone whose dashboard has passed the preview.

### The report configuration

The Generate Report tab shows the report configuration. This is a JSON file
with everything DataLaVista needs to open the dashboard again: the connections,
the query, and the layout. It does not hold the data itself. The one exception
is a file you loaded with the Upload Files tab, whose data is included.

### Ways to save

| Button | What happens |
| --- | --- |
| Publish to SharePoint | Saves the report configuration to a document library on your SharePoint site. DataLaVista then shows a link to the dashboard and a **Share** button that copies it. This is the easiest way to share with colleagues. The library's permissions and the data's permissions both still apply. |
| Save to SharePoint List | Saves the report configuration as an attachment on a SharePoint list item. |
| Save Local Copy | Downloads the report configuration to your computer. Use it for a backup, for version control, or to move a dashboard between sites. |

### Open a shared dashboard

To open a dashboard, add the address of its report configuration to the
DataLaVista page address, after `?report=`:

```text
https://contoso.sharepoint.com/sites/example/SitePages/DataLaVista.aspx?report=https://contoso.sharepoint.com/sites/example/Shared%20Documents/Reports/Study%20Status.json
```

You do not have to build this address yourself. **Publish to SharePoint** shows
it, and **Share** copies it. Paste it into an email or a Teams message. Add
`&reportMode=view` to the address to open the dashboard without the designer,
the way the [demo](get-started.md) does.

To open a saved file instead, use the **Open Dashboard** tab of the Connect to
Data Source popup.

### Make report files clickable in SharePoint

When you select a `.json` file in a document library, SharePoint downloads it.
Two optional formatting files in the repository make a report file open in
DataLaVista instead:

- [sp-link-column-formatting.json](https://github.com/DepressionCenter/datalavista/blob/main/src/sp-link-column-formatting.json)
  formats a column so each report file becomes a link.
- [sp-view-formatting.json](https://github.com/DepressionCenter/datalavista/blob/main/src/sp-view-formatting.json)
  formats a whole library view the same way.

Both expect the DataLaVista page at `/SitePages/DataLaVista.aspx` on the same
site. The [SharePoint install guide](install-in-sharepoint.md) puts it there.
Apply them from the column or view settings in SharePoint. Microsoft's
[column formatting](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/column-formatting)
and [view formatting](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/view-formatting)
pages show how.

### Who can see a shared dashboard

DataLaVista adds no permissions of its own. Two things decide what a person
sees:

- the permissions on the place where the report configuration is stored, such
  as the document library, and
- the permissions on each data source the dashboard reads, such as a SharePoint
  list or a file in a library.

A person who can open the DataLaVista page and read the data sources sees the
full dashboard. A person who cannot read a data source sees the dashboard
without that data. The report configuration never holds a password or a token.

### Conclusion

You can now save a dashboard to SharePoint or to a file, and send a link that
opens it. You can also explain who will be able to see it. If a link does not
open or data is missing, see [Troubleshooting](../troubleshooting.md).

### Additional resources

- [Help home](../README.md)
- [Preview a dashboard](preview-a-dashboard.md)
- [Install DataLaVista in SharePoint](install-in-sharepoint.md)
- [Compliance](../compliance.md), for what the saved file never contains
- [Column formatting in SharePoint](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/column-formatting)
- [View formatting in SharePoint](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/view-formatting)

[Back to help home](../README.md)
