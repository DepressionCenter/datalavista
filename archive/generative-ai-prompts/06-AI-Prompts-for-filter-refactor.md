<!--
This file is part of DataLaVista™
AI Prompts for Standardizing Filters in the UI
Author(s): Gabriel Mongefranco, Jeremy Gluskin, Shelley Boa.
Created: 2026-04-06
Last Modified: 2026-04-07
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
This is a generative AI prompt that was fine-tuned, and feed and refed to AI assistants for clarity, to refactor the filters available in the UI.

## AI Prompts

<code>
Make these changes to filter options (and the shared functions that generate filter options) across basic query builder, advanced query builder, dashboard designer, and dashboard designer advanced properties popup.

1) Create helper functions sniffArrayType(arr) and getArraySampleForField(tableKey, fieldInternalName) as described in the supporting technical notes. These are pure JavaScript functions, not alasql UDFs. Details below.

2) The filter conditions should reflect the following operations and value entry depending on the data type:
  2.1) Boolean data types:
    - Ops: equals, not equals, is blank, is not blank.
	- Value: drop-down with true and false only, with true being the default. Do not show "-".
	
  2.2) Date data types: Add 'is between' operator. This would cause it to have two text boxes (each with a calendar), and the clause would be BETWEEN date1 AND date2. Keep all the other filters the same - they are perfect!
  
  2.3) Text data types:
    - Ops: equals, does not equal, starts with, does not start with, ends with, does not end with, contains, does not contain, is blank, is not blank.
	- Value: textbox with autosuggestions based on the field (first 1000 distinct values where field is not null and length(field)<50). However, see 2.6 (down below) for auto-suggestion implementation.
	
    - When the op is "is blank", generate a clause that takes common import issues into account, TRIM(COALESCE([view_alias].[field], '')) IN ('', 'null', 'NULL', '\N', 'undefined', '#N/A', '#NA', '#VALUE!', '#REF!', 'NaN').
	- When the op is "is not blank", generate a clause that takes common import issues into account, TRIM(COALESCE([view_alias].[field], '')) NOT IN ('', 'null', 'NULL', '\N', 'undefined', '#N/A', '#NA', '#VALUE!', '#REF!', 'NaN').
	
	- When op is contains/does not contain:
	  - if value is enclosed in "" -> remove enclosing " and " then replace ' with '', escape % with ~%, escape _ with ~_, create clause WHERE ds_view.field LIKE/NOT LIKE '%' + - modified_string + '%' ESCAPE '~'
	  - if value is enclosed in '' -> remove enclosing ' and ' then replace ' with '', escape % with ~%, escape _ with ~_, create clause WHERE ds_view.field LIKE/NOT LIKE '%' + - modified_string + '%' ESCAPE '~'
	  - if value is not enclosed in "" or '' -> replace ' with '' then replace * with %, replace ? with _, create clause WHERE ds_view.field LIKE/NOT LIKE '%' + modified_string + '%'
	
	- When op is starts with/does not start with:
	  - if value is enclosed in "" -> remove enclosing " and " then replace ' with '', escape % with ~%, escape _ with ~_, create clause WHERE ds_view.field LIKE/NOT LIKE  modified_string + '%' ESCAPE '~'
	  - if value is enclosed in '' -> remove enclosing ' and ' then replace ' with '', escape % with ~%, escape _ with ~_, create clause WHERE ds_view.field LIKE/NOT LIKE modified_string + '%' ESCAPE '~'
	  - if value is not enclosed in "" or '' -> replace ' with '' then replace * with %, replace ? with _, create clause WHERE ds_view.field LIKE/NOT LIKE modified_string + '%'
	
	
	- When op is ends with/does not end with:
	  - if value is enclosed in "" -> remove enclosing " and " then replace ' with '', escape % with ~%, escape _ with ~_, create clause WHERE ds_view.field LIKE/NOT LIKE  '%' + modified_string ESCAPE '~'
	  - if value is enclosed in '' -> remove enclosing ' and ' then replace ' with '', escape % with ~%, escape _ with ~_, create clause WHERE ds_view.field LIKE/NOT LIKE '%' + modified_string ESCAPE '~'
	  - if value is not enclosed in "" or '' -> replace ' with '' then replace * with %, replace ? with _, create clause WHERE ds_view.field LIKE/NOT LIKE '%' + modified_string
	  
  2.4) Number data types:
    - Ops: equals, not equals, greater than, greater than or equal to, less than, less than or equal to, is between, is blank, is not blank
	- Value: text box that accepts only integer/decimal numbers. For new 'is between' operator, two text boxes that accept only integer/decimal numbers
	
  2.5) Object data types:
    - Ops: Show a drop-down with the object's keys, sorted alphabetically and the first one selected, then show a second drop-down with the filter ops appropriate for the type of the selected element (2.1, 2.2, 2.3, 2.4). Exclude elements that are objects or arrays of objects. 
	- To determine the data type of the selected element, and thus which filters to show, use sniffType() if the user is in the dashboard design tab. If the user is in the query tab, since you will know the table key and internal field name, create a similar function to sniffType() where you can pass the table key and column internal name instead of alias. For both functions, have an optional elementKey parameter. When an elementKey is passed, both functions will skip to the "fallback" method (alasql query) but instad of using col for SELECT and WHERE, use SELECT col->elementKey AS col, WHERE col->elementKey is not null.
	- Value: Depending on data type, use the corresponding 2.1/2.2/2.3/2.4 rule.
	- For the autosuggestions specified in 2.3 for text fields, you will need to query column->elementKey to get values instead of just column.
	
  2.6 Array and lookup data types: check if it's an array of objects, then go to 2.6.1, otherwise if it's an array of string/number/date skip to 2.6.2, otherwise if it's an array of arrays or you can't determine the underlying type, skip to 2.6.3 as the default.
	2.6.1) Array of objects
	  - Ops: Show a drop-down with the object's keys, sorted alphabetically 
		and the first one selected, then show a second drop-down with the 
		filter ops appropriate for the type of the selected element 
		(2.1, 2.2, 2.3, 2.4). Exclude elements that are objects or arrays 
		of objects. Also include "is empty" / "is not empty" which check 
		whether the array itself has any elements. Exclude the 'is between' op for all 2.6.x.
	  - Value: Depending on data type, use the corresponding 2.1/2.2/2.3/2.4 rule.
	  - SQL generation:
		- For equality: DLV_INCLUDES(field, 'elementKey', value). The operator parameter must always be passed as a quoted string literal, e.g. DLV_INCLUDES([alias].[field], 'Title', 'Smith', '!=')
		- For other operators: DLV_INCLUDES(field, 'elementKey', value, 'operator'). The operator parameter must always be passed as a quoted string literal, e.g. DLV_INCLUDES([alias].[field], 'Title', 'Smith', '!=')
		- For is empty/is not empty: DLV_ARRAY_EMPTY(field) = true/false
	  - Note: text ops (contains, starts with, ends with) are NOT supported 
		for array element filters. Exclude them from the ops drop-down when 
		the selected element is of text type.
		
	2.6.2) Array of string/number/date
	  - Ops: Three groups, shown together in the drop-down with a visual separator:
		Group 1 — "Any element" ops (filter by element values):
		  For number arrays: "any element equals", "any element not equals",
			"any element greater than", "any element greater than or equal to",
			"any element less than", "any element less than or equal to". No "between".
		  For date arrays: same as number arrays above.
		  For string arrays: "any element equals", "any element not equals" only.
		  Note: contains/starts with/ends with are NOT supported for array element filters.

		Group 2 — "# of elements" ops (filter by array length):
		  "# of elements equal to", "# of elements not equals",
		  "# of elements greater than", "# of elements greater than or equal to",
		  "# of elements less than", "# of elements less than or equal to". No "between".

		Group 3 — Array-level ops (no prefix):
		  "is empty", "is not empty".

	  - Value:
		- Any element ops: use corresponding 2.2/2.4 rule for the detected scalar type.
		- # of elements ops: text box accepting only non-negative integers.
		  For "# of elements is between": two text boxes accepting non-negative integers.
		- is empty/is not empty: no value input.

	  - SQL generation:
		- Any element comparisons: DLV_ARRAY_MATCH(field, 'operator', value)
		- # of elements comparisons: field->length operator value
		  e.g. [alias].[field]->length >= 3
		- # of elements is between: 
		  [alias].[field]->length >= value1 AND [alias].[field]->length <= value2
		- is empty/is not empty: DLV_ARRAY_EMPTY(field) = true/false
	
	2.6.3) Other type of array
	  - Ops: The same as 2.4, but all the numeric comparisons will have "# of elements " prefixed (e.g. # of elements equal to, # of elements not equals...). The is empty/is not empty ops will not have the "# of elements" prefix.
	  - Value: text box, accepts only numbers.
	  - When comparing # of elements, use field->length (notation supported by alasql).
	  - When comparing "empty"/"not empty", use the SQL UDF DLV_ARRAY_EMPTY().
	
	2.6.4) Other considerations. To determine the array element type for filter UI generation:
	  - Always check field.displayType from field metadata first, as it is 
		available for all tables including SharePoint lists before data loads:
		  - 'lookup' or 'lookup-multi'   → 2.6.1, preset keys: Id (number), Title (text)
		  - 'person' or 'person-multi'   → 2.6.1, preset keys: Id (number), Title (text), Name (text), Email (text)
		  - 'taxonomy', 'taxkeyword', 'taxonomy-multi', or 'taxkeyword-multi'        → 2.6.1, preset keys: TermGuid (text), Label (text)
		  - 'array-number'               → 2.6.2, scalarType: number
		  - 'array-date'                 → 2.6.2, scalarType: date
		  - 'array-string'               → 2.6.2, scalarType: string
		  - 'array-boolean'              → 2.6.2, scalarType: boolean
		  - 'array' (generic)            → fall through to sniff

	  - If displayType is generic 'array' or unrecognized, fall back to 
		sniffArrayType(arr) using a sample from 
		DataLaVistaState.tables[tableKey].data. If no data is available,
		default to 2.6.3.

	  - In the dashboard design tab, sniffType(alias) handles everything 
		by accessing metadata from raw tables if it finds a matching alias,
		or falls back to a sql query. For 2.6.1, pass the elementKey 
		to sniffType() to determine the data type of a specific key within 
		the object array, which controls which ops are shown in the second 
		drop-down.

	  - For SP lookup/person/taxonomy fields in 2.6.1, all element keys 
		should be treated as text type for filter ops, except Id which should be treated as number type.
	
</code>