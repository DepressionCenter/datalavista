<!--
This file is part of DataLaVista™
docs/compliance.md
Author(s): Gabriel Mongefranco.
Created: 2026-10-26
Last Modified: 2026-10-26
Summary: Records the security and accessibility controls that exist in the code today, and the known gaps.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Compliance

[Back to project README](../README.md)

This page lists the security and accessibility controls that exist in the code
today, where each one lives, and what is still missing. It is for maintainers,
reviewers, and anyone who must decide whether DataLaVista fits their data. Every
line here can be checked against the current source. Nothing on this page is a
promise about future work, and nothing here is a legal or HIPAA compliance claim.

### Where data goes

DataLaVista runs entirely in the browser. There is no server part. Data you
connect to is read by the page and kept in the page's memory while the tab is
open.

- A saved dashboard file holds the queries, the design, and the names and
  fields of the connected sources. For a file you uploaded, it can also hold the
  rows, so the dashboard can be reopened later.
- A saved dashboard file never holds a bearer token or any other credential.
- A remote file is downloaded by the browser itself. If that fails and you
  agree, one of three public relay services downloads it instead. The relay
  sees the file's address and its contents. See "Remote files" below.

### Security controls in place

| Control | Where | What it does |
| --- | --- | --- |
| No credentials in saved dashboards | `buildConfig` and `loadConfig` in `src/30-config.js` | Saving leaves the bearer token out. Opening a file clears any token found in it and asks the person opening the dashboard for their own. |
| Token sent only to its own site | `spFetch` and `isTrustedSharePointSite` in `src/23-sharepoint.js` | The token is added only to requests whose address has the same origin as the source's site, and only when that site is the SharePoint site the page runs in or a SharePoint Online site over https. Page links that point at another site stop the download. |
| Token asked only for a trusted site | `ensureSharePointToken` in `src/25-data-sources.js` | The popup that asks for a token appears only for a site that passes the check above, and it shows the site address. The token is kept in memory for the page load only. |
| Remote files are never run as script | `fetchWithFallbacks` in `src/25-data-sources.js` | Files are downloaded with `fetch` and parsed as JSON or text. There is no JSONP step and no `eval` or `new Function` anywhere in the application. |
| Relay services only after approval | `_mayUseRelay` in `src/25-data-sources.js` | After both direct downloads fail, a popup names the three relay services and explains what they see. The answer is remembered per destination host for the page load only, in a variable outside the saved state. An address with a query string or sign-in details is never sent to a relay. |
| Remote addresses are checked | `validateURL` in `src/25-data-sources.js` | Only `http` and `https` addresses are allowed, and addresses that point at private network ranges or the local machine are refused. |
| Text widget HTML is cleaned | `sanitizeHTML` and `renderTextWidgetHTML` in `src/60-design.js` | Formatting tags, inline styles, links to web, mail, and phone addresses, and images from web addresses are kept. Scripts, event handlers, `style` elements, `id` attributes, and inline styles that use `expression`, `behavior`, `-moz-binding`, `javascript:`, or fixed positioning are removed. The same cleaner runs in the designer, the preview, and the live edit path. |
| Widget colors and sizes are checked | `loadConfig` in `src/30-config.js`, `_safeCssColor` and `_safeCssNumber` in `src/42-ui-shared.js` | Every color and size read from a dashboard file must have a plain form, such as `#0078d4`, `red`, or `rgb(0, 120, 212)`, or it is reset to the default. The designer and preview check the values again where they build a style attribute. |
| Data values and names are escaped | `_attrEnc` in `src/42-ui-shared.js` | Cell values, column names, titles, and file names are escaped before they are written into the page. |
| Status messages are shown as text | `toast` in `src/42-ui-utils.js` | Messages are set as text, never as HTML, so error text from a file or a server cannot add markup. |
| Question popup inserts text only | `dlvAskDialog` in `src/42-ui-utils.js` | Addresses and names shown in the popup are inserted as text. |

### Remote files

The connect popup accepts a web address for a CSV, JSON, Excel, XML, or SQLite
file. The browser downloads it directly, first without and then with the
browser's own sign-in. Both attempts need the hosting website to allow other
sites to read the file, or the file must be on the same site as the page.

If both attempts fail, DataLaVista offers to try a relay service, also called a
proxy. The popup lists the three services, in the order they are tried, and says
that the relay will see the address and everything in the file. Do not use a
relay for private, confidential, or regulated data. Your answer applies to every
file from that host until you reload the page.

### Accessibility

The target is WCAG 2.2 AA. Evidence in the code today:

- The question popup is marked as a dialog, is labeled by its title, keeps
  keyboard focus inside while open, closes on Escape, and returns focus to
  where it was.
- Status messages appear in a polite live region, so a screen reader announces
  them without interrupting.
- No automated accessibility scan has been recorded for the application yet.

### Known gaps

- Once you approve a relay for a host, the relay receives the address and the
  contents of every file from that host for the rest of the page load.
- The sanitizer keeps inline styles on text widget content. A shared dashboard
  can therefore style its own widget freely, but it cannot cover the page with
  fixed positioning and it cannot add a `style` element.
- There is no automated test suite in the repository. The fixes above were
  checked by hand in a headless browser; see the pull request that added them.
- The page does not set a Content Security Policy of its own. A SharePoint
  tenant's policy applies when the page runs there.
- Any dashboard file shared before October 2026 that was saved with a bearer
  token still contains it. Treat such a file as a disclosed credential and
  revoke the token.

### Review status

| Advisory | Status |
| --- | --- |
| GHSA-jc7x-5p2c-446c, unescaped table values | Fixed on 2026-10-23 |
| GHSA-g48f-jcvp-4r4h, status messages as HTML | Fixed on 2026-10-23 |
| GHSA-qphx-483j-mxrv, bearer token in saved dashboards | Fixed on 2026-10-26 |
| GHSA-vv3p-hxv9-2fmm, remote data run as script and sent to proxies | Fixed on 2026-10-26 |
| GHSA-f5f4-q2rx-6q3h, text widget HTML from a dashboard file | Fixed on 2026-10-26 |

### Conclusion

You can now see which protections the code provides and which it does not.
Before connecting data that is private or regulated, read the "Known gaps"
section and ask your privacy office whether the relay services and the
SharePoint hosting fit your rules.

### Additional resources

- [Project README](../README.md)
- [Repository maintenance](repository-maintenance.md)
- [Security reporting policy](../SECURITY.md)
- [Project instructions](../AGENTS.md)
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)

[Back to project README](../README.md)
