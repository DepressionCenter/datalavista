<!--
This file is part of DataLaVista™
docs/how-to/get-started.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Explains how to open DataLaVista, where it can run, and how to build a first dashboard with sample data.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Get started

[Back to help home](../README.md)

This page shows you the quickest ways to open DataLaVista and walks you through
a first dashboard with sample data. It is for anyone who wants to try the tool
before installing it anywhere. You need a current web browser and about ten
minutes.

### Before you start

- A current browser, such as Edge, Chrome, Firefox, or Safari.
- Some data, or the sample files linked below. DataLaVista reads CSV, JSON, XML,
  Excel, and SQLite files, and SharePoint lists when it runs inside a
  SharePoint site.

There is nothing to install. DataLaVista is one web page, and everything it
needs is inside that page.

### Open the live demo

The quickest way to see DataLaVista is the demo on this website:

- [Project Health Dashboard](../../dist/DataLaVista.html?reportMode=view&report=https://code.depressioncenter.org/datalavista/samples/reports/Project%20Health%20Dashboard.json):
  a finished dashboard, the way people who receive a link see it.
- [Dashboard designer](../../dist/DataLaVista.html?reportMode=edit&report=https://code.depressioncenter.org/datalavista/samples/reports/Project%20Health%20Dashboard.json):
  the same dashboard open in the designer, so you can see how it was built.

The demo loads only the sample data on this website. Nothing you do in it is
saved unless you download it.

### Run DataLaVista on your own computer

1. Download [DataLaVista.html](../../dist/DataLaVista.html) and save it anywhere
   on your computer. In most browsers, right-click the link and choose
   **Save link as**.
2. Open the saved file in your browser, for example by double-clicking it.

Files you upload from your computer work right away. Files on the web only load
when the website that hosts them allows it, which the
[Connect to data](connect-to-data.md) guide explains.

### Add DataLaVista to a website

- For a SharePoint Online site, follow
  [Install DataLaVista in SharePoint](install-in-sharepoint.md). SharePoint
  lists on that site then appear as data sources.
- For another website or web application, host `DataLaVista.html` on your web
  server and show it in an `iframe`, or add the files the way your platform adds
  custom pages or scripts. The files are in the
  [dist folder on GitHub](https://github.com/DepressionCenter/datalavista/tree/main/dist).

### Your first dashboard

These steps use the sample file `studies.csv` from this website. The same steps
work with your own file.

1. Open the [dashboard designer](../../dist/DataLaVista.html) and select
   **Connect + Load** in the toolbar. The Connect to Data Source popup opens.
2. Select the **Remote Files** tab, paste this address into the file address
   box, and select **Add to Queue**:
   `https://code.depressioncenter.org/datalavista/samples/data/studies.csv`.
   Then select **Connect & Load**. The file appears in the Tables & Fields
   panel on the left.
3. On the **Query** tab, pick the fields you want in the Query Builder, or write
   a query in the SQL Editor. The results preview below shows the table your
   dashboard will use. Check it before you go on.
4. Select the **Design** tab. Add a chart and a table to the canvas, and map a
   field to each one. Add a filter if you want people to narrow the data.
5. Select the **Preview Dashboard** tab. Try the filter and compare a few
   numbers with the results preview from step 3.
6. Select the **Generate Report** tab. Select **Save Local Copy** to download
   the dashboard as a file you can open again later with the **Open Dashboard**
   tab of the Connect to Data Source popup. Inside SharePoint, **Publish to
   SharePoint** saves it to a document library and gives you a link to share.

Two more sample files use the same steps:
[researchers.xml](../../samples/data/researchers.xml) and
[participants.json](../../samples/data/participants.json).

### Conclusion

You can now open DataLaVista, load a file, and go from a query to a shared
dashboard. Read the guide for each step when you want more detail, starting with
[Connect to data](connect-to-data.md).

### Additional resources

- [Help home](../README.md)
- [Install DataLaVista in SharePoint](install-in-sharepoint.md)
- [Connect to data](connect-to-data.md)
- [Build a query](build-a-query.md)
- [Design a dashboard](design-a-dashboard.md)
- [Preview a dashboard](preview-a-dashboard.md)
- [Publish and share a dashboard](publish-and-share.md)
- [Project Health Dashboard demo](../../dist/DataLaVista.html?reportMode=view&report=https://code.depressioncenter.org/datalavista/samples/reports/Project%20Health%20Dashboard.json)
- [DataLaVista files on GitHub](https://github.com/DepressionCenter/datalavista/tree/main/dist)

[Back to help home](../README.md)
