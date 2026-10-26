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
| Remote addresses are checked | `validateURL` in `src/25-data-sources.js` | Only `http` and `https` addresses are allowed. Addresses that point at private network ranges or the local machine are refused. |
| Text widget HTML is cleaned | `sanitizeHTML` and `renderTextWidgetHTML` in `src/60-design.js` | Formatting tags, inline styles, links to web, mail, and phone addresses, and images from web addresses are kept. Scripts, event handlers, `style` elements, and `id` attributes are removed. An inline style that uses `expression`, `behavior`, `-moz-binding`, `javascript:`, or fixed positioning is removed. The same cleaner runs in the designer, the preview, and the live edit path. |
| Widget colors and sizes are checked | `loadConfig` in `src/30-config.js`, `_safeCssColor` and `_safeCssNumber` in `src/42-ui-shared.js` | Every color and size read from a dashboard file must have a plain form, such as `#0078d4`, `red`, or `rgb(0, 120, 212)`. Anything else is reset to the default. The designer and preview check the values again where they build a style attribute. |
| Data values and names are escaped | `_attrEnc` in `src/42-ui-shared.js` | Cell values, column names, titles, and file names are escaped before they are written into the page. |
| Status messages are shown as text | `toast` in `src/42-ui-utils.js` | Messages are set as text, never as HTML. Error text from a file or a server cannot add markup. |
| Question popup inserts text only | `dlvAskDialog` in `src/42-ui-utils.js` | Addresses and names shown in the popup are inserted as text. |

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
  it was.
- Status messages appear in a polite live region, so a screen reader announces
  them without interrupting.
- No automated accessibility scan has been recorded for the application yet.

### Known gaps

- Once you approve a relay for a host, the relay receives the address and the
  contents of every file from that host for the rest of the page load.
- The cleaner keeps inline styles on text widget content. A shared dashboard can
  style its own widget freely. It cannot cover the page with fixed positioning,
  and it cannot add a `style` element.
- The repository has no automated test suite. The controls above were checked by
  hand in a headless browser when they were added.
- The page sets no Content Security Policy of its own. When the page runs in a
  SharePoint tenant, the tenant's policy applies.
- A dashboard file saved with a bearer token before October 2026 still contains
  that token. Treat such a file as a disclosed credential and revoke the token.

### Change history

| Date | Change |
| --- | --- |
| 2026-10-23 | Cell values, column names, and titles are escaped before they are written into the page. |
| 2026-10-23 | Status messages are shown as text instead of HTML. |
| 2026-10-26 | Bearer tokens are left out of saved dashboards and sent only to the source's own site. |
| 2026-10-26 | Remote files are no longer run as script, and relay services need approval. |
| 2026-10-26 | Text widget HTML and widget style values are cleaned before rendering. |

### Conclusion

You now know which protections the code provides and which it does not. Before
you connect private or regulated data, read "Known gaps" and ask your privacy
office whether the relay services and the SharePoint hosting fit your rules.

### Additional resources

- [Project README](../README.md)
- [Repository maintenance](repository-maintenance.md)
- [Security reporting policy](../SECURITY.md)
- [Project instructions](../AGENTS.md)
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)

[Back to project README](../README.md)
