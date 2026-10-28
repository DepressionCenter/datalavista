<!--
This file is part of DataLaVista™
docs/how-to/install-in-sharepoint.md
Author(s): Gabriel Mongefranco.
Created: 2026-10-27
Last Modified: 2026-10-27
Summary: Explains how to add DataLaVista to a SharePoint Online site, update it, and fix a page that does not start.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

Licensed under the GNU Free Documentation License v1.3 or later.
See <https://www.gnu.org/licenses/fdl-1.3.html>. See README for full license information.
-->

# DataLaVista™

## Install DataLaVista in SharePoint

[Back to project README](../../README.md)

This page explains how to add DataLaVista to a SharePoint Online site, how to
update it later, and what to do when the page does not start. It is for site
owners who can add files to the site's Site Assets library and create pages.
You need no developer tools, only the two files from the `dist` folder.

### Before you start

- A SharePoint Online site where you can create pages and add files to the
  Site Assets library.
- The Modern Script Editor web part. If it is not available on your site, ask
  your site administrator to install it. The link is under "Additional resources".
- The `dist` folder of this repository. On the repository's GitHub page, select
  **Code**, then **Download ZIP**, and unzip the file.

### Files you need

| File | What you do with it | What it is |
| --- | --- | --- |
| `dist/datalavista.js` | Upload it to Site Assets. | The DataLaVista app with every library it needs packed inside. |
| `dist/DataLaVista-sp.html.txt` | Copy its contents into the web part. | Two lines of page code that show the app and load the script. |

Because every library is inside `datalavista.js`, the page loads nothing from
other websites. A tenant policy that allows only scripts from the site itself is
enough. `docs/compliance.md` lists what remains to be confirmed in a tenant with
that policy.

### Install

1. Open your site's Site Assets library. Go to **Settings**, then
   **Site contents**, then **Site Assets**.
2. Upload `dist/datalavista.js` to the top level of the library, not into a
   folder.
3. Go to the site's home page and select **New**, then **Page**. Choose the
   **Modern Script Editor** template.
4. Name the page `DataLaVista`. Its address then ends in
   `/SitePages/DataLaVista.aspx`, such as
   `https://contoso.sharepoint.com/sites/example/SitePages/DataLaVista.aspx`.
   Keep the page in Site Pages itself, not in a folder inside it. The page code
   finds the script at `../SiteAssets/datalavista.js`, which only works from there.
   The list formatting in `src/sp-view-formatting.json` also links to that address.
5. In the Modern Script Editor web part, select **Markup**, then the **{ }**
   button to open the code editor.
6. Open `dist/DataLaVista-sp.html.txt` in a text editor, copy everything in it,
   and paste it into the code editor. After a comment with these steps, it looks
   like this:

   ```html
   <div id="dlv-root"></div>
   <script src="../SiteAssets/datalavista.js"></script>
   ```

7. Select **Save** in the code editor, then **Save** on the page to leave edit
   mode.
8. Refresh the page. The Connect to Data Source popup opens with your site's
   address filled in.

### Update to a newer version

1. Download the latest `dist` folder from GitHub.
2. Upload the new `dist/datalavista.js` to Site Assets, replacing the old one.
3. Refresh the DataLaVista page. If the old version still shows, press Ctrl+F5
   to reload without the browser's saved copy.

You do not need to change the page unless a release says so.

### If the page does not start

DataLaVista writes a message into the page when it cannot start. Each message
says what to do next.

- **"DataLaVista could not start because its built-in ... library did not load."**
  Another script on the page kept a library from loading. Remove other code from
  the page's web parts and refresh. If it happens again, ask your site
  administrator and mention the errors in the browser console.
- **The page stays blank.** Open the browser console (F12). If it says the script
  could not be found, check that `datalavista.js` is at the top level of Site
  Assets and that the page is directly in Site Pages. If it says the script was
  blocked, ask your SharePoint administrator whether the tenant's content
  security policy allows scripts from the site's own Site Assets library.
- **"DataLaVista could not find \<div id="dlv-root"\>"** in the console. The
  web part code was not pasted in full. Paste the whole contents of
  `dist/DataLaVista-sp.html.txt` again.

### Conclusion

You can now add DataLaVista to a site with one uploaded file and one pasted
snippet, and replace the file to update it. Next, connect a SharePoint list or a
data file from the Connect to Data Source popup, as the README describes.

### Additional resources

- [Project README](../../README.md)
- [Documentation index](../README.md)
- [Compliance](../compliance.md)
- [DataLaVista knowledge base article](https://teamdynamix.umich.edu/TDClient/210/DepressionCenter/KB/ArticleDet?ID=15179)
- [Modern Script Editor web part](https://github.com/pnp/sp-dev-fx-webparts/tree/main/samples/react-script-editor)

[Back to project README](../../README.md)
