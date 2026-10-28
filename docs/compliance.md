<!--
This file is part of DataLaVista™
docs/compliance.md
Author(s): Gabriel Mongefranco.
Created: 2026-10-26
Last Modified: 2026-10-28
Summary: Records the security and accessibility controls that exist in the code today, and the known gaps.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Compliance

[Back to help home](README.md)

This page lists the security and accessibility controls in the code today. It
names the file that holds each control and the gaps that remain. It is for
maintainers, reviewers, and anyone who must decide whether DataLaVista fits
their data. You can check every line against the current source. This page makes
no promise about future work and no legal or HIPAA compliance claim.

### Data handling

DataLaVista runs entirely in the browser. There is no server part. The page
reads the data you connect to and keeps it in memory while the tab is open.

- A saved dashboard file holds the queries, the design, and the names and
  fields of the connected sources. For a file you uploaded, it can also hold the
  rows, so you can reopen the dashboard later.
- A saved dashboard file never holds a bearer token or any other credential.
- The browser downloads remote files itself. If that fails and you agree, one of
  three public relay services downloads the file instead. The relay sees the
  address and the contents of the file. See "Remote files" below.

### Security controls in place

| Control | Location | Behavior |
| --- | --- | --- |
| No credentials in saved dashboards | `buildConfig` and `loadConfig` in `src/30-config.js` | Saving leaves the bearer token out. Opening a file clears any token in it and asks the person opening the dashboard for their own. |
| Token sent only to its own site | `spFetch` and `isTrustedSharePointSite` in `src/23-sharepoint.js` | The token is added only to requests for the same origin as the source's site. That site must be the SharePoint site the page runs in, or a SharePoint Online site over https. A page link that points at another site stops the download. |
| Token asked only for a trusted site | `ensureSharePointToken` in `src/25-data-sources.js` | The popup that asks for a token appears only for a site that passes the check above. It shows the site address. The token stays in memory for the page load. |
| Remote files are never run as script | `fetchWithFallbacks` in `src/25-data-sources.js` | Files are downloaded with `fetch` and parsed as JSON or text. The application has no JSONP step, no `eval`, and no `new Function`. |
| Relay services only after approval | `_mayUseRelay` in `src/25-data-sources.js` | After both direct downloads fail, a popup names the three relay services and explains what they see. The answer is kept per destination host for the page load, in a variable outside the saved state. An address with a query string or sign-in details is never sent to a relay. |
| Libraries are packed, not downloaded | `src/lib/sha256sums.txt`, `src/before-libraries.js`, `build.sh`, `build.ps1` | Every library the app needs (AlaSQL, ECharts, SheetJS, CodeMirror, lz-string, sql.js) is inside the built script, copied from `src/lib`. The build checks each copy against its recorded checksum and stops on a mismatch. While it runs, the app downloads no scripts and no style sheets, except Google Analytics on `code.depressioncenter.org`. The libraries and their licenses are listed in `THIRD-PARTY-NOTICES.md`. |
| Excel files are read with a fixed parser | `src/lib/sha256sums.txt`, `loadExcelFile` in `src/26-cyberdyne-pipeline.js` | Excel files are read with SheetJS 0.20.3, which fixes CVE-2023-30533 and CVE-2024-22363. The copy is packed into the built script, and the build refuses to run if it does not match its recorded checksum. |
| Remote addresses are checked | `validateURL` in `src/25-data-sources.js` | Only `http` and `https` addresses are allowed. Addresses that point at private network ranges or the local machine are refused. |
| Text widget HTML is cleaned | `sanitizeHTML` and `renderTextWidgetHTML` in `src/60-design.js` | Formatting tags, inline styles, links to web, mail, and phone addresses, and images from web addresses are kept. Scripts, event handlers, `style` elements, and `id` attributes are removed. An inline style that uses `expression`, `behavior`, `-moz-binding`, `javascript:`, or fixed positioning is removed. The same cleaner runs in the designer, the preview, and the live edit path. |
| Widget colors and sizes are checked | `loadConfig` in `src/30-config.js`, `_safeCssColor` and `_safeCssNumber` in `src/42-ui-shared.js` | Every color and size read from a dashboard file must have a plain form, such as `#0078d4`, `red`, or `rgb(0, 120, 212)`. Anything else is reset to the default. The designer and preview check the values again where they build a style attribute. |
| Data values and names are escaped | `_attrEnc` in `src/42-ui-shared.js` | Cell values, column names, titles, and file names are escaped before they are written into the page. |
| Status messages are shown as text | `toast` in `src/42-ui-utils.js` | Messages are set as text, never as HTML. Error text from a file or a server cannot add markup. |
| Question popup inserts text only | `dlvAskDialog` in `src/42-ui-utils.js` | Addresses and names shown in the popup are inserted as text. |
| Manual copying keeps text on the page | `copyTextWithFallback` in `src/42-ui-utils.js` | Copy buttons try the browser's clipboard feature, then its older copy command, which uses a hidden text box that is removed right away. If both fail, a read-only text area in a popup shows the text for manual copying. The text is cleared when the popup closes. |

