<!--
This file is part of DataLaVista™
docs/how-to/build-a-query.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Explains the Query Builder, the SQL Editor, and the checks to make on the results preview before designing a dashboard.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Build a query

[Back to help home](../README.md)

This page explains how to turn your connected data into the one flat table that
every widget on a dashboard uses. It covers the Query Builder, the SQL Editor,
and the results preview. It is for anyone building a dashboard, whether or not
you know SQL.

### The table behind every dashboard

Every chart, table, and filter on a dashboard reads from a single table, the
result of your query. The Query tab is where you define that table: which
sources, which fields, how they join, and which rows to keep. Anything that is
wrong here will be wrong in every widget, so it is worth checking before you
move on.

### The Query Builder

The Query Builder lets you build the query without writing SQL. It has a Basic
mode and an Advanced mode, which you switch with the buttons above it.

- Automatic joins. DataLaVista finds relationships between your tables, such as
  SharePoint lookup columns and SQLite foreign keys, and joins the tables for
  you. You can change or remove a join.
- The trash can. Use it to remove a field, a join, or a filter without searching
  through the whole query. Remove fields you do not need before you design the
  dashboard, because fewer fields mean less memory use and a faster page.
- The Properties, Filters, Group, Sort, and Row Count panel. Set how a field
  appears, filter rows, group and sort the result, and limit the number of rows.
  A focused query is easier to read and faster to run.

### The SQL Editor

If you prefer to write SQL, the SQL Editor runs it entirely in your browser. You
can write `SELECT` statements with aggregates, subqueries, and joins across
several tables. As you type, the editor suggests table names, field names, the
extra fields DataLaVista adds, and SQL keywords. Use the `->` operator to reach
the parts of a field that holds a record, such as the `Data` fields described in
[Connect to data](connect-to-data.md).

### Check the results preview

The results preview below the query shows exactly the table your dashboard will
use. Look at it every time you change the query, and before you switch to the
Design tab. Check for:

- empty values where you expected data,
- more rows than the source has, which means a join matched too many rows,
- numbers or dates that came through as text,
- fields that are missing or named in a way that will confuse readers.

Most dashboard problems start in the query, and they are easier to fix here
than after you have placed the widgets.

### Conclusion

You can now build the table your dashboard needs, with the Query Builder or with
SQL, and confirm it in the results preview. Next, place widgets on the canvas in
[Design a dashboard](design-a-dashboard.md).

### Additional resources

- [Help home](../README.md)
- [Connect to data](connect-to-data.md)
- [Design a dashboard](design-a-dashboard.md)
- [Frequently asked questions](../faq.md)

[Back to help home](../README.md)
