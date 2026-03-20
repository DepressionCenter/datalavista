<!--
This file is part of DataLaVista
AI Prompts for Standardizing SharePoint Fields
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
This is a generative AI prompt that was fine-tuned after many tries to produce an enhancement to the alpha version of DataLaVista. It served as the basis for making SharePoint Lists much easier to query. It was ran through multiple AI tools including Gemini, Claude, ChatGPT and others, then the code was merged.

## AI Prompts
<code>
Here is my latest DataLaVista file. Let's make some enhancements.



*** Data Sources ***

Remove the existing code that keeps track of data sources and disallows having more than 5, and calls them MoreData etc. This will need to be re-written.



Next, we will need to add a data source name box to every connection type in the Connect popup. JSON already has a box for table name that defaults to "Data" and it needs to be removed (plus the code adjusted to use the new textbox instead).  It should allow up to 6 alphanumerical characters, no spaces and no symbols, including the affix digit when necessary.



When adding a data source, the data source name will be required but there will be some default values. Use SP for SharePoint Lists sources, JSON for JSON sources, CSV for CSV sources, and Table for all others. If a data source name already exists in the state object, simply add a number to the data source when creating it (e.g. the first SP list data source is "SP" so the next one, because "SP" is already taken, will be "SP1", then when that is taken, "SP2", etc.).



Now, for running queries, we will need to specify the data source and table (similar to how we would specify a schema name in a database). So, I think that means every table will need to be prefixed by its data source followed by underscore, like "SP_People" for the People List in the SP data source. This should allow querying for "select SP_People.* from SP_People".



Next, in the UI, every table in the Tables & Fields panel should be under an expandable (and expanded) data source.



Users should be able to remove and rename (or alias) data sources and tables, and rename (or alias) fields, through the "Tables & Fields" panel. Do not add any edit/delete buttons to the data source or table names. Instead, add a custom right-click menu with options for "Rename" or "Delete", but "Delete" should not be an option for fields. Clicking "Rename" will make the data source/table/field editable so it can be renamed the same way inline edit works in sharepoint lists. Of course renaming won't actually touch the internal names! Clicking delete will require a confirmation, and if the user confirms, then delete this data source/table from the state, cache, the query builders, and the report designs. For data sources that are not file uploads, the menu will also include an option (above rename and delete) for "Copy URL" which will copy the data source's URL to the clipboard. The data source names will also have an alt text/title that shows the data source URL, or for file uploads, the file name with extension.



Every time a connection is made, the "Tables & Fields" panel should be refreshed and sorted alphabetically (by data source first, then by table name under each data source), then by field name.



*** Relationships ***

When loading a data source, is there a way to auto-detect relationships and save that information in the state? For SharePoint Lists, that would be lookup columns (which can be 1:N or M:N). For REST services, JSONAPI, Swagger and similar, perhaps there is a way to get table relationships. For flat JSON files, CSV, and Excel, there wouldn't be any autodetection. 



I think there is logic somewhere when adding tables to join that tries to match ID fields. This should be removed (or updated) as we'll make other changes. 

 

For SharePoint data sources, all columns of type "People or Group" should have a relationship to UserInformationist based on Id and ID respectively.



In the advanced query builder, it should create the joins to the primary (first dropped) table as you drop more tables based on that information. Due to name collisions (for example, CreatedBy and ModifiedBy would both link to UserInformationList), the SQL should be generated with aliases based on the lookup column name as prefix plus the remote field name (e.g. CreatedBy_Email).

When you add tables without relationships, or tables from different data sources,, the advanced query builder should try to generate a default JOIN between the new table and primary (first dropped) table by trying to joins based on the ID/Id/ChildTableNameId of the child table matching to ParentTableNameId in the parent table. If that isn't found, then simply do not create a join.



Let's not worry about Basic Query Builder yet. We'll add relationships for lookup fields there later, not now, we just need to make sure the relationships are available to areas outside advanced query builder.



An additional cool feature, though perhaps only if it doesn't require an overhaul of other stuff, would be if the relationships could be auto-suggested in SQL editor when you are manually writing a JOIN.
