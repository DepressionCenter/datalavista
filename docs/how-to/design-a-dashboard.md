<!--
This file is part of DataLaVista™
docs/how-to/design-a-dashboard.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Explains the Design tab: adding widgets to the canvas, mapping fields to them, choosing totals and averages, and adding filters.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Design a dashboard

[Back to help home](../README.md)

This page explains how to build the visual part of a dashboard on the Design
tab. It is for anyone who has a query that returns the right table and now wants
charts, tables, and filters. There is no more data work on this tab, because
every widget reads from the query result.

### The canvas

The Design tab shows a canvas and a set of widgets you can add to it. Each
widget shows one view of your query result. You can add as many as you need and
arrange them in the layout you want.

| Widget | Shows |
| --- | --- |
| Bar, Line, Pie, Scatter, Violin | A chart built from your fields. |
| Table | Rows and columns from the query result. |
| KPI | One number, such as a total or an average. |
| Text | Headings, notes, and links you write yourself. |
| Blank, Container | Empty space and groups that shape the layout. |

Filters are not widgets. You add them to the filter bar instead, and
they narrow every widget on the dashboard.

### Map fields to a widget

Each widget has settings that ask for the fields it needs. The names differ by
widget:

- A bar, line, or scatter chart asks for an X axis field, which groups the
  data, such as a department or a month, and one or more Y value fields, which
  are the numbers to show for each group.
- A pie chart asks for a Label field and a Values field.
- A violin plot asks for a Group field and a Values field.
- A table asks for the Columns to show.
- A KPI asks for one Metric.

For each number field, choose how to combine the rows in each group, such as a
sum, an average, or a count. Set the choice in the widget's settings.

### Filters

A filter lets the people who view the dashboard narrow the data without
changing the query. Drag a field such as a status or a year to the filter bar,
and every widget on the dashboard follows the selection. Check the filter on
the Preview Dashboard tab before you share.

### Tips for a readable dashboard

- Give each widget a short title that says what the number or chart means.
- Keep the fields you need and remove the rest in the query, so the page stays
  fast.
- Do not rely on color alone to carry a meaning. A label or a value next to the
  color helps everyone, including people who cannot tell the colors apart.
- Check the layout at the screen size your readers use. A dashboard that fits
  on a laptop may need a narrower layout on a phone.

### Conclusion

You can now place charts, tables, cards, text, and filters on the canvas and map
your fields to them. Next, check the result in
[Preview a dashboard](preview-a-dashboard.md).

### Additional resources

- [Help home](../README.md)
- [Build a query](build-a-query.md)
- [Preview a dashboard](preview-a-dashboard.md)
- [Compliance](../compliance.md), for the accessibility checks the app itself makes

[Back to help home](../README.md)
