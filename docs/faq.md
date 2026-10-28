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
for anyone deciding whether to use it, or wondering why something works the way
it does. If something is not working, see [Troubleshooting](troubleshooting.md).

### Does DataLaVista cost anything?

No. DataLaVista is free. Anyone can use it, share it, and change it, under the
terms of the GNU General Public License. The [project README](../README.md)
has the full license text and the credits.

### Where does my data go?

Usually nowhere new. DataLaVista works inside your web browser. It reads your
data from where it already is, such as a SharePoint list or a file, and does
all its work on your own computer. DataLaVista has no server of its own. A
dashboard you publish to SharePoint stays in your SharePoint site.

There are two cases where data does move:

- A file you upload from your computer is saved inside the dashboard file. If
  you share that dashboard file, the other person gets a copy of your data too.
- A file on another website sometimes cannot be opened directly. DataLaVista
  then asks whether it may fetch the file through a relay. A relay is a public
  service on the internet that downloads the file and passes it on. If you say
  yes, the relay sees the file's address and its whole contents, and your yes
  applies to every file from that website until you reload the page. Never say
  yes for confidential or regulated data. Instead, put the file in a document
  library on your own SharePoint site, which never needs a relay.

The [Compliance](compliance.md) page lists the protections in DataLaVista and
what they do not cover.

### Does DataLaVista replace Power BI, Tableau, or other BI tools?

Not fully, and it does not try to. DataLaVista is quick to set up and easy to
use. That makes it a good fit for smaller reports, one-time questions, a first
look at new data, and reports on SharePoint lists, which the bigger tools often
handle poorly. For very large data, reports that refresh on a schedule, or
reporting for a whole organization, one of the bigger tools is still the
better choice.

### Why is my dashboard slow?

All the work happens in the browser of the person looking at the dashboard.
Speed depends on their computer and on how much data the dashboard loads. On
the Query tab, keep only the fields you need and filter out the rows you do not
need. Fewer charts and tables on one dashboard also helps.

### Can DataLaVista connect to a database on our network?

Not directly. A web browser is not allowed to open a connection to a database
such as SQL Server or Oracle. Export the data to a CSV, Excel, JSON, XML, or
SQLite file, or load it into a SharePoint list, and connect DataLaVista to that
instead. A future version may add a way to reach a database through a service
that your IT team would have to run.

### Why does a file on another website fail to load?

The website that holds the file has to allow other websites to read it. If it
does not, your browser blocks the download, and you see an empty result or a
message about the file. The simplest fix is to put the file in a document
library on your own SharePoint site, which always works. See
[Troubleshooting](troubleshooting.md) for other causes.

### Which file types can I load?

CSV, JSON, XML, Excel (`.xlsx` and `.xls`), and SQLite (`.sqlite` and `.db`)
files. Inside a SharePoint site, you can also connect to the site's lists. The
[Connect to data](how-to/connect-to-data.md) guide has the details.

### Where do I get the latest version?

Download the files from the [dist folder on GitHub](https://github.com/DepressionCenter/datalavista/tree/main/dist).
Each [release](https://github.com/DepressionCenter/datalavista/releases) on
GitHub offers the same files. The
[SharePoint install guide](how-to/install-in-sharepoint.md) explains how to
update a SharePoint site to a newer version.

### How do I cite DataLaVista?

Mongefranco, Gabriel; Gluskin, Jeremy; Boa, Shelley (2026). DataLaVista™.
University of Michigan. Software.
[https://doi.org/10.5281/zenodo.19245606](https://doi.org/10.5281/zenodo.19245606)

### Conclusion

If your question is not here, the guides on the [help home](README.md) explain
each step in more detail. To ask something new, open an issue on
[GitHub](https://github.com/DepressionCenter/datalavista/issues).

### Additional resources

- [Help home](README.md)
- [Troubleshooting](troubleshooting.md)
- [Connect to data](how-to/connect-to-data.md)
- [Compliance](compliance.md)
- [Project README](../README.md)
- [DataLaVista releases on GitHub](https://github.com/DepressionCenter/datalavista/releases)
- [DataLaVista issue tracker](https://github.com/DepressionCenter/datalavista/issues)

[Back to help home](README.md)
