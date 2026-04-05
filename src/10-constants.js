/* ============================================================
This file is part of DataLaVista™
10-constants.js: Constants, state object, and core DataLaVista objects.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-24
Last Modified: 2026-04-05
Summary: Constants, state object, and core DataLaVista objects.
Notes: See README file for documentation and full license information.
Website: https://github.com/DepressionCenter/datalavista

Copyright (c) 2026 The Regents of the University of Michigan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
You should have received a copy of the GNU General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.
================================================================ */

/* ============================================================
    Data La Vista Core
    [I'll be backbone...]
  =============================================================== */
const DataLaVistaCore = {
  /* ===== CONSTANTS ===== */
  // Field type icons for display in field lists, query builder, etc.
  FIELD_TYPE_ICONS: {
    'text': { icon: '📝', cls: 'type-text' },
    'number': { icon: '#️⃣', cls: 'type-number' },
    'integer': { icon: '#️⃣', cls: 'type-number' },
    'decimal': { icon: '#️⃣', cls: 'type-number' },
    'currency': { icon: '#️⃣', cls: 'type-number' },
    'date': { icon: '📅', cls: 'type-date' },
    'bool': { icon: '✅', cls: 'type-bool' },
    'boolean': { icon: '✅', cls: 'type-bool' },
    'lookup': { icon: '🔍', cls: 'type-lookup' },
    'array': { icon: '🍱', cls: 'type-array' },
    'default': { icon: '🔡', cls: 'type-text' }
  },

  // Table/source type icons — SharePoint has sub-keys (list vs library); others are flat.
  // TODO: Add file extension arrays to use in file picker
  TABLE_SOURCE_ICONS: {
    sharepoint: {
      list:    { icon: '📋', title: 'SharePoint List' },
      library: { icon: '📁', title: 'Document Library' }
    },
    json:    { icon: '📚', title: 'JSON' },
    csv:     { icon: '📄', title: 'CSV Spreadsheet' },
    excel:   { icon: '📗', title: 'Excel Spreadsheet' },
    default: { icon: '⏹️', title: 'Table' }
  },

  DATE_MACRO_OPS: [
    { val: 'TODAY', label: '= ☀️ Today', hasInput: false },
    { val: 'THIS_WEEK', label: '= 📆 This Week', hasInput: false },
    { val: 'LAST_WEEK', label: '= 📆 Last Week', hasInput: false },
    { val: 'THIS_BIZ_WEEK', label: '= 👩🏾‍💼 This Business Week', hasInput: false },
    { val: 'LAST_BIZ_WEEK', label: '= 👨🏻‍💼 Last Businss Week', hasInput: false },
    { val: 'THIS_MONTH', label: '= 📅 This Month', hasInput: false },
    { val: 'LAST_MONTH', label: '= 📅 Last Month', hasInput: false },
    { val: 'THIS_YEAR', label: '= 🎂 This Year', hasInput: false },
    { val: 'LAST_YEAR', label: '= 🎂 Last Year', hasInput: false },
    { val: 'THIS_FISCAL', label: '= 📒 This Fiscal Year', hasInput: false },
    { val: 'LAST_FISCAL', label: '= 📒 Last Fiscal Year', hasInput: false },
    { val: 'THIS_ACADEMIC', label: '= 🎓 This Academic Year', hasInput: false },
    { val: 'LAST_ACADEMIC', label: '= 🎓 Last Academic Year', hasInput: false },
    { val: 'PAST_X_DAYS', label: '= ⏳☀️ Past X Days', hasInput: true },
    { val: 'PAST_X_MONTHS', label: '= ⏳📅 Past X Months', hasInput: true },
    { val: 'PAST_X_YEARS', label: '= ⏳🎂 Past X Years', hasInput: true },
    { val: 'PAST_X_FISCAL', label: '= ⏳📒 Past X Fiscal years', hasInput: true }
  ],

  DATE_MACRO_VALS: new Set([
    'TODAY',
    'THIS_WEEK',
    'LAST_WEEK',
    'THIS_BIZ_WEEK',
    'LAST_BIZ_WEEK',
    'THIS_MONTH',
    'LAST_MONTH',
    'THIS_YEAR',
    'LAST_YEAR',
    'THIS_FISCAL',
    'LAST_FISCAL',
    'THIS_ACADEMIC',
    'LAST_ACADEMIC',
    'PAST_X_DAYS',
    'PAST_X_MONTHS',
    'PAST_X_YEARS',
    'PAST_X_FISCAL'
  ])
  
} // End DataLaVistaCore


/* ===== STATE ===== */
//const dlvRawState = {
const DataLaVistaState = {
  dataSources: {},   // dsName -> { type, url, auth, token, fileName, alias, tables: [internalTableKeys] },											  
  tables: {},        // internalName -> { displayName, alias, fields: [], data: [], loaded: false }
  queryMode: 'basic',
  basicQB: { // Basic Query Builder
    tableName: null,
    selectedFields: [],
    fieldAggs: {},
    conditions: [],
    sorts: [],
    groupBy: [],
    rowLimit: 500
  },
  advancedQB: { // Advanced Query Builder
    nodes: {},
    joins: [],
    activeJoinIdx: -1,
    rowLimit: 500
  },
  sql: '',
  sqlLocked: false,
  queryColumns: [],
  design: {
    title: '',
    widgets: [],     // widget objects
    filters: [],     // { field, label, position }  — preview filter bar chips
    conditions: [],  // { conj, field, op, value }  — design-level data filter
    sorts: [],       // { field, dir }              — design-level sort
    groupBy: [],     // string[]                    — design-level group by
    fieldAggs: {},   // { [col]: aggVal }           — design-level aggregates
    transformedResults: null  // cached result of applyDesignTransforms()
  },
  currentWidgetId: null,
  previewFilters: {},  // field -> value
  activeTab: 'query',
  qbCollapsed: false,
  qbSectionHeight: 60,  // percent
  charts: {},   // widgetId -> echarts instance
  isSpSite: false, // true if we detect we're running inside a SharePoint site (based on URL and/or presence of SharePoint JS objects)
  spSiteUrl: null, // if isSpSite=true, this holds the detected SharePoint site URL; otherwise null
  spPageMode: null,  // 'view' or 'edit' (only relevant if isSpSite=true)
  reportMode: 'view', // 'view' or 'edit' (can be set via ?reportMode=<val> param; defaults to 'view')
  reportUrl: null, // if ?report=<url> param is provided, this holds the URL of the report being edited
  relationships: [], // auto-detected and manual relationships: [{ id, source, childTableKey, childField, parentTableKey, parentField, joinType, spLookupField }]
  drillFilters: {},  // cross-widget click filters: { fieldName: value } — rebuilt on every chart/table click
  _initialized: false
}; // End dlvRawState





// ============================================================
// CONSTANTS
// ============================================================
const ALASQL_KEYWORDS = [
  'ATTACH', 'DETACH', 'SHOW', 'TABLES', 'DATABASES', 'FROM', 'SELECT', 'WHERE',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'FULL', 'CROSS', 'ON', 'AS', 'DISTINCT', 'ALL', 'UNION',
  'INTERSECT', 'EXCEPT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'VIEW', 'IF',
  'EXISTS', 'NOT', 'AND', 'OR', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'CONVERT', 'TOP', 'WITH', 'ROLLUP',
  'CUBE', 'GROUPING', 'SETS', 'PIVOT', 'UNPIVOT', 'OVER', 'PARTITION', 'ROWS',
  'RANGE', 'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'ROW', 'FILTER',
  'WITHIN', 'RECURSIVE', 'LATERAL', 'APPLY', 'TABLESAMPLE', 'PERCENT',
  'TIES', 'FETCH', 'FIRST', 'NEXT', 'ONLY', 'ROWS', 'ONLY', 'SKIP', 'ARRAY',
  'MATRIX', 'OF', 'STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'OBJECT', 'SEARCH',
  'REPLACE', 'REMOVE', 'RENAME', 'MODIFY', 'REINDEX', 'TRUNCATE', 'BEGIN',
  'COMMIT', 'ROLLBACK', 'TRANSACTION', 'SAVEPOINT', 'RELEASE', 'INCLUDES'
];

const AGG_OPTIONS = ['', 'COUNT', 'COUNT(DISTINCT)', 'SUM', 'AVG', 'MEDIAN', 'MIN', 'MAX', 'FIRST', 'LAST', 'STDEV', 'VAR'];



/** Returns the TABLE_SOURCE_ICONS entry for a table object from DataLaVistaState.tables. */
function getTableIcon(t) {
  if (t.sourceType === 'sharepoint') {
    return DataLaVistaCore.TABLE_SOURCE_ICONS.sharepoint[t.isDocLib ? 'library' : 'list'];
  }
  return DataLaVistaCore.TABLE_SOURCE_ICONS[t.sourceType] || DataLaVistaCore.TABLE_SOURCE_ICONS.default;
}



const SKIP_FIELDS = new Set([
  "AccessPolicy",
  "AppAuthor",
  "AppEditor",
  "Author@odata.navigationLinkUrl",
  "CheckedOutUserId",
  "ColorTag",
  "ComplianceAssetId",
  "ContentType",
  "ContentVersion",
  "Created_x0020_Date",
  "DocIcon",
  "Edit",
  "Editor@odata.navigationLinkUrl",
  "FSObjType",
  "FolderChildCount",
  "GUID",
  "HTML_x0020_File_x0020_Type",
  "InstanceID",
  "IsCheckedoutToLocal",
  "IsCurrentVersion",
  "ItemChildCount",
  "Last_x0020_Modified",
  "MetaInfo",
  "NoExecute",
  "OData__SysFlow",
  "OData__SysProfile",
  "OData__SysVersion",
  "Order",
  "OriginatorId",
  "ParentLeafName",
  "ParentUniqueId",
  "ParentVersionString",
  "ProgId",
  "ScopeId",
  "SortBehavior",
  "SyncClientId",
  "TemplateUrl",
  "UIVersionString",
  "UniqueId",
  "WorkflowInstanceID",
  "WorkflowVersion",
  "_ColorTag",
  "_ComplianceFlags",
  "_ComplianceTag",
  "_ComplianceTagUserId",
  "_ComplianceTagWrittenTime",
  "_IsRecord",
  "_LabelAppliedBy",
  "_LabelSetting",
  "_Level",
  "_ModerationComments",
  "_ModerationStatus",
  "_SysFlow",
  "_SysProfile",
  "_SysVersion",
  "_UIVersionString",
  "odata.editLink",
  "odata.etag",
  "odata.id",
  "odata.link",
  "odata.navigationLinkUrl",
  "odata.type",
  "xd_ProgID",
  "xd_Signature"
]);

const QB_AGGS = [
  { val: '', label: '— none —', types: 'all' },
  { val: 'COUNT', label: 'COUNT', types: 'all' },
  { val: 'COUNT_DISTINCT', label: 'COUNT DISTINCT', types: 'all' },
  { val: 'FIRST', label: 'FIRST', types: 'all' },
  { val: 'LAST', label: 'LAST', types: 'all' },
  { val: 'MAX', label: 'MAX  (Maximum)', types: 'ordered' },
  { val: 'MIN', label: 'MIN  (Minimum)', types: 'ordered' },
  { val: 'SUM', label: 'SUM  (Sum)', types: 'numeric' },
  { val: 'AVG', label: 'AVG  (Average)', types: 'numeric' },
  { val: 'MEDIAN', label: 'MEDIAN', types: 'numeric' },
  { val: 'VAR', label: 'VAR  (Variance)', types: 'numeric' },
  { val: 'STDEV', label: 'STDEV  (Std Dev)', types: 'numeric' }
];


