<!--
This file is part of DataLaVista
AI Code Generation Prompts
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-03-10
Last Modified: 2026-03-20
Summary: DataLaVista is a ightweight, client-side reporting and dashboard toolkit.
Notes: See README file for documentation and full license information.

Copyright © 2026 The Regents of the University of Michigan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
You should have received a copy of the GNU General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.

-->
![Eisenberg Family Depression Center](https://github.com/DepressionCenter/.github/blob/main/images/EFDCLogo_375w.png "depressioncenter.org")

```text

       /|____________|\
      ||  /--------\  ||    ___       _          _            _    _ _     _
      ||_|__________| ||   |   \ __ _| |_ __ _  | |   __ _  | \  / (_) ___| |_ __  
      ||              ||   | |) / _` |  _/ _` | | |__/ _` |  \ \/ /| (_-<  _/ _` |
      | \____________/ |   |___/\__,_|\__\__,_| |____\__,_|   \__/ |_/__/\__\__,_|
       \  |_|_|_|_|  / 
        \___________/         🕶️ "The BI Terminator" 🕶️
```

# 🕶️ Data La Vista
***🕶️ Tell your expensive BI tools: "Data la vista, baby!"***

## Description
This is a generative AI prompt that was fine-tuned after many tries to produce the initial proof-of-concept version of DataLaVista. It was ran through multiple AI tools including Gemini, Claude, ChatGPT and others, then the code was merged.

## AI Prompts
<code>
Act as an Expert and Creative Frontend Architect and SharePoint Data Engineer.
 
Your task is to generate a single-file web application that can be embedded into other javascript/html applications (like in iframes), and in particular inside a "Modern Script Editor" webpart in SharePoint Online Pages. This web application is a lightweight, fast, and especially clean and easy to use dashboard and report designer, that can be used instead of power bi and tableau.
 
### Features, suggested libraries, and styling
- **Data Engine:** AlaSQL (v4.1.0 or higher) or another fast javascript-based engine
- **Visualizations:** Apache ECharts (v5.5.0 or higher) and/or 3djs (as long as it's very lightweight)
- **Code Editor:** CodeMirror (v5.65.13 or higher), or another open source code editor that supports sql, that can provide code completion/suggestions, color syntax hilighting, and allow addint SQL keywords present in asql but not sql without breaking the core hilighting and suggestion features.
- **Styling:** Vanilla CSS utilizing CSS variables for a Microsoft Fluent-inspired theme (`--primary: #0078d4`, `--bg: #faf9f8`, `--border: #edebe9`), yet support future themeing capabilities (so that for example, I can try using umich colors later).

### Overall Architecture
Th designer will be a single HTML file that can be embedded into iframes, other html/javascript apps, and especially inside a "Modern Script Editor" webpart inside SharePoint Online.
The designer should be able to load SharePoint lists (structure and items), excel/csv files stored in sharepoint libraries, and custom REST APIs that provide some kind of standard method to retrieve structure. SharePoint list item support must take priority in the initial version, but there should be support for other data sources.
The designer should be able to generate fully-working, stand-alone code for viewing the reports live and exporting the underlying data to CSV. The code will be pasted into separate HTML files by the user, in whatever place they choose to host the reports, or even just locally.
The designer should be able to generate a complete configuration in JSON that includes the SQL query, data source config, etc., so that users can save it and load that config at a later time to modify an existing report.
If possible - though not built in the initial version - there should be support for later using Lua instead of sql and to create formulas for calculated fields.


### Interface
#### Connect and Load
The first thing the user should see is an HTML-based popup (not a new window) to either load a data source or load an existing report config. The popup should not block clicks in other places of the page because that would block the page Save button in sharepoint. In this popup, there should be a text box to enter the URL of the SharePoint site to use, or the location of the excel/csv file in a sharepoint library, or the URL to a REST service, or the URL to a specific JSON file containing data only. Since this is written primarily to embed inside sharepoint pages, it should pre-populate the box (on page load) with the URL of the sharepoint site the user is in ( perhaps via `_spPageContextInfo.webAbsoluteUrl` and/or URL regex parsing). E.g.: if the user is viewing it through "https://umhealth.sharepoint.com/sites/DepressionCenter-TrackMaster/SitePages/datalavista.aspx" then the default URL for loading data would be "https://umhealth.sharepoint.com/sites/DepressionCenter-TrackMaster" making sure to include the /sites/... if present instead of simply going to the root.

When users click the "Connect & Load" button, it should connect to the data source specified in the text box or in the data source in the loaded report file, retrieve all table/list structures, and display "Loaded x tables".
The connect & load button, when using sharepoint lists, fetch all list available in the site using the SharePoint REST API (`/_api/web/lists`). It must handle unpredictable JSON shapes via a universal extractor (checking `.value`, `.d.results`, `.d`, or raw array). However, skip any hidden and system lists, bringing only custom lists. The only exception is the Events list if there is one - always bring that in even if it is not a custom list.
Of note, since this will initially be used inside sharepoint, it can just connect without prompting a login since the user is already authenticated.
When loading SharePoint Lists, as mentioned, always pull the structure of  the list including fields, sizes, field types, and alias/display name.

When loading SharePoint Lists, keep track of the internal list/field name, and alias/displayname retrieved by sharepoint. If there is an alias/display name, then automatically use that instead of the internal field name as long as it doesn't conflict with other field internal names. Automatically remove spaces from field names / aliases, and change them to camel case.

When loading SharePoint Lists, do not load hidden fields, nor fields that start with an underscore, nor the following family of fields: item child count, child item, attachments, color tag, item is a record, label applied by, label setting, Edit, ItemChildCount, FolderChildCount, Attachments, MetaInfo, 'DocIcon', 'AppAuthor', 'AppEditor'. The exception is for fields called "_SysValue" or "_SysVersion", which should be loaded as text strings. Also skip sharepoint list columns of HTML type, except for the Comments field if any.

When loading SharePoint Lists, automatically generate ID fields for looup columns (for example, if Teams has a lookup called TeamLead that points to People, then automatically add TeamLeadId for the ID of the lookup, and use the lookup value as the value for the non-id field). In the case of multi-select lookup fields, treat them like other arrays and separate the id and value underneath but also provide a field for a CSV of the values. Sharepoint enterprise keywords (field named "TaxKeyword" or custom fields of enterprise keyword/term store type) operate the same but should be parsed appropriately to bring the wssid as the ID and the actual text value as the value.

The initial version doesn't need to support REST services, Excel files, Dropbox CSV/excel, OneDrive CSV/excel, Google Drive excel/google sheets/csv, nor SharePoint Excel files, but the code should be written to allow plugging in those adapters later. The initial version msut definetely, absolutely support loading sharepoint lists (by querying all lists available to get their structure), as well as JSON data in a specific URL, and CSV files stored in sharepoint document libraries.
Once connected to the data source and successfully loading the table structure, the user will see the main window and the popup closes.
The main screen will be tab-based with small tabs at the bottom. The first tab is for Query, the second is for Design, the third is for Preview, and the last is for Generate Report.

#### Tab 1: Query
The query tab will include a panel on the left with a list of tables and fields that were loaded, and two horizontally-stacked panels (2/3 height and 1/3 height) for a query builder and a SQL code editor. The query builder should be toggable between a basic and an advaned view.

*** Fields Panel ***
Tables can be expanded in the list to show fields (each with an icon representing the data type, which would default to string if no type is detected). If a field is an array (or a multi-select People, Lookup or Choice field from SharePoint), then automatically add a CSV version of the field that contains the comma-separated values, but also allow the field to be expanded to show the available elements like ID and Value. Be careful of not getting "[Object object]" errors but actually parsing those fields if possible (or displaying the JSON as the value if parsing is not possible).

Tables can be dragged onto the query builder, which would add them to the query diagram when in advanced view. In basic view, dragging tables would add the table name and checkboxes below to select which fields to bring, what aggregates, and what filters to add. The basic version should be very, very simple, and designed to be used with a single table at a time. Fields can also be dragged, and that will cause the table to be added if it isn't already, and for the field to be selected for that table. Dragging tables and fields should work in both advanced and basic views.

Tables can be dragged onto the SQL query code editor, which should automatically generate a select query listing all fields if the query editor is blank. If the query editor is not blank, dragging and dropping tables or fields would simply type their name at the location in the text where they are dragged.

When parsing SharePoint Lists, and going over choice fields, try to use the actual values instead fo the IDs.

There should be a query designer on the top (occupying 2/3s of the height) with two toggable tabs/sections, Basic and Advanced, with Basic being visible by default. Advanced allows dragging and dropping tables and joining them, with options that open underneath upon selection of (click on) a table or a join line. The tables should be movable so users can rearrange their diagram if desired. Basic allows dropping one table at a time only, and it displays a list of fields in that table with checkboxes to select which fields to bring, what aggregates, and what filters to add.

When adding a table, the "Id" (or singular name of table plus Id such as Teams.TeamId) will be autoselected. For SharePoint lists, the Title will also always be auto selected by default (Title will always be internal name but the alias in shrepoint may be different).

When adding a table, the first 5,000 items will be quietly fetched in the background, without blocking other tasks, and cached. Removing a table should be allowed but the cached data should remain in case the user adds the table again.

When clicking tables, the options will include selecting which fields to retrieve, what alias to use for each field, and what aggregate to use if desired, what filter is desired. For filters, be sure to allow filtering by aggregates (e.g. count(distinct childid)>2 or max(value) <1 or min(value)>=0 or average(value)=5 or median(value)=5 ). There should also be an option to simplify the precision of a field, for example, rounding to integers for numeric fields or rounding date/time fields to date only, year only, and month only. There should also be an area to allow filtering each field in the table, either by adding a value or range of values. For date fields, show date pickers but also give the option to select common time frames used in business such as fiscal years (July to June), academic years (August to July), calendar years (January to December), Last year, Last fiscal year, last academic year, This year, This fiscal year, This academic year, this month, this week, this business week (Mon-Fri), last month, last week, last business week, year to date, fiscal year to date, and academic year to date.

Table column properties should also have an "Advanced" section with an option to add custom fields as SQL expressions as long as those expressions only use fields from the same table or aggregates of joined tables, but be sure not to allow sub queries. It should also have grouping by options under the Advanced section.
Each table should have a property to alias the table.
Each table should have a snap point on all sides that can be dragged to another table to create a join in the shape of a line.
Above all, make sure the table and column properties are very, very user friendly and they won't scare non-technical users away. This friendliness and ease of use requirement takes prescedence over the features outlined for table and column properties and filters.

When clicking a join line, the properties should include a dropdown of fields to select the keys to create a join, defaulting to columns just named Id. However, be smart enough to detect that if a table has a child element named the same as the table being joined plus "Id" (e.g. TeamId), then you know to link that to the ID of the parent table by default (e.g. the link between People and Team would be from People.TeamId to Team.Id, not People.Id to Team.Id). But also be smart enough to know that sometimes, tables don't contain an ID field but instead something with the singular name of the table plus id (e.g. a table called Teams may contain TeamId instead of Team); note however that SharePoint lists always, always have an ID and Title fields. It is absolutely vital that you keep the join interface and options as simple and user friendly as possible, or it will scare non-technical users away. Also make sure the tables are separate from the fields instad of being one big table filled with fields, because I don't want it to look like access nor intimidating in anyway.

The query builder must have the option to be collapsed (or hidden) to give more room for the other options.

Anytime a change is made in the query builder, whether basic or advanced, a corresponding SQL expression is generated/re-generated and placed in the SQL code editor in the bottom 1/3rd of the tab. Changing the SQL expression manually doesn't update the basic/advanced query builders, but it locks them.

The SQL code editor must have syntax hilighting for standard SQL keywords plus alasql keywords that are not already part of the standard SQL. It must also have suggestions and auto complete using SQL keywords, alasql keywords that are not already part of standard SQL, and all the tables loaded (using their aliases not internal table names when possible). Each table should also present auto suggestions and auto complete using the fields retrieved for that table (again, using aliases not internal names when possible). The adding of keywords to suggestions should in no way break the syntax highlighting - both suggestions with custom keywords/tables/fields and syntax hilighting must work fine concurrently.

The code editor must have a "Run Query" button.
When clicked, the Run Query button creates temporary AlaSQL tables, fetches the top 5000 items from the referenced SharePoint lists with all fields and caches them (or gets them from cache if already there), normalizes the data, executes the SQL, and displays an HTML table preview of the top 20 results.

The run query button will show a preview table of the results in the bottom, as a new panel that can be closed. When the preview (table) panel is shown upon clicking "Run Query", the quuery builder should be resized to 1/3rd of available height (and keep it collapsed if currently collapsed by the user). When the preview (table) panel is closed, the query builder should go back to 2/3rd of available height (but remain collapsed if currently collapsed by the user).





#### Tab 2: Design

The design tab should have the following:
- **Fields Panel:** Draggable fields generated from the SQL query results. This panel should be in the far right, and should be collapsible. Since the fields are coming from the SQL query result, the user is working off a flat table.
- **Title Bar:** Horizontal bar to show a report title, that only accepts a text box widget. When in the Design tab, this bar should always show, but when in Preview or when rendering the final report, it should only be visible if it actually contains any widgets. It should be to the right of the fields panel, and above the filter bar, and be the same width as the canvas.
- **Filter Bar:** Horizontal bar that will show report-level filters. It should be to the right of the fields panel and above the canvas, and its width should be the same as the canvas width.
- **Canvas:** Uses a fluid flex grid. The canvas area should be to the right of the fields panel, take up most of the screen, but leave room for a filter bar above it. Users drop visuals onto the canvas. Dropped visuals (widgets) will be about 40% of the canvas width and height in height by default. Users can drag these widgets to reorder them (handled via array splicing or another efficient method), and can also delete them. Users can also drag tables and fields onto the canvas, which would automatically create a table visual for that table (with all fields of the table was dragged, or just the single field dragged if a field was dragged). Widgets should always be spaced at least 4px apart (so 2px padding all around).
- **Toolbox:** Draggable widget types (Table, Bar, Line, Pie, Scatter Plot, KPI Card, Text Box, Blank Placeholder are required; Image, and any other commonly-used visuals in business and clinical reports that are available in apache echarts should be added if possible but is not required). If it is possible to create word clouds easily and without slowing down the whole application, then also include a word cloud widget type. The toolbox should be in a panel to the right of the canvas.
- **Properties:** Fields to configure the visual currently selected, displayed in the same panel as the toolbox but under the draggable widget icons. When a widget is clicked, allow editing of:
  - Title, Visual Type, Width (%), Height (vh).
  - Image-specific properties such as Image URL and any effects or CSS properties that could be useful for dashboards.
  - Fill Color, Border Color, Border Size (px).
  - Font Size, Font Color (for Text widgets) or Font Color (for word cloud widgets, if they are possible)
  - Dynamic Fields: Assign fields to X/Y axes or table columns, with an Aggregation dropdown (None, COUNT, COUNT(DISTINCT), SUM, AVG, MEDIAN, MINDATE, MAXDATE, FIRST, LAST, STDEV, VAR). Users should be able to drag and drop fields on this area to add more fields. Fields should be able to be moved/swapped around.
  - Filters: Add interactive dropdown filters mapped to specific fields. The filters should have a menu with options to Show Above Visual, Show on Filter Bar, or Hide (which would only show it in the properties). Users should be able to drag and drop fields into this area to add more filters.

#### Tab 3: Preview
This tab would display the report like the canvas, but without allowing editing. This should be creating a report renderer connected to the specified data source. Whatever renders in this view is exactly what will be shown to the users when they look at the report/dashboard. When loading, this would find all the lists/tables needed by the SQL query, and load all rows for those lists, then replace the 5,000 item cache with all the rows (if the cache exists). Then, it should process the sql queries from the cached data. Be sure that the loading process takes into account aliases, special rules etc that were described for the other tabs.

#### Tab 4: Generate Report
This tab would have a button to generate the report code, and a large textarea with HTML+JavaScript hilighting. When the button is clicked, it should put in the textarea all the HTML, java script, data source URL, source settings, canvas and widget properties, filters etc. that are needed to make the report a stand-alone web app. A second button that is enabled only after generating the code should be available for copying to the clipboard, and a third button to download the contents of that textarea as an HTML file. There should also be a second textarea that will contain all the settings, in JSON format, to be able to recreate the connection, sql, and report. This will have the buttons to copy report definition to clipboard, and to download report definition which would download the JSON as a JSON file.



### Other Requirements and Caveats
- Visuals should allow being converted from one type to another, and the properties should transfer intelligently to the right set of properties of the new widget.
- Ideally, the JSON needed to re-populate the sql and canvas and report design should be the same JSON that is used by the report renderer.
- The JSON must include a specific `_license` string as the very first key.
- The code generated for the stand-alone report should include a GPL license on the top in HTML comments, and also contain the _license key in json.
- The JSON config must also include the URL(s) for the data source(s), the lists/tables used in the query with a list of all available fields (not just the fields used in the query), the sql query, all report/dashboard settings, all visuals and their configuration, etc.
- The report renderer used by both the preview and stand-alone report re-implements the SharePoint data fetching, normalization, and AlaSQL execution. It also re-implements the exact same flex-grid DOM structure and visual UI rendering engine.
- Filters must render interactively, updating the visual using `alasql` mini-queries when changed.
- The final report should include a button to "Download as CSV" (probably in the filters bar?) that would download the results of the SQL query as CSV. Anytime the Download as CSV button is clicked, the full row data should be retrievevd if not already cached (so not just the first 5,000 rows), so that the SQL query joins and filters operate correctly.



### STRICT DATA LOGIC & ARCHITECTURAL REQUIRMENTS
You must implement the following specific workarounds and logic engines in BOTH the report builder code and the report rendering engine:
 
1. **SharePoint Complex Object Normalization:**
   - Loop through SharePoint data rows. If a field is an object or array (e.g., `TaxKeyword`), extract the `.Label`, `.Title`, or `.Name`, and join arrays into a comma-separated string.
2. **SharePoint Date Normalization:**
   - Detect ISO date strings (`YYYY-MM-DDTHH:mm:ssZ`) via regex and strip the `T` and `Z`. Truncate `00:00:00` times to just the date.
 
3. **Custom AlaSQL Aggregators:**
   - Register custom `MAXDATE` and `MINDATE` aggregators in AlaSQL to handle string-based date comparisons safely.
   - Run a regex `.replace()` on the raw SQL query to secretly swap `MIN()` and `MAX()` for `MINDATE()` and `MAXDATE()`.
   - Override the native AlaSQL `SUM` aggregator using `parseFloat(v) || 0` to prevent string concatenation if users run SUM on a text/CSV field.
 
5. **ECharts Dimensional Stability:**
   - Every EChart must be instantiated on an explicitly created inner `div` with `width: 100%; height: 100%; min-height: 200px;` appended inside the widget's content area, or the charts will collapse to 0 pixels.
   - Attach a window resize event listener to trigger `myChart.resize()` on all chart instances.
 

Output the full, complete code for this web app in a file called `DataLaVista.html`. Do not omit any CSS or JS sections.
</code>
