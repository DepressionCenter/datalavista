<!--
This file is part of DataLaVista™
docs/how-to/connect-to-data.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Explains the data sources DataLaVista can connect to, the file types it reads, the extra fields it adds, and the Tables & Fields panel.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Connect to data

[Back to help home](../README.md)

This page explains the three ways to bring data into DataLaVista, the file types
it reads, and the extra fields it adds to make SharePoint data easier to query.
It is for anyone building a dashboard. Connecting is the first part of the
Query tab, and everything else builds on it.

### The Connect to Data Source popup

Select **Connect + Load** in the toolbar. The status bar says "Not connected"
until you do. The Connect to Data Source popup has four tabs, one for each kind
of source:

| Tab | Use it for | Good to know |
| --- | --- | --- |
| SharePoint Lists | Lists on the SharePoint site the page runs in. | Only available inside a SharePoint site. The site address fills in on its own after a few seconds. Your SharePoint permissions decide which lists you can read, and no password or token is stored. |
| Upload Files | A file on your computer. | Choose the file, select **Add to Queue**, and repeat for more files. The data is saved inside the report configuration, so the dashboard is self-contained. The file grows with the data, and anyone you share it with gets that copy of the data. |
| Remote Files | A file on the web, including a file in a SharePoint document library. | Paste the address, or select **Browse SharePoint** to pick a file from a library, then **Add to Queue**. The website that hosts the file must allow other sites to read it. Files in your own SharePoint site always work. |
| Open Dashboard | A saved report configuration. | Opens a dashboard you saved earlier, from a file or from a link. |

When the queue holds everything you need, select **Connect & Load**. Each file
or list appears in the Tables & Fields panel on the left.

### File types

| Format | File name ends in |
| --- | --- |
| CSV | `.csv` |
| JSON | `.json` |
| XML | `.xml` |
| SQLite | `.sqlite`, `.db` |
| Excel | `.xlsx`, `.xls` |

DataLaVista cannot connect directly to a database on your network, such as SQL
Server or Oracle, because a browser is not allowed to open those connections.
Export the data to one of the file types above, or put it in a SharePoint list.

### Extra fields DataLaVista adds

Real data, especially from SharePoint, often holds lists inside a single field or
whole records inside a field. DataLaVista adds extra fields next to the original
ones so you can query that data with plain SQL. The original field is never
changed.

- A SharePoint lookup field that allows several values keeps its display values,
  separated by semicolons. A field ending in `Ids` holds the matching ID numbers,
  and a field ending in `Data` holds the full records, which the `->` operator in
  SQL can reach and which the query builder uses for automatic joins.
- A SharePoint hyperlink field keeps the address. A field ending in `Label` holds
  the link text.
- A field that holds a list of values shows the most useful part of each value,
  separated by semicolons. When DataLaVista cannot tell which part is useful, it
  shows the list as text. A field ending in `Data` always holds the full list.
- A SharePoint person field, a single-value lookup field, and any field that
  holds a record are expanded into one field per part, named after the field and
  the part. A person field named `Requester` might become `RequesterTitle`,
  `RequesterEmail`, and `RequesterDepartment`, depending on what the data holds.

### The Tables & Fields panel

The panel on the left lists every connected source, its tables, and the fields in
each table. You can rename a source, a table, or a field here. Renaming changes
only how the name appears in DataLaVista, in your query results, and on your
dashboard. The data in the list or file stays as it was.

### Conclusion

You can now connect a SharePoint list, a file from your computer, or a file on
the web, and find its fields in the panel. Next, shape the data in
[Build a query](build-a-query.md).

### Additional resources

- [Help home](../README.md)
- [Get started](get-started.md)
- [Build a query](build-a-query.md)
- [Frequently asked questions](../faq.md)
- [Troubleshooting](../troubleshooting.md)

[Back to help home](../README.md)