// TODO: The CHART_TYPE_RULES const needs revision as some heuristics that use field names changed to just data types during de-duplication.
// See AI prompt #4 in the archive folder.
const CHART_TYPE_RULES = [
    {
        "id": "rule_006",
        "description": "Three or more number columns with no text or date — radar chart (≤30 rows) or parallel coordinates (>30 rows)",
        "suggestion": {
            "xField": null,
            "seriesField": null,
            "priority": 2,
            "echartsHints": {
                "radar": {},
                "tooltip": {
                    "trigger": "item"
                }
            }
        }
    },
    {
        "id": "rule_009",
        "description": "Only one number column — gauge for a single row, histogram-style bar for multiple rows",
        "suggestion": {
            "xField": null,
            "seriesField": null,
            "priority": 3,
            "echartsHints": {
                "gauge": {
                    "detail": {
                        "formatter": "{value}"
                    },
                    "axisLine": {
                        "lineStyle": {
                            "width": 15
                        }
                    }
                },
                "histogram": {
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "xAxis": {
                        "type": "category",
                        "name": "Bin"
                    },
                    "yAxis": {
                        "type": "value",
                        "name": "Frequency"
                    }
                }
            }
        }
    },
    {
        "id": "rule_010",
        "description": "Only one text column — pie chart of value counts (low cardinality) or word cloud (high cardinality)",
        "suggestion": {
            "xField": null,
            "yFields": [],
            "priority": 3,
            "echartsHints": {
                "pie": {
                    "tooltip": {
                        "trigger": "item",
                        "formatter": "{b}: {c} ({d}%)"
                    },
                    "series": [
                        {
                            "type": "pie",
                            "radius": [
                                "40%",
                                "70%"
                            ],
                            "label": {
                                "show": true
                            },
                            "emphasis": {
                                "label": {
                                    "show": true,
                                    "fontSize": 16,
                                    "fontWeight": "bold"
                                }
                            }
                        }
                    ]
                },
                "wordCloud": {
                    "tooltip": {
                        "trigger": "item"
                    },
                    "series": [
                        {
                            "type": "wordCloud",
                            "sizeRange": [
                                12,
                                60
                            ],
                            "rotationRange": [
                                -45,
                                45
                            ],
                            "gridSize": 8
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_112_tickets_by_assignee",
        "description": "Ticketing data (assignee/technician + ticket id/count; optional status + rating): suggest tickets-by-assignee bar (stack by status when available).",
        "suggestion": {
            "chartType": "bar",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Tickets by Assignee",
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "type": "scroll"
                },
                "xAxis": {
                    "type": "category",
                    "axisLabel": {
                        "rotate": 35
                    }
                },
                "yAxis": {
                    "type": "value",
                    "name": "Tickets"
                },
                "dataZoom": [
                    {
                        "type": "inside"
                    },
                    {
                        "type": "slider"
                    }
                ],
                "series": [
                    {
                        "type": "bar"
                    }
                ],
                "__fieldRoles": {
                    "assignee": [
                        "assignee",
                        "technician",
                        "analyst",
                        "agent",
                        "owner",
                        "resolver",
                        "assigned_to"
                    ],
                    "ticketId": [
                        "ticket",
                        "incident",
                        "case",
                        "issue",
                        "request"
                    ],
                    "status": [
                        "status",
                        "state",
                        "stage"
                    ],
                    "rating": [
                        "rating",
                        "satisfaction",
                        "csat",
                        "stars"
                    ]
                },
                "__aggregate": {
                    "value": "countTicketIdIfPresentElseSumCount",
                    "groupBy": "assignee",
                    "stackByIfPresent": "status",
                    "topN": 20
                }
            }
        }
    },
    {
        "id": "rule_tickets_001",
        "description": "Support ticket data with assignee, ticket count/ID, status, and satisfaction rating",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": "number",
            "seriesField": "text",
            "title": "Support Ticket Distribution by Assignee",
            "priority": 1,
            "echartsHints": {
                "type": "bar",
                "stack": "total",
                "label": {
                    "show": true,
                    "position": "insideRight"
                },
                "itemStyle": {
                    "borderRadius": [
                        8,
                        8,
                        0,
                        0
                    ]
                },
                "color": [
                    "#d62728",
                    "#ff7f0e",
                    "#2ca02c"
                ],
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "value",
                    "name": "Ticket Count"
                }
            }
        }
    },
    {
        "id": "rule_004",
        "description": "Applies when the result has exactly 1 low-cardinality text column (<= 20 unique) and 2+ numeric columns.",
        "suggestion": {
            "chartType": "bar",
            "xField": "__TEXT_0__",
            "yFields": [
                "__NUM_ALL__"
            ],
            "seriesField": null,
            "title": "Multiple metrics by {{__TEXT_0__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "text",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "all"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__TEXT_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_ALL__",
                            "op": "sum"
                        }
                    ]
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "type": "scroll"
                },
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "value"
                }
            }
        }
    },
    {
        "id": "rule_011",
        "description": "Applies when the result has exactly 1 boolean column and 1 numeric column (compare True/False).",
        "suggestion": {
            "chartType": "bar",
            "xField": "__BOOL_0__",
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": null,
            "title": "{{__NUM_0__}} by {{__BOOL_0__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "boolean",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__BOOL_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_0__",
                            "op": "avg"
                        }
                    ]
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "value"
                },
                "series": {
                    "type": "bar",
                    "label": {
                        "show": true,
                        "position": "top"
                    }
                }
            }
        }
    },
    {
        "id": "rule_108_start_end_dates_gantt_like",
        "description": "Two date columns that look like start/end: suggest a timeline/Gantt-like visualization.",
        "suggestion": {
            "chartType": "bar",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Duration Timeline (Start → End)",
            "priority": 2,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "yAxis": {
                    "type": "category"
                },
                "tooltip": {
                    "trigger": "item"
                },
                "series": [
                    {
                        "type": "bar",
                        "barWidth": 12
                    }
                ],
                "__ganttLike": true,
                "__fieldRoles": {
                    "start": [
                        "start",
                        "begin",
                        "from"
                    ],
                    "end": [
                        "end",
                        "finish",
                        "to"
                    ],
                    "task": [
                        "task",
                        "name",
                        "title",
                        "id"
                    ]
                },
                "__note": "True Gantt is typically best as a custom series; alternatively compute duration=end-start and use stacked bars (offset + duration)."
            }
        }
    },
    {
        "id": "rule_003",
        "description": "Applies when the result has exactly 1 low-cardinality text column (<= 20 unique) and 1 numeric column.",
        "suggestion": {
            "chartType": "bar",
            "xField": "__TEXT_0__",
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": null,
            "title": "{{__NUM_0__}} by {{__TEXT_0__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "text",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__TEXT_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_0__",
                            "op": "sum"
                        }
                    ],
                    "sortBy": "__NUM_0__",
                    "order": "desc"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "xAxis": {
                    "type": "category",
                    "axisLabel": {
                        "interval": 0
                    }
                },
                "yAxis": {
                    "type": "value"
                }
            }
        }
    },
    {
        "id": "rule_102_percent_like_metric",
        "description": "Detect a percentage/rate/ratio metric and format axes/labels as percent.",
        "suggestion": {
            "chartType": "bar",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Rate / Percent by Category",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                },
                "yAxis": {
                    "axisLabel": {
                        "formatter": "{value}%"
                    }
                },
                "series": [
                    {
                        "type": "bar",
                        "label": {
                            "show": true,
                            "formatter": "{c}%"
                        }
                    }
                ],
                "__measureRole": "percent",
                "__note": "If values are in 0–1, scale to 0–100 before applying % formatting."
            }
        }
    },
    {
        "id": "rule_112",
        "description": "Ticketing dataset: assignee + ticket id/count (+ optional status, + optional rating) → tickets by assignee (stacked by status; optional rating line).",
        "suggestion": {
            "chartType": "bar",
            "xField": "{{assignee}}",
            "yFields": [
                "{{ticketsMetric}}"
            ],
            "seriesField": "{{status}}",
            "title": "Tickets by assignee",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "assignee": {
                        "type": "text",
                        "nameMatches": [
                            "assignee",
                            "technician",
                            "analyst",
                            "assigned_to",
                            "owner"
                        ],
                        "strategy": "bestMatch"
                    },
                    "status": {
                        "type": "text",
                        "nameMatches": [
                            "status"
                        ],
                        "strategy": "optionalBestMatch"
                    },
                    "ticketId": {
                        "type": [
                            "text",
                            "number"
                        ],
                        "nameMatches": [
                            "ticket",
                            "incident",
                            "case",
                            "issue"
                        ],
                        "strategy": "optionalIdLike"
                    },
                    "ticketCount": {
                        "type": "number",
                        "nameMatches": [
                            "ticket_count",
                            "tickets",
                            "count"
                        ],
                        "strategy": "optionalBestMatch"
                    },
                    "rating": {
                        "type": "number",
                        "nameMatches": [
                            "rating",
                            "satisfaction",
                            "csat",
                            "stars"
                        ],
                        "strategy": "optionalBestMatch"
                    }
                },
                "preprocess": {
                    "type": "aggregateTickets",
                    "groupBy": [
                        "{{assignee}}",
                        "{{status}}"
                    ],
                    "metric": {
                        "op": "countDistinctIfIdElseSum",
                        "idField": "{{ticketId}}",
                        "sumField": "{{ticketCount}}",
                        "as": "tickets"
                    },
                    "additionalMetrics": [
                        {
                            "field": "{{rating}}",
                            "op": "avg",
                            "as": "avg_rating",
                            "optional": true
                        }
                    ],
                    "sortBy": {
                        "field": "tickets",
                        "order": "desc"
                    },
                    "limit": 25,
                    "otherBucketLabel": "Other"
                },
                "option": {
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "legend": {
                        "type": "scroll"
                    },
                    "xAxis": {
                        "type": "category",
                        "axisLabel": {
                            "rotate": 30
                        }
                    },
                    "yAxis": [
                        {
                            "type": "value",
                            "name": "Tickets"
                        },
                        {
                            "type": "value",
                            "name": "Avg rating",
                            "min": 0,
                            "max": 5
                        }
                    ],
                    "dataZoom": [
                        {
                            "type": "inside",
                            "xAxisIndex": 0
                        }
                    ],
                    "series": [
                        {
                            "type": "bar",
                            "stack": "tickets"
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_004",
        "description": "Comparing multiple metrics across categories",
        "suggestion": {
            "chartType": "bar",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "category"
                },
                "legend": {
                    "show": true
                },
                "tooltip": {
                    "trigger": "axis",
                    "axisPointer": {
                        "type": "shadow"
                    }
                }
            }
        }
    },
    {
        "id": "rule_004",
        "description": "One low-cardinality text column and two or more number columns — grouped bar chart",
        "suggestion": {
            "chartType": "bar",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "category",
                    "axisLabel": {
                        "rotate": 30
                    }
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "show": true
                }
            }
        }
    },
    {
        "id": "rule_003",
        "description": "Categorical comparison with a manageable number of items",
        "suggestion": {
            "chartType": "bar",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "category"
                },
                "series": [
                    {
                        "type": "bar"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_003",
        "description": "One low-cardinality text column and one number column — vertical bar chart",
        "suggestion": {
            "chartType": "bar",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "category",
                    "axisLabel": {
                        "rotate": 30
                    }
                },
                "tooltip": {
                    "trigger": "axis"
                }
            }
        }
    },
    {
        "id": "rule_024",
        "description": "Ticket data",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "title": "Ticket Bar Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_112",
        "description": "Ticket assignee + ticket count (+ status/rating) – bar or heatmap",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "seriesField": "",
            "title": "`{xField}` ticket volume",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                },
                "series": [
                    {
                        "type": "bar",
                        "stack": "total"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_113",
        "description": "Sleep stage log with timestamp, optional HRV – stacked bar timeline",
        "suggestion": {
            "chartType": "bar",
            "xField": "date",
            "yFields": [
                "text"
            ],
            "seriesField": "",
            "title": "Sleep stages over time",
            "priority": 2,
            "echartsHints": {
                "series": [
                    {
                        "type": "bar",
                        "stack": "sleep"
                    }
                ],
                "legend": {
                    "show": true
                }
            }
        }
    },
    {
        "id": "rule_011",
        "description": "One boolean column + one numeric column",
        "suggestion": {
            "chartType": "bar",
            "seriesField": "",
            "title": "{yFields[0]} by {xField}",
            "priority": 1,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_003",
        "description": "One low-cardinality text column and one number column",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "title": "Bar Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_004",
        "description": "One low-cardinality text column and multiple number columns",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": "number",
            "title": "Multi-Bar Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_014",
        "description": "Metrics representing a percentage or ratio bounded to 0-100",
        "suggestion": {
            "chartType": "bar",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "yAxis": {
                    "max": 100,
                    "axisLabel": {
                        "formatter": "{value} %"
                    }
                }
            }
        }
    },
    {
        "id": "rule_024",
        "description": "Support technician performance and ticket volume",
        "suggestion": {
            "chartType": "bar",
            "title": "Ticket Workload by Assignee",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "stack": "total"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_026",
        "description": "Study data",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": "number",
            "title": "Study Bar Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_011",
        "description": "One boolean column and one number column",
        "suggestion": {
            "chartType": "bar",
            "xField": "boolean",
            "yFields": [
                "number"
            ],
            "title": "Bar Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_022",
        "description": "Text column with many unique values, unsuitable for standard categorical axes",
        "suggestion": {
            "chartType": "bar",
            "seriesField": null,
            "title": "Top Occurrences",
            "priority": 2,
            "echartsHints": {
                "xAxis": {
                    "type": "value"
                },
                "yAxis": {
                    "type": "category",
                    "inverse": true
                },
                "dataZoom": [
                    {
                        "type": "slider",
                        "yAxisIndex": 0,
                        "start": 0,
                        "end": 10
                    }
                ]
            }
        }
    },
    {
        "id": "rule_024",
        "description": "A column for ticket assignee / technician name / analyst ID and a column for tiket numbers (not aggregated) or number of tickets (aggregated), and possibly columns for ticket status and customer rating / 1-5 star satisfaction score.",
        "suggestion": {
            "chartType": "bar",
            "xField": "assignee",
            "yFields": [
                "ticket"
            ],
            "seriesField": "status",
            "title": "Tickets by assignee",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "bar"
                }
            }
        }
    },
    {
        "id": "rule_026",
        "description": "A column for study name/study ID, a column for participant ID, and numeric metrics for things like % compliance, % wear time, total device wear time, and possibly a study enrollment status.",
        "suggestion": {
            "chartType": "bar",
            "xField": "study",
            "yFields": [
                "compliance",
                "wearTime"
            ],
            "seriesField": "status",
            "title": "Study metrics by participant",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "bar"
                }
            }
        }
    },
    {
        "id": "rule_102",
        "description": "Column looks like a percentage (0‑100 values, name contains pct/percent/rate/ratio)",
        "suggestion": {
            "chartType": "bar",
            "xField": "",
            "yFields": "number",
            "seriesField": "",
            "title": "`{yFields[0]}` percentage",
            "priority": 2,
            "echartsHints": {
                "yAxis": {
                    "axisLabel": {
                        "formatter": "{value} %"
                    }
                },
                "tooltip": {
                    "formatter": "{b}: {c} %"
                }
            }
        }
    },
    {
        "id": "rule_004",
        "description": "Low‑cardinality text + multiple numeric columns",
        "suggestion": {
            "chartType": "bar",
            "seriesField": "",
            "title": "Metrics by {xField}",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                }
            }
        }
    },
    {
        "id": "rule_ticket_data",
        "description": "Ticket data with assignee and ticket information",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "Tickets by Assignee",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_study_data",
        "description": "Study data with participant and compliance metrics",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "seriesField": "text",
            "title": "Participant Compliance Metrics",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_003",
        "description": "Low‑cardinality text (≤10% of rows) + one numeric column",
        "suggestion": {
            "chartType": "bar",
            "seriesField": "",
            "title": "{yFields[0]} by {xField}",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_003",
        "description": "One text (low cardinality) + one number",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "title": "Comparison by category",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_011",
        "description": "One boolean + one number",
        "suggestion": {
            "chartType": "bar",
            "xField": "boolean",
            "yFields": [
                "number"
            ],
            "title": "Comparison by boolean",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_107",
        "description": "Numeric column where max/min > 1000 (wide range) – suggest log axis",
        "suggestion": {
            "chartType": "bar",
            "xField": "",
            "yFields": [
                "number"
            ],
            "seriesField": "",
            "title": "`{yFields[0]}` (log scale)",
            "priority": 2,
            "echartsHints": {
                "yAxis": {
                    "type": "log"
                }
            }
        }
    },
    {
        "id": "rule_two_dates",
        "description": "Two date columns, potentially for a timeline or Gantt chart",
        "suggestion": {
            "chartType": "bar",
            "xField": "date",
            "yFields": [
                "date"
            ],
            "seriesField": null,
            "title": "Timeline or Gantt Chart",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_007",
        "description": "One text, one number, high cardinality text",
        "suggestion": {
            "chartType": "bar",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "title": "Comparison by high cardinality text",
            "priority": 3,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_009",
        "description": "Single number column only",
        "suggestion": {
            "chartType": "bar",
            "xField": null,
            "yFields": [
                "number"
            ],
            "title": "Single number distribution",
            "priority": 3,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_006",
        "description": "Applies when the result contains 3+ numeric columns and no other column types (compare distributions).",
        "suggestion": {
            "chartType": "boxplot",
            "xField": null,
            "yFields": [
                "__NUM_ALL__"
            ],
            "seriesField": null,
            "title": "Distribution of numeric fields",
            "priority": 2,
            "echartsHints": {
                "fieldPicker": {
                    "y": [
                        {
                            "type": "number",
                            "mode": "all"
                        }
                    ]
                },
                "dataPrep": {
                    "transform": "boxplotByColumn",
                    "fields": "__NUM_ALL__"
                },
                "tooltip": {
                    "trigger": "item"
                },
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "value",
                    "scale": true
                },
                "series": {
                    "type": "boxplot"
                }
            }
        }
    },
    {
        "id": "rule_114",
        "description": "Study + participant + percent metrics (compliance/wear/adherence) → boxplot distribution by study (optionally with outliers).",
        "suggestion": {
            "chartType": "boxplot",
            "xField": "{{study}}",
            "yFields": [
                "{{percentMetric}}"
            ],
            "seriesField": null,
            "title": "{{percentMetric}} distribution by study",
            "priority": 2,
            "echartsHints": {
                "pick": {
                    "study": {
                        "type": "text",
                        "nameMatches": [
                            "study",
                            "study_id",
                            "studyname"
                        ],
                        "strategy": "bestMatch"
                    },
                    "participant": {
                        "type": "text",
                        "nameMatches": [
                            "participant",
                            "subject",
                            "pid"
                        ],
                        "strategy": "bestMatch"
                    },
                    "percentMetric": {
                        "type": "number",
                        "nameMatches": [
                            "compliance",
                            "wear",
                            "adherence",
                            "pct",
                            "percent",
                            "rate"
                        ],
                        "strategy": "bestMatch"
                    },
                    "enrollmentStatus": {
                        "type": "text",
                        "nameMatches": [
                            "enrollment",
                            "status"
                        ],
                        "strategy": "optionalBestMatch"
                    }
                },
                "preprocess": {
                    "type": "boxplotByGroup",
                    "groupBy": "{{study}}",
                    "valueField": "{{percentMetric}}",
                    "outliers": true,
                    "sortGroupsBy": "medianDesc"
                },
                "option": {
                    "tooltip": {
                        "trigger": "item"
                    },
                    "xAxis": {
                        "type": "category",
                        "axisLabel": {
                            "rotate": 20
                        }
                    },
                    "yAxis": {
                        "type": "value",
                        "min": 0,
                        "max": 100,
                        "axisLabel": {
                            "formatter": "{value}%"
                        }
                    },
                    "dataZoom": [
                        {
                            "type": "inside",
                            "xAxisIndex": 0
                        }
                    ],
                    "series": [
                        {
                            "type": "boxplot"
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_007",
        "description": "One text column with high cardinality and one number column",
        "suggestion": {
            "chartType": "boxplot",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "title": "Boxplot",
            "priority": 1
        }
    },
    {
        "id": "rule_sleep_001",
        "description": "Sleep tracking data with timestamp, sleep stage, and optional HRV RMSSD",
        "suggestion": {
            "chartType": "custom",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "seriesField": "text",
            "title": "Sleep Architecture & HRV",
            "priority": 1,
            "echartsHints": {
                "type": "custom",
                "renderItem": "renderSleepStage",
                "xAxis": {
                    "type": "time",
                    "name": "Time"
                },
                "yAxis": [
                    {
                        "type": "category",
                        "data": [
                            "Awake",
                            "Light",
                            "Deep",
                            "REM"
                        ]
                    },
                    {
                        "type": "value",
                        "name": "HRV RMSSD (ms)",
                        "position": "right"
                    }
                ],
                "color": [
                    "#ff0000",
                    "#ffff00",
                    "#0000ff",
                    "#800080"
                ]
            }
        }
    },
    {
        "id": "rule_108",
        "description": "Two date columns that look like start/end → Gantt-style timeline using custom series.",
        "suggestion": {
            "chartType": "custom",
            "xField": "{{startDate}}",
            "yFields": [
                "{{endDate}}"
            ],
            "seriesField": "{{label}}",
            "title": "Timeline (start → end)",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "startDate": {
                        "type": "date",
                        "nameMatches": [
                            "start",
                            "begin",
                            "from"
                        ],
                        "strategy": "bestMatchElseFirstDate"
                    },
                    "endDate": {
                        "type": "date",
                        "nameMatches": [
                            "end",
                            "finish",
                            "to",
                            "close"
                        ],
                        "strategy": "bestMatchElseSecondDate"
                    },
                    "label": {
                        "type": [
                            "text",
                            "number"
                        ],
                        "nameMatches": [
                            "task",
                            "name",
                            "id",
                            "title"
                        ],
                        "strategy": "optionalBestMatchElseRowIndex"
                    }
                },
                "preprocess": {
                    "type": "ganttRows",
                    "startField": "{{startDate}}",
                    "endField": "{{endDate}}",
                    "labelField": "{{label}}"
                },
                "option": {
                    "tooltip": {
                        "trigger": "item"
                    },
                    "dataZoom": [
                        {
                            "type": "inside",
                            "filterMode": "weakFilter"
                        },
                        {
                            "type": "slider",
                            "filterMode": "weakFilter"
                        }
                    ],
                    "xAxis": {
                        "type": "time"
                    },
                    "yAxis": {
                        "type": "category"
                    },
                    "series": [
                        {
                            "type": "custom",
                            "renderItem": "__INJECT_RENDER_ITEM_GANTT__",
                            "encode": {
                                "x": [
                                    1,
                                    2
                                ],
                                "y": 0
                            },
                            "clip": true
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_gantt_001",
        "description": "Two date columns suggesting start/end or duration (Gantt timeline)",
        "suggestion": {
            "chartType": "custom",
            "xField": "startDate",
            "yFields": [],
            "seriesField": null,
            "title": "Timeline / Gantt Chart",
            "priority": 1,
            "echartsHints": {
                "type": "custom",
                "renderItem": "renderGanttItem",
                "xAxisIndex": 0,
                "yAxisIndex": 0,
                "encode": {
                    "x": [
                        "startDate",
                        "endDate"
                    ],
                    "y": "taskName"
                }
            }
        }
    },
    {
        "id": "rule_020",
        "description": "Start and End dates indicating durations or schedules",
        "suggestion": {
            "chartType": "custom",
            "seriesField": null,
            "title": "Project / Event Timeline",
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "yAxis": {
                    "type": "category"
                }
            }
        }
    },
    {
        "id": "rule_wordcloud_001",
        "description": "High-cardinality text column (>50% unique values)",
        "suggestion": {
            "chartType": "custom",
            "xField": null,
            "yFields": [],
            "seriesField": "text",
            "title": "Word Cloud / High-Cardinality Distribution",
            "priority": 3,
            "echartsHints": {
                "type": "bar",
                "data": "aggregated top 50 by frequency",
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "value"
                },
                "label": {
                    "show": true,
                    "position": "right"
                }
            }
        }
    },
    {
        "id": "rule_108",
        "description": "Two date columns (start/end) – suitable for timeline/Gantt",
        "suggestion": {
            "chartType": "custom",
            "xField": "",
            "yFields": [],
            "seriesField": "",
            "title": "Timeline view",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item"
                },
                "series": [
                    {
                        "type": "custom",
                        "renderItem": null
                    }
                ]
            }
        }
    },
    {
        "id": "rule_sleep_data",
        "description": "Sleep data with timestamp and sleep stage",
        "suggestion": {
            "chartType": "custom",
            "xField": "date",
            "yFields": [
                "text"
            ],
            "seriesField": null,
            "title": "Sleep Stage Hypnogram",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_110",
        "description": "Single text column with >50% unique values – word cloud",
        "suggestion": {
            "chartType": "custom",
            "xField": "",
            "yFields": [],
            "seriesField": "",
            "title": "`{txt.name}` word cloud",
            "priority": 3,
            "echartsHints": {
                "series": [
                    {
                        "type": "custom",
                        "renderItem": null
                    }
                ]
            }
        }
    },
    {
        "id": "rule_106_funnel_pipeline_stage",
        "description": "Columns suggesting funnel/pipeline stages (stage/step/phase/status): suggest a funnel chart (count or sum by stage).",
        "suggestion": {
            "chartType": "funnel",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Pipeline / Funnel by Stage",
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item"
                },
                "series": [
                    {
                        "type": "funnel",
                        "sort": "descending",
                        "gap": 2,
                        "label": {
                            "show": true,
                            "position": "inside"
                        },
                        "labelLine": {
                            "show": false
                        }
                    }
                ],
                "__aggregate": {
                    "value": "count",
                    "fallback": "sumFirstNumeric"
                },
                "__fieldRoles": {
                    "stage": [
                        "stage",
                        "step",
                        "phase",
                        "status",
                        "pipeline"
                    ]
                }
            }
        }
    },
    {
        "id": "rule_funnel_001",
        "description": "Detects funnel/pipeline stage columns (stage, step, phase, status)",
        "suggestion": {
            "chartType": "funnel",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "Funnel Analysis",
            "priority": 1,
            "echartsHints": {
                "type": "funnel",
                "sort": "descending",
                "gap": 2,
                "label": {
                    "show": true,
                    "position": "inside",
                    "formatter": "{b}: {c}"
                },
                "itemStyle": {
                    "borderColor": "#fff",
                    "borderWidth": 2
                },
                "emphasis": {
                    "label": {
                        "fontSize": 16
                    }
                }
            }
        }
    },
    {
        "id": "rule_018",
        "description": "Process stages showing drop-off or conversion rates",
        "suggestion": {
            "chartType": "funnel",
            "xField": null,
            "title": "Pipeline Conversion",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "funnel",
                        "sort": "descending",
                        "label": {
                            "position": "right"
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_106",
        "description": "Column names suggest funnel stages (stage/step/phase/status) → funnel chart of counts or summed metric by stage.",
        "suggestion": {
            "chartType": "funnel",
            "xField": "{{stage}}",
            "yFields": [
                "{{value}}"
            ],
            "seriesField": null,
            "title": "Pipeline by {{stage}}",
            "priority": 2,
            "echartsHints": {
                "pick": {
                    "stage": {
                        "type": "text",
                        "nameMatches": [
                            "stage",
                            "step",
                            "phase",
                            "status"
                        ],
                        "strategy": "bestMatch"
                    },
                    "value": {
                        "type": "number",
                        "nameMatches": [
                            "count",
                            "total",
                            "amount",
                            "value"
                        ],
                        "strategy": "optionalBestMatch"
                    }
                },
                "preprocess": {
                    "groupBy": "{{stage}}",
                    "metrics": [
                        {
                            "field": "{{value}}",
                            "op": "sum",
                            "fallbackOpIfMissing": "count"
                        }
                    ],
                    "sortBy": {
                        "metric": "primary",
                        "order": "desc"
                    }
                },
                "option": {
                    "tooltip": {
                        "trigger": "item"
                    },
                    "series": [
                        {
                            "type": "funnel",
                            "sort": "descending",
                            "gap": 2,
                            "label": {
                                "position": "right"
                            }
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_011",
        "description": "One boolean column and one number column — funnel chart comparing the two groups",
        "suggestion": {
            "chartType": "funnel",
            "seriesField": null,
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item",
                    "formatter": "{b}: {c}"
                },
                "series": [
                    {
                        "type": "funnel",
                        "left": "10%",
                        "width": "80%",
                        "sort": "descending",
                        "label": {
                            "show": true,
                            "position": "inside"
                        },
                        "gap": 2
                    }
                ]
            }
        }
    },
    {
        "id": "rule_018",
        "description": "Funnel columns",
        "suggestion": {
            "chartType": "funnel",
            "seriesField": [
                "text"
            ],
            "title": "Funnel Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_018",
        "description": "Columns suggesting a funnel or pipeline",
        "suggestion": {
            "chartType": "funnel",
            "xField": null,
            "yFields": "text",
            "title": "Funnel chart",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "funnel"
                }
            }
        }
    },
    {
        "id": "rule_106",
        "description": "Columns whose names suggest funnel stages (stage, step, phase, status)",
        "suggestion": {
            "chartType": "funnel",
            "xField": "",
            "yFields": [
                "text"
            ],
            "seriesField": "",
            "title": "`{yFields[0]}` funnel",
            "priority": 2,
            "echartsHints": {
                "series": [
                    {
                        "sort": "descending"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_funnel",
        "description": "Columns suggesting a funnel or pipeline",
        "suggestion": {
            "chartType": "funnel",
            "xField": "text",
            "yFields": [],
            "seriesField": null,
            "title": "Funnel Chart",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_kpi_001",
        "description": "Detects single-row aggregates (KPI, total, summary metric)",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": "number",
            "seriesField": null,
            "title": "Key Performance Indicator",
            "priority": 1,
            "echartsHints": {
                "type": "gauge",
                "startAngle": 225,
                "endAngle": -45,
                "radius": "75%",
                "center": [
                    "50%",
                    "50%"
                ],
                "min": 0,
                "max": 100,
                "splitNumber": 10,
                "axisLine": {
                    "lineStyle": {
                        "width": 30,
                        "color": [
                            [
                                1,
                                "#E5E7EB"
                            ]
                        ]
                    }
                },
                "pointer": {
                    "itemStyle": {
                        "color": "auto"
                    }
                },
                "axisTick": {
                    "distance": -30,
                    "splitNumber": 5
                },
                "splitLine": {
                    "distance": -30,
                    "length": 8,
                    "lineStyle": {
                        "color": "#fff"
                    }
                },
                "axisLabel": {
                    "color": "auto",
                    "distance": 40,
                    "fontSize": 16
                },
                "detail": {
                    "valueAnimation": true,
                    "formatter": "{value}",
                    "color": "auto",
                    "fontSize": 20
                }
            }
        }
    },
    {
        "id": "rule_103_single_row_kpi_gauge",
        "description": "Single-row result with numeric KPI(s): suggest gauge-style KPI display.",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "KPI",
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "show": false
                },
                "series": [
                    {
                        "type": "gauge",
                        "startAngle": 200,
                        "endAngle": -20,
                        "radius": "85%",
                        "axisLine": {
                            "lineStyle": {
                                "width": 10
                            }
                        },
                        "splitLine": {
                            "length": 10
                        },
                        "axisTick": {
                            "length": 6
                        },
                        "axisLabel": {
                            "distance": 14
                        },
                        "detail": {
                            "valueAnimation": true,
                            "formatter": "{value}"
                        }
                    }
                ],
                "__kpiMode": true,
                "__note": "If multiple numeric columns exist, consider small-multiple gauges (one per metric)."
            }
        }
    },
    {
        "id": "rule_009",
        "description": "Applies when the result is a single numeric value (1 column, 1 row): show as a KPI gauge.",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": null,
            "title": "KPI: {{__NUM_0__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "dataPrep": {
                    "gaugeRange": {
                        "min": "auto(0)",
                        "max": "autoNice(>value)"
                    }
                },
                "tooltip": {
                    "trigger": "item"
                },
                "series": {
                    "type": "gauge",
                    "startAngle": 210,
                    "endAngle": -30,
                    "detail": {
                        "valueAnimation": true
                    }
                }
            }
        }
    },
    {
        "id": "rule_103",
        "description": "rowCount === 1 with a numeric field → KPI gauge (single value).",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [
                "{{number}}"
            ],
            "seriesField": null,
            "title": "{{number}}",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "number": {
                        "type": "number",
                        "strategy": "first"
                    }
                },
                "preprocess": {
                    "type": "singleValue",
                    "field": "{{number}}"
                },
                "option": {
                    "tooltip": {
                        "show": false
                    },
                    "series": [
                        {
                            "type": "gauge",
                            "startAngle": 90,
                            "endAngle": -270,
                            "pointer": {
                                "show": false
                            },
                            "progress": {
                                "show": true,
                                "roundCap": true,
                                "clip": true
                            },
                            "axisLine": {
                                "lineStyle": {
                                    "width": 18
                                }
                            },
                            "axisTick": {
                                "show": false
                            },
                            "splitLine": {
                                "show": false
                            },
                            "axisLabel": {
                                "show": false
                            },
                            "anchor": {
                                "show": false
                            },
                            "detail": {
                                "valueAnimation": true,
                                "fontSize": 28,
                                "offsetCenter": [
                                    0,
                                    0
                                ]
                            }
                        }
                    ]
                },
                "dynamic": {
                    "gaugeMaxStrategy": "useFieldMaxElseNiceRound"
                }
            }
        }
    },
    {
        "id": "rule_pct_001",
        "description": "Detects percentage columns by name pattern and value range",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "Percentage Metric",
            "priority": 2,
            "echartsHints": {
                "min": 0,
                "max": 100,
                "splitNumber": 10,
                "axisLine": {
                    "lineStyle": {
                        "width": 30
                    }
                },
                "progress": {
                    "itemStyle": {
                        "color": "#58c4dc"
                    }
                }
            }
        }
    },
    {
        "id": "rule_015",
        "description": "A single aggregated number to be displayed as a KPI metric",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "gauge",
                        "progress": {
                            "show": true
                        },
                        "detail": {
                            "valueAnimation": true
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_015",
        "description": "A column that appears to be a KPI or single aggregate",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": "number",
            "title": "KPI gauge",
            "priority": 1,
            "echartsHints": {
                "series": {
                    "type": "gauge",
                    "min": 0,
                    "max": 100
                }
            }
        }
    },
    {
        "id": "rule_014",
        "description": "Percentage column",
        "suggestion": {
            "chartType": "gauge",
            "yFields": [
                "number"
            ],
            "title": "Percentage Gauge",
            "priority": 1
        }
    },
    {
        "id": "rule_percentage",
        "description": "Column likely representing a percentage",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "Percentage Gauge",
            "priority": 2,
            "echartsHints": {
                "min": 0,
                "max": 100
            }
        }
    },
    {
        "id": "rule_kpi",
        "description": "Single numeric value, likely a KPI",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "KPI",
            "priority": 1,
            "echartsHints": {
                "detail": {
                    "formatter": "{value}"
                }
            }
        }
    },
    {
        "id": "rule_009",
        "description": "Single number column",
        "suggestion": {
            "chartType": "gauge",
            "yFields": [
                "number"
            ],
            "title": "Gauge",
            "priority": 1
        }
    },
    {
        "id": "rule_015",
        "description": "KPI column",
        "suggestion": {
            "chartType": "gauge",
            "yFields": [
                "number"
            ],
            "title": "KPI Gauge",
            "priority": 1
        }
    },
    {
        "id": "rule_014",
        "description": "A column that appears to be a percentage",
        "suggestion": {
            "chartType": "gauge",
            "xField": null,
            "yFields": [
                "pct"
            ],
            "title": "Percentage gauge",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "gauge",
                    "min": 0,
                    "max": 100
                }
            }
        }
    },
    {
        "id": "rule_009",
        "description": "Single numeric column only",
        "suggestion": {
            "chartType": "gauge",
            "xField": "",
            "seriesField": "",
            "title": "{yFields[0]} gauge",
            "priority": 2,
            "echartsHints": {
                "series": [
                    {
                        "detail": {
                            "formatter": "{value}"
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_008",
        "description": "Applies when the result has exactly 2 text columns and 1 numeric column (good for a pivot-style heatmap).",
        "suggestion": {
            "chartType": "heatmap",
            "xField": "__TEXT_0__",
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": "__TEXT_1__",
            "title": "{{__NUM_0__}} by {{__TEXT_0__}} × {{__TEXT_1__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "text",
                        "mode": "maxCardinality"
                    },
                    "series": {
                        "type": "text",
                        "mode": "otherTextThanX"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__TEXT_0__",
                        "__TEXT_1__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_0__",
                            "op": "sum"
                        }
                    ]
                },
                "tooltip": {
                    "position": "top"
                },
                "grid": {
                    "containLabel": true
                },
                "xAxis": {
                    "type": "category",
                    "splitArea": {
                        "show": true
                    }
                },
                "yAxis": {
                    "type": "category",
                    "splitArea": {
                        "show": true
                    }
                },
                "visualMap": {
                    "type": "continuous",
                    "calculable": true,
                    "orient": "horizontal",
                    "left": "center",
                    "bottom": 0
                },
                "series": {
                    "type": "heatmap",
                    "emphasis": {
                        "itemStyle": {
                            "shadowBlur": 10
                        }
                    }
                }
            }
        }
    },
    {
        "id": "rule_008",
        "description": "Matrix distribution of a value across two categories",
        "suggestion": {
            "chartType": "heatmap",
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "category"
                },
                "visualMap": {
                    "calculable": true,
                    "orient": "horizontal",
                    "left": "center",
                    "bottom": "15%"
                }
            }
        }
    },
    {
        "id": "rule_008",
        "description": "Two text columns and one number column — heatmap with texts as axes",
        "suggestion": {
            "chartType": "heatmap",
            "priority": 2,
            "echartsHints": {
                "xAxis": {
                    "type": "category"
                },
                "yAxis": {
                    "type": "category"
                },
                "visualMap": {
                    "min": 0,
                    "max": "auto",
                    "calculable": true,
                    "orient": "horizontal",
                    "left": "center",
                    "bottom": "0%"
                },
                "tooltip": {
                    "trigger": "item"
                }
            }
        }
    },
    {
        "id": "rule_008",
        "description": "Two text columns and one number column",
        "suggestion": {
            "chartType": "heatmap",
            "xField": "text",
            "yFields": [
                "text"
            ],
            "seriesField": "number",
            "title": "Heatmap",
            "priority": 1
        }
    },
    {
        "id": "rule_006",
        "description": "Three or more numeric columns, no date or text",
        "suggestion": {
            "chartType": "heatmap",
            "xField": "",
            "seriesField": "",
            "title": "Correlation heatmap",
            "priority": 3,
            "echartsHints": {
                "visualMap": {
                    "show": true
                }
            }
        }
    },
    {
        "id": "rule_111_cgm_glucose_timeseries",
        "description": "CGM dataset (timestamp + glucose; optional insulin): suggest glucose-over-time line with clinical bands/thresholds and zoom.",
        "suggestion": {
            "chartType": "line",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "CGM Glucose Over Time",
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                },
                "xAxis": {
                    "type": "time"
                },
                "yAxis": {
                    "type": "value",
                    "name": "Glucose",
                    "scale": true
                },
                "dataZoom": [
                    {
                        "type": "inside",
                        "throttle": 50
                    },
                    {
                        "type": "slider"
                    }
                ],
                "series": [
                    {
                        "type": "line",
                        "showSymbol": false,
                        "connectNulls": true,
                        "markLine": {
                            "silent": true,
                            "data": [
                                {
                                    "yAxis": 70,
                                    "name": "Low (mg/dL)"
                                },
                                {
                                    "yAxis": 180,
                                    "name": "High (mg/dL)"
                                }
                            ]
                        },
                        "markArea": {
                            "silent": true,
                            "itemStyle": {
                                "opacity": 0.08
                            },
                            "data": [
                                [
                                    {
                                        "yAxis": 70
                                    },
                                    {
                                        "yAxis": 180
                                    }
                                ]
                            ]
                        }
                    }
                ],
                "__fieldRoles": {
                    "time": [
                        "time",
                        "timestamp",
                        "date",
                        "reading",
                        "sample",
                        "logged"
                    ],
                    "glucose": [
                        "glucose",
                        "cgm",
                        "bg",
                        "mg/dl",
                        "mgdl",
                        "mmol"
                    ],
                    "insulin": [
                        "insulin",
                        "bolus",
                        "basal",
                        "units",
                        "u"
                    ]
                },
                "__note": "If insulin is present, add a secondary bar series on yAxisIndex:1 (right axis). Adjust thresholds for mmol/L if needed."
            }
        }
    },
    {
        "id": "rule_113_sleep_stage_hypnogram",
        "description": "Sleep stages over time (timestamp + stage categories): suggest a step-line hypnogram (categorical Y).",
        "suggestion": {
            "chartType": "line",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Sleep Stages Over Time",
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                },
                "xAxis": {
                    "type": "time"
                },
                "yAxis": {
                    "type": "category",
                    "name": "Stage",
                    "inverse": true
                },
                "dataZoom": [
                    {
                        "type": "inside",
                        "throttle": 50
                    },
                    {
                        "type": "slider"
                    }
                ],
                "series": [
                    {
                        "type": "line",
                        "step": "middle",
                        "showSymbol": false,
                        "connectNulls": true
                    }
                ],
                "__fieldRoles": {
                    "time": [
                        "time",
                        "timestamp",
                        "date",
                        "sleep_log",
                        "log_id"
                    ],
                    "stage": [
                        "sleep_stage",
                        "stage",
                        "state"
                    ],
                    "hrv": [
                        "rmssd",
                        "hrv"
                    ]
                },
                "__note": "If RMSSD/HRV exists, consider a second panel/axis for a numeric trend; keep the stage hypnogram categorical."
            }
        }
    },
    {
        "id": "rule_104_large_timeseries_perf",
        "description": "Many rows with one date + one number: suggest a performant time-series line (sampling, no symbols, zoom).",
        "suggestion": {
            "chartType": "line",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Trend over Time",
            "priority": 1,
            "echartsHints": {
                "animation": false,
                "tooltip": {
                    "trigger": "axis"
                },
                "xAxis": {
                    "type": "time"
                },
                "yAxis": {
                    "type": "value",
                    "scale": true
                },
                "dataZoom": [
                    {
                        "type": "inside",
                        "throttle": 50
                    },
                    {
                        "type": "slider"
                    }
                ],
                "series": [
                    {
                        "type": "line",
                        "showSymbol": false,
                        "sampling": "lttb",
                        "lineStyle": {
                            "width": 1
                        },
                        "emphasis": {
                            "focus": "series"
                        }
                    }
                ],
                "__perf": {
                    "showSymbol": false,
                    "sampling": "lttb",
                    "animation": false
                }
            }
        }
    },
    {
        "id": "rule_002",
        "description": "Applies when the result has exactly 1 date column and 2+ numeric columns (multi-metric time series).",
        "suggestion": {
            "chartType": "line",
            "xField": "__DATE_0__",
            "yFields": [
                "__NUM_ALL__"
            ],
            "seriesField": null,
            "title": "Trends over time (multiple metrics)",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "date",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "all"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__DATE_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_ALL__",
                            "op": "sum"
                        }
                    ],
                    "sortBy": "__DATE_0__"
                },
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "type": "scroll"
                },
                "series": {
                    "type": "line",
                    "showSymbol": false,
                    "connectNulls": true
                }
            }
        }
    },
    {
        "id": "rule_012",
        "description": "Applies when the result has exactly 1 date, 1 low-cardinality text (series), and 1 numeric column (segmented time series).",
        "suggestion": {
            "chartType": "line",
            "xField": "__DATE_0__",
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": "__TEXT_0__",
            "title": "{{__NUM_0__}} over time by {{__TEXT_0__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "date",
                        "mode": "only"
                    },
                    "series": {
                        "type": "text",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__DATE_0__",
                        "__TEXT_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_0__",
                            "op": "sum"
                        }
                    ],
                    "sortBy": "__DATE_0__"
                },
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "type": "scroll"
                },
                "series": {
                    "type": "line",
                    "showSymbol": false,
                    "connectNulls": true
                }
            }
        }
    },
    {
        "id": "rule_001",
        "description": "Applies when the result has exactly 1 date column and 1 numeric column (time series).",
        "suggestion": {
            "chartType": "line",
            "xField": "__DATE_0__",
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": null,
            "title": "{{__NUM_0__}} over time",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "date",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__DATE_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_0__",
                            "op": "sum"
                        }
                    ],
                    "sortBy": "__DATE_0__"
                },
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "series": {
                    "type": "line",
                    "showSymbol": false,
                    "connectNulls": true
                }
            }
        }
    },
    {
        "id": "rule_cgm_001",
        "description": "CGM glucose data with timestamp and optional insulin delivery",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": "number",
            "title": "Glucose Levels Over Time",
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "yAxis": {
                    "type": "value",
                    "name": "Glucose (mg/dL)",
                    "min": 40,
                    "max": 400,
                    "splitLine": {
                        "show": true
                    }
                },
                "markArea": [
                    {
                        "name": "Normal",
                        "itemStyle": {
                            "color": "rgba(0, 255, 0, 0.1)"
                        },
                        "data": [
                            [
                                {
                                    "yAxis": 70
                                },
                                {
                                    "yAxis": 180
                                }
                            ]
                        ]
                    },
                    {
                        "name": "Low",
                        "itemStyle": {
                            "color": "rgba(255, 0, 0, 0.1)"
                        },
                        "data": [
                            [
                                {
                                    "yAxis": 0
                                },
                                {
                                    "yAxis": 70
                                }
                            ]
                        ]
                    },
                    {
                        "name": "High",
                        "itemStyle": {
                            "color": "rgba(255, 165, 0, 0.1)"
                        },
                        "data": [
                            [
                                {
                                    "yAxis": 180
                                },
                                {
                                    "yAxis": 400
                                }
                            ]
                        ]
                    }
                ],
                "series": [
                    {
                        "name": "Glucose",
                        "type": "line",
                        "smooth": true,
                        "lineStyle": {
                            "width": 2
                        },
                        "itemStyle": {
                            "borderWidth": 0
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_111",
        "description": "CGM-style dataset: glucose + timestamp (+ optional insulin) → glucose time-series with target band; insulin as secondary-axis bars.",
        "suggestion": {
            "chartType": "line",
            "xField": "{{timestamp}}",
            "yFields": [
                "{{glucose}}",
                "{{insulin}}"
            ],
            "seriesField": null,
            "title": "Glucose over time",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "timestamp": {
                        "type": "date",
                        "nameMatches": [
                            "timestamp",
                            "time",
                            "date",
                            "reading"
                        ],
                        "strategy": "bestMatch"
                    },
                    "glucose": {
                        "type": "number",
                        "nameMatches": [
                            "glucose",
                            "cgm",
                            "bg"
                        ],
                        "strategy": "bestMatch"
                    },
                    "insulin": {
                        "type": "number",
                        "nameMatches": [
                            "insulin",
                            "bolus",
                            "basal",
                            "units"
                        ],
                        "strategy": "optionalBestMatch"
                    }
                },
                "preprocess": {
                    "timeSort": true
                },
                "option": {
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "xAxis": {
                        "type": "time"
                    },
                    "yAxis": [
                        {
                            "type": "value",
                            "name": "Glucose"
                        },
                        {
                            "type": "value",
                            "name": "Insulin",
                            "min": 0
                        }
                    ],
                    "dataZoom": [
                        {
                            "type": "inside"
                        },
                        {
                            "type": "slider"
                        }
                    ],
                    "series": [
                        {
                            "name": "Glucose",
                            "type": "line",
                            "showSymbol": false,
                            "connectNulls": false,
                            "markLine": {
                                "silent": true,
                                "data": [
                                    {
                                        "yAxis": 70
                                    },
                                    {
                                        "yAxis": 180
                                    }
                                ]
                            },
                            "markArea": {
                                "silent": true,
                                "itemStyle": {
                                    "opacity": 0.08
                                },
                                "data": [
                                    [
                                        {
                                            "yAxis": 70
                                        },
                                        {
                                            "yAxis": 180
                                        }
                                    ]
                                ]
                            }
                        },
                        {
                            "name": "Insulin",
                            "type": "bar",
                            "yAxisIndex": 1,
                            "barWidth": 6,
                            "opacity": 0.5
                        }
                    ]
                },
                "dynamic": {
                    "unitsInference": "mgdlVsMmol",
                    "insulinSeriesEnabledIfFieldPresent": true
                }
            }
        }
    },
    {
        "id": "rule_perf_001",
        "description": "Large time-series dataset; suggests aggregation or sampling",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": "number",
            "seriesField": null,
            "title": "Time Series (Large Dataset)",
            "priority": 2,
            "echartsHints": {
                "sampling": "lttb",
                "large": true,
                "largeThreshold": 2000,
                "animation": false,
                "lineStyle": {
                    "width": 1
                },
                "progressive": 1000,
                "progressiveThreshold": 3000,
                "progressiveAnimation": false
            }
        }
    },
    {
        "id": "rule_107_log_scale_wide_range",
        "description": "Numeric metric spans a very wide positive range (max/min > 1000): suggest log-scale Y axis.",
        "suggestion": {
            "chartType": "line",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Trend (Log Scale)",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "axis"
                },
                "yAxis": {
                    "type": "log",
                    "minorSplitLine": {
                        "show": true
                    }
                },
                "series": [
                    {
                        "type": "line",
                        "showSymbol": false
                    }
                ],
                "__requiresPositiveValues": true,
                "__note": "Use log axis only when values are strictly > 0; otherwise fall back to linear + outlier handling."
            }
        }
    },
    {
        "id": "rule_012",
        "description": "One date, one text, and one number column — multi-series line chart grouped by the text column",
        "suggestion": {
            "chartType": "line",
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "show": true,
                    "type": "scroll"
                },
                "dataZoom": [
                    {
                        "type": "slider",
                        "start": 0,
                        "end": 100
                    }
                ]
            }
        }
    },
    {
        "id": "rule_104",
        "description": "One date + one number with many rows (>500) → performance-tuned time-series line.",
        "suggestion": {
            "chartType": "line",
            "xField": "{{date}}",
            "yFields": [
                "{{number}}"
            ],
            "seriesField": null,
            "title": "{{number}} over time",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "date": {
                        "type": "date",
                        "strategy": "only"
                    },
                    "number": {
                        "type": "number",
                        "strategy": "only"
                    }
                },
                "preprocess": {
                    "timeSort": true,
                    "timeBin": "autoIfVeryDense"
                },
                "option": {
                    "animation": false,
                    "xAxis": {
                        "type": "time"
                    },
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "dataZoom": [
                        {
                            "type": "inside",
                            "throttle": 50
                        }
                    ],
                    "series": [
                        {
                            "type": "line",
                            "showSymbol": false,
                            "symbol": "none",
                            "sampling": "lttb",
                            "lineStyle": {
                                "width": 1
                            }
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_107",
        "description": "Numeric field has max/min ratio > 1000 (and min > 0) → use log y-axis for readability.",
        "suggestion": {
            "chartType": "line",
            "xField": "{{dimension}}",
            "yFields": [
                "{{wideNumber}}"
            ],
            "seriesField": null,
            "title": "{{wideNumber}} (log scale)",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "wideNumber": {
                        "type": "number",
                        "strategy": "maxRangeRatio"
                    },
                    "dimension": {
                        "type": [
                            "date",
                            "text"
                        ],
                        "strategy": "dateElseMinCardText"
                    }
                },
                "option": {
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "yAxis": {
                        "type": "log",
                        "logBase": 10,
                        "minorTick": {
                            "show": true
                        },
                        "minorSplitLine": {
                            "show": true
                        }
                    },
                    "series": [
                        {
                            "type": "line",
                            "showSymbol": false
                        }
                    ]
                },
                "dynamic": {
                    "xAxisType": "timeIfDateElseCategory",
                    "nonPositiveHandling": "filterOrClampToEpsilon"
                }
            }
        }
    },
    {
        "id": "rule_001",
        "description": "Time series data showing a single metric over time",
        "suggestion": {
            "chartType": "line",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "series": [
                    {
                        "smooth": true,
                        "areaStyle": {}
                    }
                ]
            }
        }
    },
    {
        "id": "rule_012",
        "description": "Time series split by category",
        "suggestion": {
            "chartType": "line",
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "legend": {
                    "show": true
                }
            }
        }
    },
    {
        "id": "rule_001",
        "description": "Exactly one date column and one number column — time-series line chart",
        "suggestion": {
            "chartType": "line",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                },
                "dataZoom": [
                    {
                        "type": "slider",
                        "start": 0,
                        "end": 100
                    }
                ]
            }
        }
    },
    {
        "id": "rule_016",
        "description": "High-density time series requiring performance optimizations",
        "suggestion": {
            "chartType": "line",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "dataZoom": [
                    {
                        "type": "inside"
                    },
                    {
                        "type": "slider"
                    }
                ],
                "series": [
                    {
                        "showSymbol": false,
                        "sampling": "lttb"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_023",
        "description": "Continuous Glucose Monitoring data with clinical target ranges",
        "suggestion": {
            "chartType": "line",
            "title": "Ambulatory Glucose Profile",
            "priority": 1,
            "echartsHints": {
                "yAxis": {
                    "name": "mg/dL"
                },
                "series": [
                    {
                        "type": "line",
                        "markArea": {
                            "itemStyle": {
                                "color": "rgba(0, 255, 0, 0.1)"
                            },
                            "data": [
                                [
                                    {
                                        "yAxis": 70
                                    },
                                    {
                                        "yAxis": 180
                                    }
                                ]
                            ]
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_025",
        "description": "Hypnogram displaying discrete sleep stages over the night",
        "suggestion": {
            "chartType": "line",
            "seriesField": null,
            "title": "Sleep Architecture (Hypnogram)",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "line",
                        "step": "start"
                    }
                ],
                "yAxis": {
                    "type": "category",
                    "data": [
                        "Deep",
                        "Light",
                        "REM",
                        "Awake"
                    ]
                }
            }
        }
    },
    {
        "id": "rule_023",
        "description": "A column with glucose values (from CGM) in mg/dl or mmol/dl, a column for date/reading timestamp, and sometimes a column for insulin delivered.",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "glucose"
            ],
            "seriesField": "insulin",
            "title": "Glucose levels over time",
            "priority": 1,
            "echartsHints": {
                "series": {
                    "type": "line"
                }
            }
        }
    },
    {
        "id": "rule_113",
        "description": "Sleep stages over time (awake/light/deep/REM) → hypnogram (step line on categorical y-axis); optional HRV RMSSD as second panel.",
        "suggestion": {
            "chartType": "line",
            "xField": "{{timestamp}}",
            "yFields": [
                "{{sleepStage}}"
            ],
            "seriesField": null,
            "title": "Sleep stages over time",
            "priority": 2,
            "echartsHints": {
                "pick": {
                    "timestamp": {
                        "type": "date",
                        "nameMatches": [
                            "timestamp",
                            "time",
                            "date",
                            "ts"
                        ],
                        "strategy": "bestMatch"
                    },
                    "sleepStage": {
                        "type": "text",
                        "nameMatches": [
                            "stage"
                        ],
                        "strategy": "bestMatch"
                    },
                    "hrv": {
                        "type": "number",
                        "nameMatches": [
                            "hrv",
                            "rmssd"
                        ],
                        "strategy": "optionalBestMatch"
                    }
                },
                "preprocess": {
                    "type": "normalizeSleepStages",
                    "field": "{{sleepStage}}",
                    "stageOrder": [
                        "Awake",
                        "REM",
                        "Light",
                        "Deep"
                    ]
                },
                "option": {
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "xAxis": {
                        "type": "time"
                    },
                    "yAxis": {
                        "type": "category"
                    },
                    "dataZoom": [
                        {
                            "type": "inside"
                        }
                    ],
                    "series": [
                        {
                            "type": "line",
                            "step": "end",
                            "symbol": "none",
                            "lineStyle": {
                                "width": 2
                            },
                            "connectNulls": false
                        }
                    ]
                },
                "dynamic": {
                    "enableSecondPanelIfHRVPresent": true
                }
            }
        }
    },
    {
        "id": "rule_002",
        "description": "Time series data comparing multiple metrics",
        "suggestion": {
            "chartType": "line",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "time"
                },
                "tooltip": {
                    "trigger": "axis"
                }
            }
        }
    },
    {
        "id": "rule_002",
        "description": "One date column with two or more numeric columns",
        "suggestion": {
            "chartType": "line",
            "seriesField": "",
            "title": "Multiple trends over {xField}",
            "priority": 1,
            "echartsHints": {
                "legend": {
                    "show": true
                }
            }
        }
    },
    {
        "id": "rule_012",
        "description": "Date + text + numeric columns (any cardinalities)",
        "suggestion": {
            "chartType": "line",
            "title": "{yFields[0]} over {xField} by {seriesField}",
            "priority": 1,
            "echartsHints": {
                "legend": {
                    "show": true
                }
            }
        }
    },
    {
        "id": "rule_019",
        "description": "Numeric data with extreme outliers or exponential growth",
        "suggestion": {
            "chartType": "line",
            "seriesField": null,
            "title": "Exponential / Wide Range Metrics",
            "priority": 1,
            "echartsHints": {
                "yAxis": {
                    "type": "log",
                    "minorTick": {
                        "show": true
                    }
                }
            }
        }
    },
    {
        "id": "rule_111",
        "description": "Glucose (mg/dL or mmol/L) with timestamp, optional insulin column",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": "",
            "title": "Continuous Glucose Monitoring",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "line"
                    },
                    {
                        "type": "scatter",
                        "data": [],
                        "encode": {
                            "x": "timestamp",
                            "y": "insulin"
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_102",
        "description": "Numeric column name suggests percent/rate and values appear 0–100 → format axis/tooltip as percent and clamp to 0–100.",
        "suggestion": {
            "chartType": "line",
            "xField": "{{dimension}}",
            "yFields": [
                "{{percent}}"
            ],
            "seriesField": null,
            "title": "{{percent}} (percent)",
            "priority": 2,
            "echartsHints": {
                "pick": {
                    "percent": {
                        "type": "number",
                        "nameMatches": [
                            "pct",
                            "percent",
                            "rate",
                            "ratio"
                        ],
                        "strategy": "bestMatch"
                    },
                    "dimension": {
                        "type": [
                            "date",
                            "text"
                        ],
                        "strategy": "dateElseMinCardText"
                    }
                },
                "option": {
                    "yAxis": {
                        "type": "value",
                        "min": 0,
                        "max": 100,
                        "axisLabel": {
                            "formatter": "{value}%"
                        }
                    },
                    "tooltip": {
                        "trigger": "axis"
                    },
                    "series": [
                        {
                            "type": "line",
                            "showSymbol": false
                        }
                    ]
                },
                "dynamic": {
                    "xAxisType": "timeIfDateElseCategory",
                    "tooltipValueFormatter": "appendPercentSign"
                }
            }
        }
    },
    {
        "id": "rule_cgm_data",
        "description": "CGM data with glucose values and timestamp",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "CGM Glucose Levels Over Time",
            "priority": 1,
            "echartsHints": {
                "markLine": {
                    "data": [
                        {
                            "yAxis": 70
                        },
                        {
                            "yAxis": 180
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_001",
        "description": "One date column and exactly one numeric column",
        "suggestion": {
            "chartType": "line",
            "seriesField": "",
            "title": "Trend of {yFields[0]} over {xField}",
            "priority": 1,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_001",
        "description": "One date + one number",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "title": "Trend over time",
            "priority": 1,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_012",
        "description": "Date + text + number (three column combo)",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": "text",
            "title": "Trend over time by category",
            "priority": 1,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_019",
        "description": "Wide range numeric column",
        "suggestion": {
            "chartType": "line",
            "yFields": [
                "number"
            ],
            "echartsHints": {
                "yAxis": {
                    "type": "log"
                }
            },
            "title": "Wide Range Line Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_023",
        "description": "Glucose monitoring data",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "title": "Glucose Monitoring Line Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_025",
        "description": "Sleep data",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "text"
            ],
            "title": "Sleep Line Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_104",
        "description": ">500 rows with one date and one number – consider performance",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": "",
            "title": "`{xField}` trend (large dataset)",
            "priority": 2,
            "echartsHints": {
                "series": [
                    {
                        "large": true,
                        "largeThreshold": 2000
                    }
                ]
            }
        }
    },
    {
        "id": "rule_001",
        "description": "One date column and one number column",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "title": "Time Series",
            "priority": 1
        }
    },
    {
        "id": "rule_025",
        "description": "A column for date/time stamp/sleep log id and a column for sleep stage (e.g. awake, light, deep, REM), and possibly a column for HRV RMSSD (average or non-aggregated)",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "stage"
            ],
            "seriesField": "hrv",
            "title": "Sleep stages over time",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "line"
                }
            }
        }
    },
    {
        "id": "rule_016",
        "description": "Large dataset with date and number columns",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "echartsHints": {},
            "title": "Large Dataset Line Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_log_scale",
        "description": "Numeric column with a wide range",
        "suggestion": {
            "chartType": "line",
            "xField": null,
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "Log Scale Chart",
            "priority": 2,
            "echartsHints": {
                "yAxis": {
                    "type": "log"
                }
            }
        }
    },
    {
        "id": "rule_016",
        "description": "Many rows (>500) with one date and one number",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "title": "Trend over time (large dataset)",
            "priority": 2,
            "echartsHints": {
                "animation": false
            }
        }
    },
    {
        "id": "rule_large_date_number",
        "description": "Large dataset with date and number columns",
        "suggestion": {
            "chartType": "line",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": null,
            "title": "Time Series",
            "priority": 2,
            "echartsHints": {
                "sampling": "average",
                "symbol": "none"
            }
        }
    },
    {
        "id": "rule_009",
        "description": "A single aggregated metric or distribution",
        "suggestion": {
            "xField": null,
            "seriesField": null,
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_011",
        "description": "Value breakdown by a binary state",
        "suggestion": {
            "chartType": "pie",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "pie",
                        "radius": [
                            "40%",
                            "70%"
                        ]
                    }
                ],
                "tooltip": {
                    "trigger": "item"
                }
            }
        }
    },
    {
        "id": "rule_105_binary_dimension_distribution",
        "description": "A column with exactly 2 unique values: suggest a distribution chart (pie of counts).",
        "suggestion": {
            "chartType": "pie",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Binary Split (Count of Rows)",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item"
                },
                "legend": {
                    "type": "scroll"
                },
                "series": [
                    {
                        "type": "pie",
                        "radius": [
                            "40%",
                            "70%"
                        ],
                        "avoidLabelOverlap": true,
                        "label": {
                            "formatter": "{b}\n{d}%"
                        }
                    }
                ],
                "__aggregate": {
                    "value": "count"
                },
                "__note": "If a numeric measure exists, consider bar chart of avg/sum by the binary flag."
            }
        }
    },
    {
        "id": "rule_010",
        "description": "Applies when the result has only 1 text column: show category frequency (counts) as a pie/donut.",
        "suggestion": {
            "chartType": "pie",
            "xField": "__TEXT_0__",
            "yFields": [],
            "seriesField": null,
            "title": "Count of records by {{__TEXT_0__}}",
            "priority": 2,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "text",
                        "mode": "only"
                    }
                },
                "aggregation": {
                    "groupBy": [
                        "__TEXT_0__"
                    ],
                    "metrics": [
                        {
                            "field": "*",
                            "op": "count"
                        }
                    ],
                    "sortBy": "count",
                    "order": "desc",
                    "topN": 10,
                    "otherBucketLabel": "Other"
                },
                "tooltip": {
                    "trigger": "item"
                },
                "legend": {
                    "type": "scroll"
                },
                "series": {
                    "type": "pie",
                    "radius": [
                        "40%",
                        "70%"
                    ],
                    "avoidLabelOverlap": true
                }
            }
        }
    },
    {
        "id": "rule_binary_001",
        "description": "Column with exactly 2 unique values (binary categorical)",
        "suggestion": {
            "chartType": "pie",
            "xField": null,
            "yFields": [],
            "seriesField": "text",
            "title": "Binary Distribution",
            "priority": 2,
            "echartsHints": {
                "type": "pie",
                "radius": [
                    "40%",
                    "70%"
                ],
                "avoidLabelOverlap": false,
                "itemStyle": {
                    "borderRadius": 10,
                    "borderColor": "#fff",
                    "borderWidth": 2
                },
                "label": {
                    "show": true,
                    "position": "outside"
                },
                "emphasis": {
                    "label": {
                        "show": true,
                        "fontSize": 16,
                        "fontWeight": "bold"
                    }
                }
            }
        }
    },
    {
        "id": "rule_017",
        "description": "Value breakdown by a binary/two-state category",
        "suggestion": {
            "chartType": "pie",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "pie",
                        "radius": [
                            "40%",
                            "70%"
                        ],
                        "itemStyle": {
                            "borderRadius": 10
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_017",
        "description": "Binary column",
        "suggestion": {
            "chartType": "pie",
            "seriesField": "text",
            "title": "Binary Pie Chart",
            "priority": 1
        }
    },
    {
        "id": "rule_007",
        "description": "One low‑cardinality text, one numeric, plus a high‑cardinality text column",
        "suggestion": {
            "chartType": "pie",
            "xField": "",
            "title": "{yFields[0]} distribution by {seriesField}",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_105",
        "description": "Single column with cardinality === 2 → donut pie showing distribution (counts).",
        "suggestion": {
            "chartType": "pie",
            "xField": "{{binary}}",
            "yFields": [],
            "seriesField": null,
            "title": "Distribution of {{binary}}",
            "priority": 3,
            "echartsHints": {
                "pick": {
                    "binary": {
                        "strategy": "only"
                    }
                },
                "preprocess": {
                    "groupBy": "{{binary}}",
                    "metrics": [
                        {
                            "op": "count"
                        }
                    ]
                },
                "option": {
                    "tooltip": {
                        "trigger": "item"
                    },
                    "legend": {
                        "top": "bottom"
                    },
                    "series": [
                        {
                            "type": "pie",
                            "radius": [
                                "45%",
                                "70%"
                            ],
                            "avoidLabelOverlap": true,
                            "label": {
                                "formatter": "{b}: {d}% ({c})"
                            }
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_binary",
        "description": "Column with binary values",
        "suggestion": {
            "chartType": "pie",
            "xField": null,
            "yFields": [
                "text"
            ],
            "seriesField": null,
            "title": "Binary Distribution",
            "priority": 2,
            "echartsHints": {
                "roseType": "area"
            }
        }
    },
    {
        "id": "rule_010",
        "description": "Frequency distribution of categories",
        "suggestion": {
            "chartType": "pie",
            "xField": null,
            "yFields": null,
            "priority": 3,
            "echartsHints": {
                "series": [
                    {
                        "type": "pie",
                        "radius": "50%"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_010",
        "description": "Single text column only",
        "suggestion": {
            "chartType": "pie",
            "xField": null,
            "yFields": [
                "text"
            ],
            "title": "Text distribution",
            "priority": 3,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_017",
        "description": "A column with exactly 2 unique values (binary/boolean-like)",
        "suggestion": {
            "chartType": "pie",
            "xField": null,
            "yFields": "number",
            "title": "Binary distribution",
            "priority": 3,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_114",
        "description": "Study ID + participant ID + % compliance / wear time – radar chart",
        "suggestion": {
            "chartType": "radar",
            "xField": "",
            "yFields": "number",
            "seriesField": "",
            "title": "Participant compliance overview",
            "priority": 2,
            "echartsHints": {
                "radar": {
                    "indicator": []
                },
                "tooltip": {
                    "trigger": "item"
                }
            }
        }
    },
    {
        "id": "rule_006",
        "description": "Multidimensional numeric assessment",
        "suggestion": {
            "chartType": "radar",
            "xField": null,
            "seriesField": null,
            "title": "Multidimensional Analysis",
            "priority": 2,
            "echartsHints": {
                "radar": {
                    "indicator": []
                }
            }
        }
    },
    {
        "id": "rule_114_study_participant_compliance_scatter",
        "description": "Study/participant dataset with compliance & wear-time metrics: suggest participant-level scatter (colored by study/status).",
        "suggestion": {
            "chartType": "scatter",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Participant Metrics (Compliance vs Wear Time)",
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item"
                },
                "legend": {
                    "type": "scroll"
                },
                "xAxis": {
                    "type": "value",
                    "name": "Metric X",
                    "axisLabel": {
                        "formatter": "{value}%"
                    }
                },
                "yAxis": {
                    "type": "value",
                    "name": "Metric Y",
                    "axisLabel": {
                        "formatter": "{value}%"
                    }
                },
                "series": [
                    {
                        "type": "scatter",
                        "symbolSize": 6,
                        "large": true,
                        "largeThreshold": 2000
                    }
                ],
                "dataZoom": [
                    {
                        "type": "inside"
                    },
                    {
                        "type": "slider"
                    }
                ],
                "__fieldRoles": {
                    "study": [
                        "study",
                        "study_id",
                        "study_name"
                    ],
                    "participant": [
                        "participant",
                        "subject",
                        "pid",
                        "user"
                    ],
                    "x": [
                        "compliance",
                        "adherence",
                        "compliance_pct",
                        "wear_pct",
                        "wear_time_pct"
                    ],
                    "y": [
                        "wear",
                        "wear_time",
                        "wear_time_pct",
                        "device_wear_time",
                        "compliance"
                    ],
                    "status": [
                        "enrollment_status",
                        "status",
                        "state"
                    ]
                },
                "__note": "If you have total wear time (hours/minutes) plus percent metrics, consider using size encoding or a secondary axis in a separate chart."
            }
        }
    },
    {
        "id": "rule_101_lat_lon_scatter",
        "description": "Detect latitude/longitude columns and suggest a coordinate scatter plot (optionally upgraded to geo-map if available).",
        "suggestion": {
            "chartType": "scatter",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Locations (Latitude/Longitude)",
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "value",
                    "name": "Longitude",
                    "scale": true
                },
                "yAxis": {
                    "type": "value",
                    "name": "Latitude",
                    "scale": true
                },
                "tooltip": {
                    "trigger": "item"
                },
                "series": [
                    {
                        "type": "scatter",
                        "symbolSize": 6,
                        "emphasis": {
                            "focus": "series"
                        }
                    }
                ],
                "__fieldRoles": {
                    "x": [
                        "lon",
                        "lng",
                        "longitude"
                    ],
                    "y": [
                        "lat",
                        "latitude"
                    ]
                },
                "__note": "If you have a geo basemap, consider coordinateSystem:\"geo\" + geo component; otherwise keep cartesian scatter."
            }
        }
    },
    {
        "id": "rule_study_001",
        "description": "Clinical study data with study/participant ID and compliance, wear time, enrollment metrics",
        "suggestion": {
            "chartType": "scatter",
            "xField": "number",
            "yFields": [
                "number"
            ],
            "seriesField": "text",
            "title": "Study Participant Compliance & Wear Time",
            "priority": 1,
            "echartsHints": {
                "type": "scatter",
                "xAxis": {
                    "type": "value",
                    "name": "Compliance (%)",
                    "min": 0,
                    "max": 100,
                    "markLine": {
                        "data": [
                            {
                                "yAxis": 80,
                                "name": "Target (80%)"
                            }
                        ]
                    }
                },
                "yAxis": {
                    "type": "value",
                    "name": "Wear Time (hours)",
                    "markLine": {
                        "data": [
                            {
                                "yAxis": 168,
                                "name": "Target (1 week)"
                            }
                        ]
                    }
                },
                "itemStyle": {
                    "opacity": 0.6,
                    "borderColor": "#fff",
                    "borderWidth": 1
                },
                "emphasis": {
                    "itemStyle": {
                        "opacity": 1,
                        "borderWidth": 2
                    }
                }
            }
        }
    },
    {
        "id": "rule_005",
        "description": "Applies when the result has exactly 2 numeric columns (good candidate for scatter/correlation).",
        "suggestion": {
            "chartType": "scatter",
            "xField": "__NUM_0__",
            "yFields": [
                "__NUM_1__"
            ],
            "seriesField": null,
            "title": "{{__NUM_1__}} vs {{__NUM_0__}}",
            "priority": 1,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "number",
                        "mode": "maxCardinality"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "otherNumberThanX"
                        }
                    ]
                },
                "tooltip": {
                    "trigger": "item"
                },
                "xAxis": {
                    "type": "value",
                    "scale": true
                },
                "yAxis": {
                    "type": "value",
                    "scale": true
                },
                "series": {
                    "type": "scatter",
                    "large": true,
                    "largeThreshold": 2000
                }
            }
        }
    },
    {
        "id": "rule_101",
        "description": "Has latitude-like and longitude-like columns → plot points on a geo/map (or fallback to lon/lat scatter).",
        "suggestion": {
            "chartType": "scatter",
            "xField": "{{lon}}",
            "yFields": [
                "{{lat}}"
            ],
            "seriesField": null,
            "title": "Locations (lat/lon)",
            "priority": 1,
            "echartsHints": {
                "pick": {
                    "lat": {
                        "type": "number",
                        "nameMatches": [
                            "lat",
                            "latitude"
                        ],
                        "strategy": "bestMatch"
                    },
                    "lon": {
                        "type": "number",
                        "nameMatches": [
                            "lon",
                            "lng",
                            "longitude"
                        ],
                        "strategy": "bestMatch"
                    }
                },
                "preprocess": {
                    "type": "geoPoints",
                    "lonField": "{{lon}}",
                    "latField": "{{lat}}",
                    "valueFieldStrategy": "optionalBestNumericExcludingLatLon"
                },
                "option": {
                    "geo": {
                        "map": "world",
                        "roam": true,
                        "silent": false
                    },
                    "tooltip": {
                        "trigger": "item"
                    },
                    "series": [
                        {
                            "type": "scatter",
                            "coordinateSystem": "geo",
                            "symbolSize": 6,
                            "emphasis": {
                                "scale": true
                            }
                        }
                    ]
                },
                "fallbackOptionIfNoMapRegistered": {
                    "xAxis": {
                        "type": "value",
                        "name": "{{lon}}"
                    },
                    "yAxis": {
                        "type": "value",
                        "name": "{{lat}}"
                    },
                    "series": [
                        {
                            "type": "scatter"
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_geo_001",
        "description": "Detects latitude and longitude columns for geographic visualization",
        "suggestion": {
            "chartType": "scatter",
            "xField": "number",
            "yFields": [
                "text"
            ],
            "seriesField": null,
            "title": "Geographic Distribution",
            "priority": 1,
            "echartsHints": {
                "coordinateSystem": "cartesian2d",
                "symbolSize": 8,
                "itemStyle": {
                    "opacity": 0.7
                }
            }
        }
    },
    {
        "id": "rule_026",
        "description": "Participant device compliance and wear time in a clinical trial",
        "suggestion": {
            "chartType": "scatter",
            "title": "Participant Wear Compliance",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "scatter",
                        "markLine": {
                            "data": [
                                {
                                    "yAxis": 80,
                                    "name": "Compliance Threshold"
                                }
                            ],
                            "lineStyle": {
                                "color": "red",
                                "type": "dashed"
                            }
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_013",
        "description": "Geospatial scatter plot for latitude and longitude coordinates",
        "suggestion": {
            "chartType": "scatter",
            "seriesField": null,
            "title": "Geospatial Distribution",
            "priority": 1,
            "echartsHints": {
                "coordinateSystem": "cartesian2d",
                "xAxis": {
                    "type": "value",
                    "scale": true,
                    "name": "Longitude"
                },
                "yAxis": {
                    "type": "value",
                    "scale": true,
                    "name": "Latitude"
                }
            }
        }
    },
    {
        "id": "rule_013",
        "description": "A column named or containing lat/lon",
        "suggestion": {
            "chartType": "scatter",
            "xField": "lon",
            "yFields": [
                "lat"
            ],
            "title": "Geospatial scatter plot",
            "priority": 1,
            "echartsHints": {
                "geo": {
                    "map": "world"
                }
            }
        }
    },
    {
        "id": "rule_101",
        "description": "Columns named like 'lat'/'latitude' and 'lon'/'longitude'",
        "suggestion": {
            "chartType": "scatter",
            "xField": "number",
            "yFields": "number",
            "seriesField": "",
            "title": "Geospatial distribution",
            "priority": 1,
            "echartsHints": {
                "geo": {
                    "map": "world"
                },
                "series": [
                    {
                        "coordinateSystem": "geo"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_005",
        "description": "Correlation or distribution between two continuous variables",
        "suggestion": {
            "chartType": "scatter",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "xAxis": {
                    "type": "value",
                    "scale": true
                },
                "yAxis": {
                    "type": "value",
                    "scale": true
                }
            }
        }
    },
    {
        "id": "rule_005",
        "description": "Exactly two number columns with no date — scatter plot",
        "suggestion": {
            "chartType": "scatter",
            "seriesField": null,
            "priority": 1,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item"
                }
            }
        }
    },
    {
        "id": "rule_013",
        "description": "Latitude and Longitude columns",
        "suggestion": {
            "chartType": "scatter",
            "xField": "longitude",
            "yFields": [
                "latitude"
            ],
            "echartsHints": {
                "geo": {
                    "type": "map",
                    "map": "china"
                }
            },
            "title": "Geographic Scatter Plot",
            "priority": 1
        }
    },
    {
        "id": "rule_logscale_001",
        "description": "Numeric column with extreme range (max/min > 1000); log scale recommended",
        "suggestion": {
            "chartType": "scatter",
            "xField": "date",
            "yFields": "number",
            "seriesField": null,
            "title": "Wide-Range Numeric Data (Log Scale)",
            "priority": 2,
            "echartsHints": {
                "yAxis": {
                    "type": "log",
                    "logBase": 10,
                    "name": "Value (log scale)"
                },
                "symbolSize": 6,
                "itemStyle": {
                    "opacity": 0.6
                }
            }
        }
    },
    {
        "id": "rule_012",
        "description": "One date column, one text column, and one number column",
        "suggestion": {
            "chartType": "scatter",
            "xField": "date",
            "yFields": [
                "number"
            ],
            "seriesField": "text",
            "title": "Scatter Plot",
            "priority": 1
        }
    },
    {
        "id": "rule_019",
        "description": "A numeric column with wide range (log scale?)",
        "suggestion": {
            "chartType": "scatter",
            "xField": "number",
            "yFields": [],
            "title": "Log scale scatter plot",
            "priority": 2,
            "echartsHints": {
                "xAxis": {
                    "type": "log"
                },
                "yAxis": {
                    "type": "log"
                }
            }
        }
    },
    {
        "id": "rule_005",
        "description": "Exactly two numeric columns",
        "suggestion": {
            "chartType": "scatter",
            "seriesField": "",
            "title": "{yFields[0]} vs {xField}",
            "priority": 1,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_005",
        "description": "Two number columns",
        "suggestion": {
            "chartType": "scatter",
            "xField": "number",
            "yFields": [
                "number"
            ],
            "title": "Scatter Plot",
            "priority": 1
        }
    },
    {
        "id": "rule_006",
        "description": "Three or more number columns, no text or date",
        "suggestion": {
            "chartType": "scatter",
            "xField": "number",
            "yFields": "number",
            "title": "Multi-Scatter Plot",
            "priority": 1
        }
    },
    {
        "id": "rule_021",
        "description": "Nested hierarchical data requiring drill-down or part-to-whole view",
        "suggestion": {
            "chartType": "sunburst",
            "xField": null,
            "seriesField": null,
            "title": "Hierarchical Breakdown",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "sunburst",
                        "radius": [
                            "15%",
                            "80%"
                        ]
                    }
                ]
            }
        }
    },
    {
        "id": "rule_020",
        "description": "Two date columns",
        "suggestion": {
            "chartType": "timeline",
            "xField": "date",
            "yFields": [
                "date"
            ],
            "title": "Timeline",
            "priority": 1
        }
    },
    {
        "id": "rule_020",
        "description": "Two date columns (start/end — timeline or Gantt?)",
        "suggestion": {
            "chartType": "timeline",
            "xField": "date",
            "yFields": [
                "date"
            ],
            "title": "Timeline chart",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "timeline"
                }
            }
        }
    },
    {
        "id": "rule_109_category_subcategory_hierarchy",
        "description": "Category + subcategory columns suggest a hierarchy: use treemap (count or sum).",
        "suggestion": {
            "chartType": "treemap",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Hierarchy Breakdown (Category → Subcategory)",
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item"
                },
                "series": [
                    {
                        "type": "treemap",
                        "roam": true,
                        "leafDepth": 2,
                        "breadcrumb": {
                            "show": true
                        }
                    }
                ],
                "__hierarchyPath": [
                    "category",
                    "subcategory"
                ],
                "__aggregate": {
                    "value": "count",
                    "fallback": "sumFirstNumeric"
                }
            }
        }
    },
    {
        "id": "rule_hierarchy_001",
        "description": "Hierarchical text columns (category/subcategory, parent/child)",
        "suggestion": {
            "chartType": "treemap",
            "xField": "text",
            "yFields": [
                "number"
            ],
            "seriesField": "text",
            "title": "Hierarchical Breakdown",
            "priority": 2,
            "echartsHints": {
                "type": "treemap",
                "roam": false,
                "nodeClick": "zoomToNode",
                "label": {
                    "position": "inside",
                    "formatter": "{b}"
                },
                "itemStyle": {
                    "borderColor": "#fff",
                    "borderWidth": 2
                },
                "levels": [
                    {
                        "itemStyle": {
                            "borderColor": "#777",
                            "borderWidth": 0,
                            "gapWidth": 1
                        }
                    },
                    {
                        "itemStyle": {
                            "borderColor": "#555",
                            "borderWidth": 5,
                            "gapWidth": 1
                        },
                        "label": {
                            "show": false
                        }
                    },
                    {
                        "itemStyle": {
                            "borderColor": "#ddd",
                            "borderWidth": 5,
                            "gapWidth": 1
                        },
                        "label": {
                            "show": false
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_007",
        "description": "Distribution across many categories where a bar chart would be too crowded",
        "suggestion": {
            "chartType": "treemap",
            "xField": null,
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "type": "treemap",
                        "roam": "scale"
                    }
                ]
            }
        }
    },
    {
        "id": "rule_109",
        "description": "Columns suggesting hierarchy (e.g., 'category' + 'subcategory')",
        "suggestion": {
            "chartType": "treemap",
            "xField": "",
            "yFields": [],
            "seriesField": "",
            "title": "Hierarchical breakdown",
            "priority": 1,
            "echartsHints": {
                "series": [
                    {
                        "leafDepth": 2,
                        "roam": true
                    }
                ]
            }
        }
    },
    {
        "id": "rule_007",
        "description": "Applies when the result has exactly 1 text column with high cardinality (> 20 unique) and 1 numeric column (avoid crowded bars).",
        "suggestion": {
            "chartType": "treemap",
            "xField": "__TEXT_0__",
            "yFields": [
                "__NUM_0__"
            ],
            "seriesField": null,
            "title": "{{__NUM_0__}} by {{__TEXT_0__}} (treemap)",
            "priority": 2,
            "echartsHints": {
                "fieldPicker": {
                    "x": {
                        "type": "text",
                        "mode": "only"
                    },
                    "y": [
                        {
                            "type": "number",
                            "mode": "only"
                        }
                    ]
                },
                "aggregation": {
                    "groupBy": [
                        "__TEXT_0__"
                    ],
                    "metrics": [
                        {
                            "field": "__NUM_0__",
                            "op": "sum"
                        }
                    ],
                    "sortBy": "__NUM_0__",
                    "order": "desc",
                    "topN": 50,
                    "otherBucketLabel": "Other"
                },
                "tooltip": {
                    "trigger": "item"
                },
                "series": {
                    "type": "treemap",
                    "roam": false,
                    "nodeClick": false,
                    "label": {
                        "show": true,
                        "overflow": "truncate"
                    }
                }
            }
        }
    },
    {
        "id": "rule_109",
        "description": "Names suggest hierarchy (category + subcategory) → treemap of aggregated values or counts.",
        "suggestion": {
            "chartType": "treemap",
            "xField": "{{category}}",
            "yFields": [
                "{{value}}"
            ],
            "seriesField": "{{subcategory}}",
            "title": "{{value}} by category hierarchy",
            "priority": 2,
            "echartsHints": {
                "pick": {
                    "category": {
                        "type": "text",
                        "nameMatches": [
                            "category",
                            "cat"
                        ],
                        "strategy": "bestMatch"
                    },
                    "subcategory": {
                        "type": "text",
                        "nameMatches": [
                            "subcategory",
                            "sub_category",
                            "subcat"
                        ],
                        "strategy": "bestMatch"
                    },
                    "value": {
                        "type": "number",
                        "nameMatches": [
                            "count",
                            "total",
                            "amount",
                            "value"
                        ],
                        "strategy": "optionalBestMatch"
                    }
                },
                "preprocess": {
                    "type": "treemapHierarchy",
                    "path": [
                        "{{category}}",
                        "{{subcategory}}"
                    ],
                    "metric": {
                        "field": "{{value}}",
                        "op": "sum",
                        "fallbackOpIfMissing": "count"
                    }
                },
                "option": {
                    "tooltip": {
                        "formatter": "{b}: {c}"
                    },
                    "series": [
                        {
                            "type": "treemap",
                            "roam": false,
                            "nodeClick": "link",
                            "breadcrumb": {
                                "show": true
                            },
                            "leafDepth": 1,
                            "label": {
                                "show": true
                            },
                            "upperLabel": {
                                "show": true
                            }
                        }
                    ]
                }
            }
        }
    },
    {
        "id": "rule_007",
        "description": "One high-cardinality text column and one number column — treemap for proportional view",
        "suggestion": {
            "chartType": "treemap",
            "xField": null,
            "priority": 2,
            "echartsHints": {
                "tooltip": {
                    "trigger": "item",
                    "formatter": "{b}: {c}"
                },
                "series": [
                    {
                        "type": "treemap",
                        "leafDepth": 1,
                        "label": {
                            "show": true,
                            "formatter": "{b}"
                        },
                        "breadcrumb": {
                            "show": false
                        }
                    }
                ]
            }
        }
    },
    {
        "id": "rule_010",
        "description": "Single text column",
        "suggestion": {
            "chartType": "treemap",
            "seriesField": "text",
            "title": "Treemap",
            "priority": 1
        }
    },
    {
        "id": "rule_021",
        "description": "Hierarchical columns",
        "suggestion": {
            "chartType": "treemap",
            "seriesField": "text",
            "title": "Hierarchical Treemap",
            "priority": 1
        }
    },
    {
        "id": "rule_021",
        "description": "Columns suggesting a hierarchy",
        "suggestion": {
            "chartType": "treemap",
            "xField": "text",
            "yFields": [
                "text"
            ],
            "title": "Hierarchical treemap",
            "priority": 2,
            "echartsHints": {
                "series": {
                    "type": "treemap"
                }
            }
        }
    },
    {
        "id": "rule_hierarchy",
        "description": "Columns indicating a hierarchical structure",
        "suggestion": {
            "chartType": "treemap",
            "xField": null,
            "yFields": [],
            "seriesField": "text",
            "title": "Hierarchical Treemap",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_008",
        "description": "Two text columns + one numeric column",
        "suggestion": {
            "chartType": "treemap",
            "xField": "",
            "title": "Treemap of {yFields[0]} by {seriesField}",
            "priority": 3,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_110_wordcloud_high_card_text",
        "description": "Single high-cardinality text column (not ID-like): suggest word cloud (requires echarts-wordcloud) or a Top-N frequency fallback.",
        "suggestion": {
            "chartType": "wordCloud",
            "xField": null,
            "yFields": [],
            "seriesField": null,
            "title": "Top Terms (Word Cloud)",
            "priority": 3,
            "echartsHints": {
                "series": [
                    {
                        "type": "wordCloud",
                        "shape": "circle",
                        "gridSize": 8,
                        "sizeRange": [
                            12,
                            60
                        ],
                        "rotationRange": [
                            -45,
                            90
                        ],
                        "drawOutOfBound": false
                    }
                ],
                "__requires": "echarts-wordcloud",
                "__aggregate": {
                    "value": "count",
                    "topN": 150
                },
                "__note": "If the extension is unavailable, fall back to a bar chart of Top-N term frequencies."
            }
        }
    },
    {
        "id": "rule_110",
        "description": "Single text column with high uniqueness and text-like name (comments/notes/etc.) → word cloud of token frequency.",
        "suggestion": {
            "chartType": "wordCloud",
            "xField": "{{text}}",
            "yFields": [],
            "seriesField": null,
            "title": "Common terms in {{text}}",
            "priority": 3,
            "echartsHints": {
                "pick": {
                    "text": {
                        "type": "text",
                        "strategy": "only"
                    }
                },
                "preprocess": {
                    "type": "tokenizeAndCount",
                    "field": "{{text}}",
                    "minTokenLength": 3,
                    "removeStopwords": true,
                    "limit": 200
                },
                "option": {
                    "tooltip": {
                        "show": true
                    },
                    "series": [
                        {
                            "type": "wordCloud",
                            "shape": "circle",
                            "gridSize": 8,
                            "sizeRange": [
                                12,
                                48
                            ],
                            "rotationRange": [
                                0,
                                0
                            ]
                        }
                    ]
                },
                "fallbackSuggestionIfNoWordCloudExtension": {
                    "chartType": "bar",
                    "title": "Top terms in {{text}}",
                    "echartsHints": {
                        "option": {
                            "xAxis": {
                                "axisLabel": {
                                    "rotate": 30
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    {
        "id": "rule_022",
        "description": "High cardinality text column",
        "suggestion": {
            "chartType": "wordCloud",
            "seriesField": "text",
            "title": "Word Cloud",
            "priority": 1
        }
    },
    {
        "id": "rule_word_cloud",
        "description": "Single text column with high cardinality",
        "suggestion": {
            "chartType": "wordCloud",
            "xField": null,
            "yFields": [],
            "seriesField": "text",
            "title": "Word Cloud",
            "priority": 2,
            "echartsHints": {}
        }
    },
    {
        "id": "rule_022",
        "description": "A single text column with high cardinality",
        "suggestion": {
            "chartType": "wordCloud",
            "xField": null,
            "yFields": [
                "text"
            ],
            "title": "Word cloud",
            "priority": 3,
            "echartsHints": {
                "series": {
                    "type": "wordCloud"
                }
            }
        }
    }
];

// ============================================================
// SAFE JSON HELPERS
// ============================================================
/**
 * Safely parse drag-and-drop dataTransfer payload.
 * Returns null (never throws) if the data is missing, empty,
 * "[object Object]", or otherwise not valid JSON.
 */
function safeDragParse(event) {
  try {
    const raw = event && event.dataTransfer
      ? (event.dataTransfer.getData('application/x-datalavista') ||
        event.dataTransfer.getData('text/plain') || '')
      : '';
    if (!raw || raw === '[object Object]' || raw.trim()[0] !== '{') return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Safely set drag data on both our custom MIME type and text/plain.
 * Always call this instead of raw setData so safeDragParse works.
 */
function safeDragSet(event, obj) {
  const json = JSON.stringify(obj);
  try { event.dataTransfer.setData('application/x-datalavista', json); } catch (e) { }
  try { event.dataTransfer.setData('text/plain', json); } catch (e) { }
}

/**
 * Parse a JSON string from user input — shows a friendly error instead of throwing.
 */
function safeJSONParse(str, label) {
  try {
    if (!str || typeof str !== 'string' || !str.trim()) throw new Error('Empty input');
    return JSON.parse(str);
  } catch (e) {
    toast((label || 'JSON') + ' parse error: ' + e.message, 'error');
    return null;
  }
}