### Remote files

The connect popup accepts a web address for a CSV, JSON, Excel, XML, or SQLite
file. The browser downloads it directly, first without and then with the
browser's own sign-in. Both attempts need the hosting website to allow other
sites to read the file. A file on the same site as the page always works.

If both attempts fail, DataLaVista offers to try a relay service, also called a
proxy. The popup lists the three services in the order they are tried. It says
that the relay will see the address and everything in the file. Do not use a
relay for private, confidential, or regulated data. Your answer applies to every
file from that host until you reload the page.

### Accessibility

The target is WCAG 2.2 AA. The code today provides this evidence:

- The question popup is marked as a dialog and is labeled by its title. It keeps
  keyboard focus inside while open, closes on Escape, and returns focus to where
  it was. When copying fails, the popup focuses and selects the text to copy.
- The four tabs at the top of the Connect to Data Source popup are a tab list.
  Press Tab to reach the selected tab, use the arrow keys, Home, or End to move
  between the available tabs, and press Enter or Space to open one. A screen
  reader announces which tab is selected. Outside SharePoint, the SharePoint
  Lists tab is announced as unavailable and can't be opened.
- Status messages appear in a polite live region, so a screen reader announces
  them without interrupting.
- The automated tests check the arrow key, Home, and End steps above on every
  pull request. No automated accessibility scan has been recorded for the
  application yet.

### Known gaps

- Once you approve a relay for a host, the relay receives the address and the
  contents of every file from that host for the rest of the page load.
- The cleaner keeps inline styles on text widget content. A shared dashboard can
  style its own widget freely. It cannot cover the page with fixed positioning,
  and it cannot add a `style` element.
- The automated tests cover only some of the controls above: the trusted site
  check, the color check, and the escaping of data values. The others were
  checked by hand in a headless browser when they were added.
- The page sets no Content Security Policy of its own. When the page runs in a
  SharePoint tenant, the tenant's policy applies. The built script loads nothing
  from other sites, so a policy that allows only scripts from the site itself is
  enough. Loading the script from the site's Site Assets library has not yet been
  confirmed in a tenant with that policy.
- The website at `code.depressioncenter.org` uses a custom domain set at the
  organization level, and HTTPS is not enforced for it, so a plain `http`
  address of the site is not redirected. The SharePoint install guide tells
  people to download `dist/datalavista.js` from GitHub, which is served over
  HTTPS, rather than from the website.

### Hosting of the website

The website, the help pages, and the demo are published by the publish workflow
in `.github/workflows/publish.yml` from a GitHub Actions run, with the
repository's Pages source set to "GitHub Actions". The help pages are generated
from `docs/` on every run and are never stored in git; only `dist/` is committed.
The landing page, the help pages, and the app load Google Analytics only when
they are served from `code.depressioncenter.org`; a local preview or a copy on
another site sends nothing to Google. The landing page and the 404 page load
their font families from Google, and the help pages load nothing else from
other sites. The [Repository maintenance](repository-maintenance.md) page
describes the run.

### Conclusion

You now know which protections the code provides and which it does not. Before
you connect private or regulated data, read "Known gaps" and ask your privacy
office whether the relay services and the SharePoint hosting fit your rules.

### Additional resources

- [Help home](README.md)
- [Project README](../README.md)
- [Repository maintenance](repository-maintenance.md)
- [Security reporting policy](../SECURITY.md)
- [Project instructions](../AGENTS.md)
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)

[Back to help home](README.md)
