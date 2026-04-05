<!--
This file is part of DataLaVista™
AI Prompts for Standardizing SharePoint Fields
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-03-10
Last Modified: 2026-03-20
Summary: DataLaVista™ is a ightweight, client-side reporting and dashboard toolkit.
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
      ||_|__________| ||   |   \ __ _| |_ __ _  | |   __ _  | \  / (_) ___| |_ __ TM
      ||              ||   | |) / _` |  _/ _` | | |__/ _` |  \ \/ /| (_-<  _/ _` |
      | \____________/ |   |___/\__,_|\__\__,_| |____\__,_|   \__/ |_/__/\__\__,_|
       \  |_|_|_|_|  / 
        \___________/         🕶️ "The BI Terminator" ™ 🕶️
```

# 🕶️ DataLaVista™
***🕶️ Tell your expensive BI tools: "Data la vista, baby!"***

## Description
This is a generative AI prompt that was fine-tuned after many tries to produce an enhancement to the proof-of-concept version of DataLaVista. It changed the architecture and main UI to evolve into the first alpha version. It was ran through multiple AI tools including Gemini, Claude, ChatGPT and others, then the code was merged.

## AI Prompts
<code>
I want to fine-tune field processing in the latest version of the working code.

You need to ensure that the field structure is queried first whenever possible, and if not, derive the field structure from the first 2 rows of data. Then, you will create a mapping according to certain rules (specified below). Then, you will retrieve the first 2 rows of data for every list/table/file/API/URL, and run the data through the mapping. The resulting data after being mapped will be the source for the query builder and SQL editor (that is, the source for alasql), and will also form the initial cache of the data. Then, when the user clicks Run Query, all data for the tables used in the alasql query will be retrieved and cached (replacing the two-row cache), and the flat-table returned by the Run Query will become the source for the design tab (where visuals are created), with both table structure structure and the data. The dashboard designer will allow the user to apply filters, grouping, aggregates, etc. which will generate individual alasql queries for each visual (from the flat table returned by Run Query). The preview tab and the stand-alone versions will both execute the whole process, except they will not need to run the field structure queries as they will already have taken place, and instead they will simply retrieve all the data needed by the tables used in the Run Query alasql query, transform the data according to the mapping rules, run the Run Query alasql query, then fill the data for each visual by executing their individual alasql queries. 

***Rules for Retrieving Data Structures:***
1) For all API calls to SharePoint lists, remote JSON files, and API services, to use the HTTP header {"Accept": "application/json"} instead of {"Accept": "application/json;odata=verbose"}.

2) If the data source is SharePoint Lists, fetch all list available in the site using the SharePoint REST API (`/_api/web/lists`). Skip any hidden and system lists, bringing only custom lists (BaseType=0 and Hidden=false). Get at a minimum the InternalName,Id,Description,Title,ItemCount.

3) If the data source is SharePoint Lists, use the SharePoint REST API (`/_api/web/lists(guid'...')/fields`) to get the field structure, and while retrieving the list field structure, always use these parameters: $select=Id,InternalName,Title,TypeAsString,Required,MaxLength,Choices,LookupField,LookupList,IsHidden,Hidden,ShowInEditForm,ReadOnlyField&$filter=(Hidden eq false and TypeAsString ne 'Computed' and startswith(InternalName,'_') eq false) or InternalName eq 'Editor' or InternalName eq 'Author' or InternalName eq 'Created' or 'InternalName' eq 'Modified' or InternalName eq 'ID' or InternalName eq 'Title' or InternalName eq 'TaxKeyword'

4) If the data source is a REST API (if REST API is implemented), try to get the structure using standard swagger, openapi, json:api, odata, and webapi standards if any are applicable. If that does not succeed, or if the data is simply a JSON file, download a very small sample of the data and use alasql to get the structure or try to guess the structure if even that fails.

5) If the data source is a JSON file, URL to a JSON file, a CSV file, an Excel file, get a very small sample of the data and use alasql to get the structure or try to guess the structure if all else fails.

6) After retrieving the list of fields for a SharePoint list, remove any fields whose InternalName or Title is one of the following: [
  'ItemChildCount','FolderChildCount','MetaInfo','DocIcon',
  'AppAuthor','AppEditor','Edit','ContentType','TemplateUrl','xd_ProgID',
  'xd_Signature','HTML_x0020_File_x0020_Type','_ModerationStatus',
  '_ModerationComments','InstanceID','Order','GUID','WorkflowVersion',
  'WorkflowInstanceID','ParentVersionString','ParentLeafName',
  'CheckedOutUserId','IsCheckedoutToLocal','UniqueId','SyncClientId',
  'ProgId','ScopeId','FileRef','FileDirRef','Last_x0020_Modified',
  'Created_x0020_Date','FSObjType','SortBehavior','FileLeafRef',
  'OriginatorId','NoExecute','ContentVersion','UIVersionString',
  'AccessPolicy','_UIVersionString','ParentUniqueId','_Level',
  'IsCurrentVersion','ItemChildCount','FolderChildCount',
  'ColorTag','_ColorTag','_IsRecord','_LabelAppliedBy','_LabelSetting',
  'ComplianceAssetId','_ComplianceFlags','_ComplianceTag','_ComplianceTagWrittenTime',
  '_ComplianceTagUserId','_IsRecord'
]

7) SharePoint list fields should always include: ID, Title, Author/Id, Author/Title, Author/Name, Editor/Id, Editor/Title, Editor/Name, Created, Modified, so ensure you keep those fields and properties in the data structure (or add them if not there already), in preparation for retrieving data later on.

8) For fields from SharePoint list field structure that are "People" fields, "People or Group" fields, or of type SP.Data.UserInfoItem (i.e., they contain {"odata.type": "SP.Data.UserInfoItem"}), kep only use the Id, Title, and Name properties (or add them if not already there). Do not attempt to use or retrieve EMail, Department, JobTitle nor any additional properties.

9) For fields from SharePoint list field structure that are taxonomy (enterprise keywords or TaxKeyword field), always include the properties Label and TermGuid.

10) For fields from SharePoint list field structure that are lookup fields (references to other lists), always include the properties Id and Title.




***Mapping Rules:***
1) Keep track of the internal list names and internal field names. Users will query using friendly names (as constructed in the existing code from Title properties), not internal list names, so this will be the first part of the mapping.

2) For SharePoint lists fields, always rename the "Attachments" field to "HasAttachments".


3) For SharePoint lists fields that are lookup fields (references to other lists), always save the value of the Title property as the field, and create a field containing the value of the Id property named the same as the field plus the word "Id". For example, {"PrimaryContact":{Id: 3, Title: "Gabriel Mongefranco"}} would map as follows:
{
  PrimaryContact: "Gabriel Mongefranco",
  PrimaryContactId: 3
}



4) For single-select fields from SharePoint lists that are "People" fields, "People or Group" fields, or of type SP.Data.UserInfoItem (i.e., they contain {"odata.type": "SP.Data.UserInfoItem"}), the data will map as follows. This example mapping assumes the field name is "Editor".
{
  Editor: (Editor.Title || Editor.Name || JSON.stringify(Editor)),
  EditorId: Editor.Id,
  EditorClaims: Editor.Name,
  EditorEmail: (Editor.Name.split(/[|]+/).pop().match(/^(?:[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,6})?$/) || [''])[0],
  EditorPictureUrl: ("https://umhealth.sharepoint.com/sites/DepressionCenter-TrackMaster/_layouts/15/userphoto.aspx?size=%3CM%3E&accountname=" + Editor.Name)
}


5) For multi-select fields from SharePoint lists that are "People" fields, "People or Group" fields, or of type SP.Data.UserInfoItem (i.e., they contain {"odata.type": "SP.Data.UserInfoItem"}), create a semicolon-space-separated list of the Title properties as the field, then create a field with the same name as the field plus the word "Emails" that contains a semicolon-space-separated list of email addresses (using the regex for grabbing Email from the Name field as shown in #4), and then create a field with the same name as the field plus the word "Data" that is an array of each individual item of the field that has been mapped as specified in #4. For example, a People field called Editor that contains two elements (one for Gabriel and one for Victoria), would map as follows ("..." is just short-hand not a string literal):
{Editor: "Mongefranco, Gabriel; Bennett, Victoria",
EditorEmails: "mongefrg@med.umich.edu; bennettv@med.umich.edu",
EditorData: [{Editor: "Mongefranco, Gabriel", EditorId: ..., EditorClaims: ..., EditorEmail: mongefrg@med.umich.edu, EditorPictureURL: ...},{Editor: "Bennett, Victoria", EditorId: ..., EditorClaims: ..., EditorEmail: bennettv@med.umich.edu, EditorPictureURL: ...}]}

6) For single-select Enterprise Keywords fields (Taxonomy fields) and for the "TaxKeyword" field in SharePoint lists, save the Label property as the field, and create a field called the same as the field plus the word "Id" that contains the Label property concatenated by a pipe then concatenated by the TermGuid property (Label + "|" + TermGuid).
  
7) For multi-select Enterprise Keywords fields (Taxonomy fields) and for the "TaxKeyword" field in SharePoint lists, create a semicolon-space-separated list of the Label properties as the field, and create a semicolon-space-separated list of Label + "|" + TermGuid named the same as the field plus the word "Ids", and create a field named the same as the field plus the word "Data" that contains the raw array from the API.

For example, a TaxKeyword field that retrieves two terms, like [{"Label": "Adolescents - Teens","TermGuid": "c7c7c717-b40a-4a00-a1b7-906b82ab17cf","WssId": 64},{"Label": "Hispanic - Latinx","TermGuid": "aa6320f0-ef06-4de9-a157-5c0e26982dcf","WssId": 114}] would use these mapping:
{
  TaxKeyword: "Adolescents - Teens; Hispanic - Latinx",
  TaxKeywordIds: "Adolescents - Teens|c7c7c717-b40a-4a00-a1b7-906b82ab17cf; Hispanic - Latinx|aa6320f0-ef06-4de9-a157-5c0e26982dcf",
  TaxKeywordData: [{"Label": "Adolescents - Teens","TermGuid": "c7c7c717-b40a-4a00-a1b7-906b82ab17cf","WssId": 64},{"Label": "Hispanic - Latinx","TermGuid": "aa6320f0-ef06-4de9-a157-5c0e26982dcf","WssId": 114}]
}

8) For any fields that don't meet the previous rules and that are an array of non-objects, including plain JSON arrays and SharePoint multi-select choice fields, return a field with the array values in a semicolon-space-separated string, and create another field with the same name plus the word "Data" that contains the actual raw array. For example, a field { MultiSelectChoice: ["Choice1","Choice2"]} would map as follows:
{
  MultiSelectChoice: "Choice1; Choice 2",
  MultiSelectChoiceData: ["Choice1","Choice2"]
}

9) For any fields that don't meet the previous rules and that are an array of objects, do one of the following:
  12.1) If the field contains a property with any of the names in [Key,ID,Id,Guid,GUID,guid,termguid,TermGuid,WssId,Wssid,wssid] and a property with any of the names in [Value,value,Label,label,Title,title,Name,name,lookupValue,LookupValue,lookupvalue,displayValue,DisplayValue,displayvalue,TextValue,textvalue,StringValue,stringvalue], then return a semicolon-space-separated string of (Value || value || Label || label || Title || title || Name || name || lookupValue || LookupValue || lookupvalue || displayValue || DisplayValue || displayvalue || TextValue || textvalue || StringValue || stringvalue || JSON.stringify(field)) as the field, then create a field with a semicolon-space-separated string of (Key || ID || Id || Guid || GUID || guid || termguid || TermGuid || WssId || Wssid || wssid || '') named the field plus the word "Ids", then create a field named the field plus the word "Data" containing the raw array of objects.
  12.2) Else if the fields does not meet condition #12.1, save JSON.stringify(field) as the field, and create a field named the same as the field plus the word "Data" containing the actual raw array of objects.

10) For SharePoint lists item fields that are of type hyperlink, save the Url as the field and create a field containing the Description and named the same as the field plus the word "Description".

11) For fields that don't meet the previous rules, and that are of type object, and the object contains only a single element, pull out the element and save it as the field, then re-process the field with all the previous rules.
  
12) For fields that don't meet the previous rules, and that are of type object, and the object contains more than one element, create a field with the JSON.stringify() representation of the field as the field, then create a new field with the same name as the field plus the word "Data" containing the raw object, and then if the elements are known from the structure alone (not from data), create new fields for each element with the same name as the field plus the name of the element.

13) For any other fields that do not meet any of the previous criteria, process with any other rules that existed in the previous version of the code, and if there aren't any, simply return the field as-is.




***Rules for Retrieving Data:***
1) After completing the mapping, retrieve and cache up to 2 rows from every data source.

2) Only retrieve all rows (up to 5,000) when a table is named in the query used by the SQL Query editor and the cache does not already contain more than 2 rows.

3) Retrieve tables asynchronously, and always display an information message of "Fetching data..." while retrieving data, whether it's in the query editor tab or in the dashboard designer tab or in the preview tab or in the stand-alone code.

4) For SharePoint lists, when retrieving the list items, if the query fails with a 400 error, check if the response says a certain column does not exist (e.g.: "Column 'QuickStepColumn' does not exist"). If so, extract the name of the column, remove it from the select, filter and expand queries, and try again. Keep trying this process up to 10 times as long as you keep receiving the column does not exist error or until the call succeeds.

5) For SharePoint lists, when retrieving the list items, always include these fields in the select query (in addition to the fields you would retrieve based on the field structure): ID, Title, Author/Id, Author/Title, Author/Name, Editor/Id, Editor/Title, Editor/Name, Created, Modified. In addition, always expand the fields Author, Editor, lookup fields, and all taxonomy fields (enterprise keywords, fiels that where the TermGuid property is not undefined, and TaxKeyword field).

6) For fields from SharePoint lists that are "People" fields, "People or Group" fields, or of type SP.Data.UserInfoItem (i.e., they contain {"odata.type": "SP.Data.UserInfoItem"}), only retrieve the Id, Title, and Name properties. Do not attempt to retrieve EMail, Department, JobTitle nor any additional properties.

7) For fields from SharePoint lists that are lookup fields (references to other lists), always retrieve the Id and Title properties, and no other projected fields.

8) For fields that are of type Date or Date/Time, and that end with the words "Date" or "Fecha", regardless of data source, detect ISO date strings (`YYYY-MM-DDTHH:mm:ssZ`) via regex and strip the `T` and `Z`. Truncate `00:00:00` times to just the date.

9) For fields that are of type Date or Date/Time, and that do not end with the words "Date" or "Fecha", regardless of data source, detect ISO date strings (`YYYY-MM-DDTHH:mm:ssZ`) via regex and strip the `T` and `Z`.



*** Rules for the Connect Popup and Connect & Load toolbar button *** 
1) The connection popup should continue to display upon page load and should not block any clicks in other parts of the page.

3) Once a data source is loaded, change the label of the "⚡ Connect & Load" button to on the toolbar to "➕ Get More Data". After this changes, and the user connects to a different data source in the popup, load the data following all the same rules but pre-fix every table name with "MoreData". If a third data source is added, use the prefix "YetMoreData" for the tables. If the a fourth data source is added, use the prefix "FarMoreData" for the tables. If a fifth data source is added, use the prefix "TerminalData". Do not allow adding more than 5 data sources, so disable the "Get More Data" button after that. Ensure every set of prefixes in the field selection toolbar of the query builder show a slightly different color scheme, but keep it ADA and vision impaired appropriate.


</code>

### Follow up enhancement ###
<code>
This is good, but it looks like autosuggestions and alasql aren't picking up changes I make to dataset or table names. For example, if I load a list with data source name SP, I can do "select * from People" and "select * from SP_People". Both work. Then I rename the "SP" data source to "List". The previous queries still run, but I cannot do "select * from List_People" as it won't find it. So:

I need to make sure that data sources, tables and fields all have an internal name (as set by the initial data source name, the internal names retrieved from sharepoint, or if not sharepoint then the names used in the original json/csv/excel/etc). They should also all have a universal alias which is the Pascal-case version. Tables/lists would be prefixed by the data source. Keep the "guid" property for tables that are SP lists. 



In the case of sharepoint lists, use the EntityTypeName as the internal name. Use the Title to generate the alias (or EntityTypeName if Title is empty).

In the case of SharePoint list items, use the InternalName to generate the Internal Name (or EntityTypeName if there is no InternalName or is blank, or Title as a last resource). Use the Title to generate the alias (or InternalName or EntityTypeName if no Title is available or is blank). You will need to also modify fetchSPFields to use const filter = `(Hidden eq false and TypeAsString ne 'Computed' and startswith(InternalName,'_') eq false and (TypeAsString ne 'LookupMulti' or (TypeAsString eq 'LookupMulti' and ReadOnlyField eq false and IsDependentLookup eq false))) or InternalName eq 'Editor' or InternalName eq 'Author' or InternalName eq 'Created' or InternalName eq 'Modified' or InternalName eq 'ID' or InternalName eq 'Title' or InternalName eq 'TaxKeyword'` and const select = `Id,InternalName,Title,TypeAsString,Description,Required,MaxLength,Choices,LookupField,LookupList,IsHidden,Hidden,ReadOnlyField,IsDependentLookup`; In addition, make any changes necessary in fetchSPFields or elsewhere to ensure FileRef and FileLeafRef are always requested for SP document library items (but not for list items).


If a data source does not have a display name or similar field, then the alias will be the Pascal-case version of the internal field's name. I think some objects in state have both alias and displayname, and I don't know if that's due to previous iterations or if we really do need to have two different ones. 



When the user renames objects (data source, table, column), the app should be changing the alias not the internal name, and it should be instantly reflected everywhere - query builders, alasql, code editor (both current text and auto suggestions), state, designer fields lists, designer widgets. (In addition to the old display name being removed from selected fields in visual query builders).

There is no longer a need to query by table name only without data source prefix. However, the "Tables & Fields" pnael in query builder should continue to strip the prefix from table names (for UI display purposes only) since they are already inside a data source in the tree. Also in the UI, under "Tables & Fields" panel, the table names and fields have too much empty space on the left - shift them left a little. Also, make the table names's font a little smaller (but keep them in bold) so they fit better.


------
*** TODO: LEFT OFF HERE! ***
Much better! 

I want to make sure that all data source names/keys/internal names have the word "List" removed, when it came from an EntityTypeName from SharePoint. All field names/keys/internal names should not include the "ListItem" text from the EntityTypeName either (if they were generated using EntityTypeName instead of InternalName  because InternalName was blank). All data sources should have an alias, which is initially the data source alias the user entered in the connect popup.

I also want to make sure that I can query every table two ways: 
1) by key (which should equal the internalname prefixed by data source name); 
2) by the table's alias prefixed by its data source alias.

For example, a list with entitytypename "Engagement_x0020_HistoryList" and Title "Consultations Provided", from a sharepoint list data source called "SP", would have a key="Engagement_x0020_History", internal name="Engagement_x0020_History", alias="ConsultationsProvided", and display name of "Consultations Provided". Thus, both of these SQL queries should work: "select * from SP_Engagement_x0020_History" and "select * from SP_ConsultationsProvided". I should also be able to use either field internal names or field aliases when querying data.

Both the basic and advanced query builders should use table aliases prefixed by data source alias, but they should always generate sql using only table keys but with aliases equal to table alias prefixed by data source alias. They both should display field aliases instead of field internal names everywhere (fields list for each table, filters, group by, etc.), but the SQL code they generate should always use field internal names (and in the SELECT, add " AS " followed by the field alias). The codemirror sql editor however should have auto-suggestions for both table keys and table alias prefixed by data source alias.

When generating SQL code from either basic or advanced query builders, in the select statement, use the tabale alias prefixed with data source alias dot field alias. For example, when a query builder has a data source named "SP" with alias "MyList", a list/table with key="SP_People", InternalName="People" and alias="Contacts", and with field internalname="Title" and field alias="FullName", it should generate sql similar to "select MyList_Contacts.Title AS FullName from SP_People MyList_Contacts".

If there is code to detect name collisions from fields with the same alias, simply add a number 1, 2, 3 etc. to each duplicated field alias. For example, if I am doing "select SP_List1.Title AS Name, SP_List2.Title AS Name, CSV.Name AS Name", then change the 2nd alias to end with a number like this: "select SP_List1.Title AS Name, SP_List2.Title AS Name1, CSV.Name AS Name2". Do this transparently without modifying the sql code in the sql editor.

This will ensure that the Designer only has non-duplicate fields.

I also want to make sure that all data sources, tables and fields from sharepoint lists include a Description, which should come from the Description field from sharepoint (or blank if the description field was blank or does not exist). 

When a data source is renamed, it shold be its alias that gets renamed, and that alias should be updated everywhere that keeps track of it.

-----------

This isn't working. When I use the query builder and it generates the following code, I get the correct number of rows but all columns are empty. "SELECT
  [SP_Consultations].[Title] AS [TitleOptional]
FROM [SP_Engagement_x0020_History] [SP_Consultations]
LIMIT 500"

If I remove all the fields and I just use "select *", it works, and I can see all the data. If I use "select [SP_Engagement_x0020_History].*" it also works.  It's the individual field selection that stopped working.

Let's make sure that mapDataRow() registers fields by internal names, not by aliases. 

Also, if it helps, remove support for querying by table aliases. That was only meant to help in the sql code editor, but it's not worth it if it's making the code and logic more confusing. Instead, maybe the auto-suggest stuff can simply add table aliases to the table internal names when the users select (or drag and drop) a table?

-------

Something is wrong. I used the basic query builder and it generated SQL that uses the table alias without the table internal name. It did "SELECT
  [SP_Consultations].[TitleOptional]
FROM [SP_Consultations]
LIMIT 500" instead of "FROM [SP_Engagement_x0020_History] [SP_Consultations]". 

Check if basic and advanced both have this bug and fix it.

-------
Fix this error you introduced (copy and paste from JavaScript Console in the browser):

Uncaught SyntaxError: Failed to execute 'insertBefore' on 'Node': Unexpected token ')'
    at t.evalScript (script-editor-bundle_bff8b23c35c805ac0d91a5ae2d240885.js:1:8271)
    at t.<anonymous> (script-editor-bundle_bff8b23c35c805ac0d91a5ae2d240885.js:1:9842)
    at script-editor-bundle_bff8b23c35c805ac0d91a5ae2d240885.js:1:5023
    at Object.next (script-editor-bundle_bff8b23c35c805ac0d91a5ae2d240885.js:1:5128)
    at a (script-editor-bundle_bff8b23c35c805ac0d91a5ae2d240885.js:1:3898)


</code>

### More follow up enhancements

<code>
The code that generates stand-alone reports has a bug - stand-alone reports that use CSVs/Excel stored in SharePoint sites are trying to load those files as if they were SP list items. That is causing the API call to fail. Fix it.

Ensure the code that generates stand-alone reports is updated with the latest javascript. Ensure regex expressions, especially those inside the stand-alone generator, aren't going to break the page.

-------------------

The "Copy URL" menu option should also be available for SP lists table names. It should be the siteURL + "/Lists/" + the EntityTypeName of the list (but strip out the word "List" at the end, and replace _x0020_ with %20).

In the Basic Query Builder only, let's select all fields by default when you drop a table/list.

In the Design tab, where you see widget properties, make sure that every column/field added to the widget has aggregate options for each column/field, same as those you find in the basic query builder. Also ensure the filters have the same filter options available in the basic query builder for each column/list that was added as a filter to the widget. 

In the filter bar of the design tab, when selecting a filter, ensure the filters for dates are displayed as a date range with each date having a mini calendar to select a date. Also in the filter bar, the filters for numeric fields should also have a range instead of a dropdown. Moreover, filters for text should have drop-downs with the values from that field, but should also include an option at the top for (empty) to filter for empty or null items (and do not display a menu entry that is just an empty string in the dropdown). Also, if possible, include a filter in text fields to filter by wildcards, making sure you translate * to % and ? to _ so they run in alasql.

Finally, in the Connect popup, add a Browse button to the right of the URL text box but disable it by default. If we are currently inside a SharePoint site (and the SharePoint site URL has resolved successfully), enable the button and show a file section (similar to the Windows file dialog) that allows the user to navigate to a document library and folder, and select the file to load. Selecting the file will then simply enter the URL for the file into the URL text box.

Ensure the code that generates stand-alone reports is updated with the latest javascript. Ensure regex expressions, especially those inside the stand-alone generator, aren't going to break the page.

</code>