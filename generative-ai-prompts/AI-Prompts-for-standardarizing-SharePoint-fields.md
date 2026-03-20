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