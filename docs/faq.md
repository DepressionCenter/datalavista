<!--
This file is part of DataLaVista™
docs/faq.md
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-10-28
Last Modified: 2026-10-28
Summary: Answers the questions people ask most about what DataLaVista is for, its limits, and where data goes.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Frequently asked questions

[Back to help home](README.md)

This page answers the questions people ask most often about DataLaVista. It is
for anyone deciding whether to use it or wondering why something works the way
it does. For a problem with a specific error or symptom, see
[Troubleshooting](troubleshooting.md).

### Does DataLaVista cost anything?

No. DataLaVista is free, open source software under the GNU General Public
License, version 3 or later. You can use it, share it, and change it under
those terms. The [project README](../README.md) has the full license and
credits.

### Where does my data go?

Usually nowhere new. DataLaVista runs in your browser, reads data from the
places it already lives, and processes it on your computer. It has no server of
its own, and a dashboard you publish to SharePoint stays in your SharePoint
site. There are two exceptions:

- A file you load with the Upload Files tab is saved inside the report
  configuration, so anyone you share that file with gets a copy of the data.
- When a file on another website cannot be downloaded directly, DataLaVista
  asks whether it may use a relay service and names the services it would use.
  If you say yes, the relay receives the file's address and downloads the whole
  file, and the answer applies to every file from that website until you
  reload the page. Do not approve a relay for confidential or regulated data.
  Put the file in a document library on your own SharePoint site instead,
  which needs no relay.

The [Compliance](compliance.md) page lists the protections in the code and the
known gaps.

### Does DataLaVista replace Power BI, Tableau, or other BI tools?

Not fully, and it does not try to. It is made to be quick to set up and easy to
use, which makes it a good fit for smaller reports, one-time analyses, data
exploration, and reporting on SharePoint lists, which many heavier tools handle
poorly. For large data sets, scheduled refreshes, or company-wide reporting,
a server-based tool is still the better choice.

### Why is my dashboard slow?

All the work happens in the viewer's browser, so speed depends on the viewer's
computer and on how much data the dashboard loads. On the Query tab, remove the
fields you do not need and filter out the rows you do not need before you
design. Preview early and often, and keep the number of widgets reasonable.

### Can DataLaVista connect to a database on our network?

Not directly. A browser cannot open a connection to SQL Server, Oracle, or a
similar database, because that would need drivers, network access, and
sign-in that browsers do not allow. Export the data to a CSV, Excel, JSON, XML,
or SQLite file, or load it into a SharePoint list, and connect to that. A
future release may add a relay through a server-side service, which would need
a server or a hosted application to run it.

### Why does a file on another website fail to load?

The website that hosts the file must allow other sites to read it. Browsers
block the download otherwise, which shows up as a blank result or a message
about the file. A file in a document library on your own SharePoint site always
works, so moving the file there is the simplest fix. See
[Troubleshooting](troubleshooting.md) for the other causes.

### Which file types can I load?

CSV, JSON, XML, Excel (`.xlsx` and `.xls`), and SQLite (`.sqlite` and `.db`).
Inside a SharePoint site, you can also connect to the site's lists. The
[Connect to data](how-to/connect-to-data.md) guide has the details.

### Where do I get the latest version?

The built files are in the [dist folder on GitHub](https://github.com/DepressionCenter/datalavista/tree/main/dist),
and each [release](https://github.com/DepressionCenter/datalavista/releases)
lists the same files for download. The
[SharePoint install guide](how-to/install-in-sharepoint.md) explains how to
update a site.

### How do I cite DataLaVista?

Mongefranco, Gabriel; Gluskin, Jeremy; Boa, Shelley (2026). DataLaVista™.
University of Michigan. Software.
[https://doi.org/10.5281/zenodo.19245606](https://doi.org/10.5281/zenodo.19245606)

### Conclusion

If your question is not here, the guides on the [help home](README.md) cover
each step in more detail, and the
[issue tracker on GitHub](https://github.com/DepressionCenter/datalavista/issues)
is the place to ask something new.

### Additional resources

- [Help home](README.md)
- [Troubleshooting](troubleshooting.md)
- [Connect to data](how-to/connect-to-data.md)
- [Compliance](compliance.md)
- [Project README](../README.md)
- [DataLaVista releases on GitHub](https://github.com/DepressionCenter/datalavista/releases)
- [DataLaVista issue tracker](https://github.com/DepressionCenter/datalavista/issues)

[Back to help home](README.md)
