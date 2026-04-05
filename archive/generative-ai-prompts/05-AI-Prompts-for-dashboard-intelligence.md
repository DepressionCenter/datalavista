<!--
This file is part of DataLaVista™
AI Code Generation Prompts
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
This is a generative AI prompt that was fine-tuned after many tries to produce a heuristics that could be used in lieu of heavy AI LLMs to suggest widgets and dashboard layouts without ever leaving the browser (for data privacy).

## AI Prompts

### Get initial heteuristc rules from multiple different AI agents:
**Prompt:**
<code>
I am building a JavaScript heuristic engine that auto-suggests Apache ECharts dashboard widgets based on a flat data table. 

The engine has access to:
- Column names and their sniffed types: 'number', 'text', 'date', 'boolean', 
  'array', 'object', 'default' (via sniffTypes() function)
- Row count of the result set
- Cardinality (unique value count) of each column
- The data itself via: alasql('SELECT * FROM [dlv_results]')



For each scenario below, give me a JavaScript object in this format:

{

  id: 'rule_001',
  description: 'Human readable description of when this applies',
  condition: (cols, meta) => boolean,  // cols = array of {name, type, cardinality, nullPct}

                                        // meta = {rowCount, totalCols}

  suggestion: {
    chartType: '',        // ECharts series type e.g. 'bar','line','pie','scatter',
                          // 'heatmap','radar','gauge','treemap','funnel','boxplot'
    xField: '',           // column name or null
    yFields: [],           // array of column names or empty array
    seriesField: '',      // optional grouping column
    title: '',            // suggested title template
    priority: 1,          // 1=high, 2=medium, 3=low
    echartsHints: {}      // any special echarts option overrides
  }

}


Cover these column combination scenarios:

1. One date + one number
2. One date + multiple numbers
3. One text (low cardinality) + one number
4. One text (low cardinality) + multiple numbers
5. Two numbers
6. Three or more numbers, no text or date
7. One text, one number, high cardinality text
8. Two text columns + one number
9. Single number column only
10. Single text column only
11. One boolean + one number
12. Date + text + number (three column combo)

</code>

**Output:**
<code>
/* Gemini 3 Pro (via UM enterprise license) */
const chart_rules_gemini = [
  // 1. One date + one number
  {
    id: 'rule_001',
    description: 'Time series data showing a single metric over time',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'date').length === 1 && 
      cols.filter(c => c.type === 'number').length === 1 &&
      cols.length === 2,
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: cols => `${cols.find(c => c.type === 'number').name} over Time`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'time' },
        series: [{ smooth: true, areaStyle: {} }] // Area charts look great for single metrics
      }
    }
  },

  // 2. One date + multiple numbers
  {
    id: 'rule_002',
    description: 'Time series data comparing multiple metrics',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'date').length === 1 && 
      cols.filter(c => c.type === 'number').length > 1,
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: null,
      title: cols => `Metrics Comparison over Time`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'time' },
        tooltip: { trigger: 'axis' } // Essential for comparing multiple lines
      }
    }
  },

  // 3. One text (low cardinality) + one number
  {
    id: 'rule_003',
    description: 'Categorical comparison with a manageable number of items',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'text').length === 1 && 
      cols.find(c => c.type === 'text').cardinality <= 15 && 
      cols.filter(c => c.type === 'number').length === 1 &&
      cols.length === 2,
    suggestion: {
      chartType: 'bar', // Better default than pie for accurate comparison
      xField: cols => cols.find(c => c.type === 'text').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: cols => `${cols.find(c => c.type === 'number').name} by ${cols.find(c => c.type === 'text').name}`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'category' },
        series: [{ type: 'bar' }]
      }
    }
  },

  // 4. One text (low cardinality) + multiple numbers
  {
    id: 'rule_004',
    description: 'Comparing multiple metrics across categories',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'text').length === 1 && 
      cols.find(c => c.type === 'text').cardinality <= 15 && 
      cols.filter(c => c.type === 'number').length > 1,
    suggestion: {
      chartType: 'bar',
      xField: cols => cols.find(c => c.type === 'text').name,
      yFields: cols => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: null,
      title: cols => `Multiple Metrics by ${cols.find(c => c.type === 'text').name}`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'category' },
        legend: { show: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }
      }
    }
  },

  // 5. Two numbers
  {
    id: 'rule_005',
    description: 'Correlation or distribution between two continuous variables',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'number').length === 2 && 
      cols.length === 2,
    suggestion: {
      chartType: 'scatter',
      xField: cols => cols.filter(c => c.type === 'number')[0].name,
      yFields: cols => [cols.filter(c => c.type === 'number')[1].name],
      seriesField: null,
      title: cols => `${cols.filter(c => c.type === 'number')[0].name} vs ${cols.filter(c => c.type === 'number')[1].name}`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'value', scale: true }, // Scale true prevents starting at 0 if unnecessary
        yAxis: { type: 'value', scale: true }
      }
    }
  },

  // 6. Three or more numbers, no text or date
  {
    id: 'rule_006',
    description: 'Multidimensional numeric assessment',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'number').length >= 3 && 
      cols.every(c => c.type === 'number'),
    suggestion: {
      chartType: 'radar',
      xField: null,
      yFields: cols => cols.map(c => c.name),
      seriesField: null,
      title: 'Multidimensional Analysis',
      priority: 2,
      echartsHints: {
        radar: { indicator: [] } // ECharts needs JS intervention here to map columns to indicator array
      }
    }
  },

  // 7. One text, one number, high cardinality text
  {
    id: 'rule_007',
    description: 'Distribution across many categories where a bar chart would be too crowded',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'text').length === 1 && 
      cols.find(c => c.type === 'text').cardinality > 15 && 
      cols.filter(c => c.type === 'number').length === 1 &&
      cols.length === 2,
    suggestion: {
      chartType: 'treemap',
      xField: null,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: cols => cols.find(c => c.type === 'text').name,
      title: cols => `Proportion of ${cols.find(c => c.type === 'number').name}`,
      priority: 1,
      echartsHints: {
        series: [{ type: 'treemap', roam: 'scale' }]
      }
    }
  },

  // 8. Two text columns + one number
  {
    id: 'rule_008',
    description: 'Matrix distribution of a value across two categories',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'text').length === 2 && 
      cols.filter(c => c.type === 'number').length === 1 &&
      cols.length === 3,
    suggestion: {
      chartType: 'heatmap',
      xField: cols => cols.filter(c => c.type === 'text')[0].name,
      yFields: cols => [cols.filter(c => c.type === 'number')[0].name],
      seriesField: cols => cols.filter(c => c.type === 'text')[1].name, // Using Y-axis category as seriesField logically
      title: cols => `Heatmap of ${cols.filter(c => c.type === 'number')[0].name}`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'category' },
        yAxis: { type: 'category' },
        visualMap: { calculable: true, orient: 'horizontal', left: 'center', bottom: '15%' }
      }
    }
  },

  // 9. Single number column only
  {
    id: 'rule_009',
    description: 'A single aggregated metric or distribution',
    condition: (cols, meta) => 
      cols.length === 1 && cols[0].type === 'number',
    suggestion: {
      chartType: meta => meta.rowCount === 1 ? 'gauge' : 'boxplot',
      xField: null,
      yFields: cols => [cols[0].name],
      seriesField: null,
      title: cols => cols[0].name,
      priority: 2,
      echartsHints: {
        // If it's a gauge, center it. If boxplot, use dataset transform
      }
    }
  },

  // 10. Single text column only
  {
    id: 'rule_010',
    description: 'Frequency distribution of categories',
    condition: (cols, meta) => 
      cols.length === 1 && cols[0].type === 'text',
    suggestion: {
      chartType: 'pie',
      xField: null,
      yFields: null, // Value will be a count
      seriesField: cols => cols[0].name,
      title: cols => `Frequency of ${cols[0].name}`,
      priority: 3,
      echartsHints: {
        series: [{ type: 'pie', radius: '50%' }] 
        // Note: Needs AlaSQL pre-processing to map to `SELECT textCol, COUNT(*) FROM table GROUP BY textCol`
      }
    }
  },

  // 11. One boolean + one number
  {
    id: 'rule_011',
    description: 'Value breakdown by a binary state',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'boolean').length === 1 && 
      cols.filter(c => c.type === 'number').length === 1 &&
      cols.length === 2,
    suggestion: {
      chartType: 'pie',
      xField: cols => cols.find(c => c.type === 'boolean').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: cols => `${cols.find(c => c.type === 'number').name} by ${cols.find(c => c.type === 'boolean').name}`,
      priority: 1,
      echartsHints: {
        series: [{ type: 'pie', radius: ['40%', '70%'] }], // Donut chart variation
        tooltip: { trigger: 'item' }
      }
    }
  },

  // 12. Date + text + number (three column combo)
  {
    id: 'rule_012',
    description: 'Time series split by category',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'date').length === 1 && 
      cols.filter(c => c.type === 'text').length === 1 && 
      cols.filter(c => c.type === 'number').length === 1 &&
      cols.length === 3,
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: cols => cols.find(c => c.type === 'text').name, // ECharts will need multiple series generated for each unique text
      title: cols => `${cols.find(c => c.type === 'number').name} over Time by ${cols.find(c => c.type === 'text').name}`,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'time' },
        tooltip: { trigger: 'axis' },
        legend: { show: true }
      }
    }
  }
];


/* gpt-oss 120B (via DuckDuckGo AI) */
const chart_rules_gpt_oss = [
  {
    id: 'rule_001',
    description: 'One date column and exactly one numeric column',
    condition: (cols, meta) => {
      const dates = cols.filter(c => c.type === 'date');
      const nums  = cols.filter(c => c.type === 'number');
      return dates.length === 1 && nums.length === 1 && meta.totalCols === 2;
    },
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: '',
      title: 'Trend of {yFields[0]} over {xField}',
      priority: 1,
      echartsHints: {}
    }
  },

  {
    id: 'rule_002',
    description: 'One date column with two or more numeric columns',
    condition: (cols, meta) => {
      const dates = cols.filter(c => c.type === 'date');
      const nums  = cols.filter(c => c.type === 'number');
      return dates.length === 1 && nums.length >= 2;
    },
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: '',
      title: 'Multiple trends over {xField}',
      priority: 1,
      echartsHints: { legend: { show: true } }
    }
  },

  {
    id: 'rule_003',
    description: 'Low‑cardinality text (≤10% of rows) + one numeric column',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount <= 0.1);
      const nums  = cols.filter(c => c.type === 'number');
      return texts.length === 1 && nums.length === 1 && meta.totalCols === 2;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols => cols.find(c => c.type === 'text').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: '',
      title: '{yFields[0]} by {xField}',
      priority: 2,
      echartsHints: {}
    }
  },

  {
    id: 'rule_004',
    description: 'Low‑cardinality text + multiple numeric columns',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount <= 0.1);
      const nums  = cols.filter(c => c.type === 'number');
      return texts.length === 1 && nums.length >= 2;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols => cols.find(c => c.type === 'text').name,
      yFields: cols => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: '',
      title: 'Metrics by {xField}',
      priority: 2,
      echartsHints: { tooltip: { trigger: 'axis' } }
    }
  },

  {
    id: 'rule_005',
    description: 'Exactly two numeric columns',
    condition: (cols, meta) => {
      const nums = cols.filter(c => c.type === 'number');
      return nums.length === 2 && meta.totalCols === 2;
    },
    suggestion: {
      chartType: 'scatter',
      xField: cols => cols[0].name,
      yFields: cols => [cols[1].name],
      seriesField: '',
      title: '{yFields[0]} vs {xField}',
      priority: 1,
      echartsHints: {}
    }
  },

  {
    id: 'rule_006',
    description: 'Three or more numeric columns, no date or text',
    condition: (cols, meta) => {
      const nums = cols.filter(c => c.type === 'number');
      const hasDateOrText = cols.some(c => c.type === 'date' || c.type === 'text');
      return nums.length >= 3 && !hasDateOrText;
    },
    suggestion: {
      chartType: 'heatmap',
      xField: '',
      yFields: cols => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: '',
      title: 'Correlation heatmap',
      priority: 3,
      echartsHints: { visualMap: { show: true } }
    }
  },

  {
    id: 'rule_007',
    description: 'One low‑cardinality text, one numeric, plus a high‑cardinality text column',
    condition: (cols, meta) => {
      const lowText = cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount <= 0.1);
      const highText = cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount > 0.1);
      const nums = cols.filter(c => c.type === 'number');
      return lowText.length === 1 && highText.length === 1 && nums.length === 1;
    },
    suggestion: {
      chartType: 'pie',
      xField: '',
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: cols => cols.find(c => c.type === 'text' && c.cardinality / meta.rowCount <= 0.1).name,
      title: '{yFields[0]} distribution by {seriesField}',
      priority: 2,
      echartsHints: {}
    }
  },

  {
    id: 'rule_008',
    description: 'Two text columns + one numeric column',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text');
      const nums  = cols.filter(c => c.type === 'number');
      return texts.length === 2 && nums.length === 1;
    },
    suggestion: {
      chartType: 'treemap',
      xField: '',
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: cols => cols.filter(c => c.type === 'text').map(c => c.name).join('_'),
      title: 'Treemap of {yFields[0]} by {seriesField}',
      priority: 3,
      echartsHints: {}
    }
  },

  {
    id: 'rule_009',
    description: 'Single numeric column only',
    condition: (cols, meta) => cols.length === 1 && cols[0].type === 'number',
    suggestion: {
      chartType: 'gauge',
      xField: '',
      yFields: cols => [cols[0].name],
      seriesField: '',
      title: '{yFields[0]} gauge',
      priority: 2,
      echartsHints: { series: [{ detail: { formatter: '{value}'} }] }
    }
  },

  {
    id: 'rule_010',
    description: 'Single text column only',
    condition: (cols, meta) => cols.length === 1 && cols[0].type === 'text',
    suggestion: {
      chartType: 'pie',
      xField: '',
      yFields: cols => [cols[0].name],
      seriesField: '',
      title: '{yFields[0]} distribution',
      priority: 3,
      echartsHints: {}
    }
  },

  {
    id: 'rule_011',
    description: 'One boolean column + one numeric column',
    condition: (cols, meta) => {
      const bools = cols.filter(c => c.type === 'boolean');
      const nums  = cols.filter(c => c.type === 'number');
      return bools.length === 1 && nums.length === 1 && meta.totalCols === 2;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols => cols.find(c => c.type === 'boolean').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: '',
      title: '{yFields[0]} by {xField}',
      priority: 1,
      echartsHints: {}
    }
  },

  {
    id: 'rule_012',
    description: 'Date + text + numeric columns (any cardinalities)',
    condition: (cols, meta) => {
      const hasDate = cols.some(c => c.type === 'date');
      const hasText = cols.some(c => c.type === 'text');
      const hasNum  = cols.some(c => c.type === 'number');
      return hasDate && hasText && hasNum;
    },
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: cols => cols.find(c => c.type === 'text').name,
      title: '{yFields[0]} over {xField} by {seriesField}',
      priority: 1,
      echartsHints: { legend: { show: true } }
    }
  }
];


/* Mistral Small 3 (via DuckDuckGo AI) */
const chart_rules_mistral = [
  {
    id: 'rule_001',
    description: 'One date + one number',
    condition: (cols, meta) => {
      const dateCol = cols.find(col => col.type === 'date');
      const numberCol = cols.find(col => col.type === 'number');
      return dateCol && numberCol && cols.length === 2;
    },
    suggestion: {
      chartType: 'line',
      xField: 'date',
      yFields: ['number'],
      title: 'Trend over time',
      priority: 1,
      echartsHints: {}
    }
  },
  {
    id: 'rule_002',
    description: 'One date + multiple numbers',
    condition: (cols, meta) => {
      const dateCol = cols.find(col => col.type === 'date');
      const numberCols = cols.filter(col => col.type === 'number');
      return dateCol && numberCols.length > 1;
    },
    suggestion: {
      chartType: 'line',
      xField: 'date',
      yFields: numberCols.map(col => col.name),
      title: 'Multiple trends over time',
      priority: 1,
      echartsHints: {}
    }
  },
  {
    id: 'rule_003',
    description: 'One text (low cardinality) + one number',
    condition: (cols, meta) => {
      const textCol = cols.find(col => col.type === 'text' && col.cardinality < 10);
      const numberCol = cols.find(col => col.type === 'number');
      return textCol && numberCol && cols.length === 2;
    },
    suggestion: {
      chartType: 'bar',
      xField: 'text',
      yFields: ['number'],
      title: 'Comparison by category',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_004',
    description: 'One text (low cardinality) + multiple numbers',
    condition: (cols, meta) => {
      const textCol = cols.find(col => col.type === 'text' && col.cardinality < 10);
      const numberCols = cols.filter(col => col.type === 'number');
      return textCol && numberCols.length > 1;
    },
    suggestion: {
      chartType: 'bar',
      xField: 'text',
      yFields: numberCols.map(col => col.name),
      title: 'Multiple comparisons by category',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_005',
    description: 'Two numbers',
    condition: (cols, meta) => {
      const numberCols = cols.filter(col => col.type === 'number');
      return numberCols.length === 2;
    },
    suggestion: {
      chartType: 'scatter',
      xField: numberCols[0].name,
      yFields: [numberCols[1].name],
      title: 'Scatter plot of two numbers',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_006',
    description: 'Three or more numbers, no text or date',
    condition: (cols, meta) => {
      const numberCols = cols.filter(col => col.type === 'number');
      return numberCols.length >= 3 && !cols.find(col => col.type === 'text' || col.type === 'date');
    },
    suggestion: {
      chartType: 'scatter',
      xField: numberCols[0].name,
      yFields: numberCols.slice(1).map(col => col.name),
      title: 'Scatter plot of multiple numbers',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_007',
    description: 'One text, one number, high cardinality text',
    condition: (cols, meta) => {
      const textCol = cols.find(col => col.type === 'text' && col.cardinality >= 10);
      const numberCol = cols.find(col => col.type === 'number');
      return textCol && numberCol && cols.length === 2;
    },
    suggestion: {
      chartType: 'bar',
      xField: 'text',
      yFields: ['number'],
      title: 'Comparison by high cardinality text',
      priority: 3,
      echartsHints: {}
    }
  },
  {
    id: 'rule_008',
    description: 'Two text columns + one number',
    condition: (cols, meta) => {
      const textCols = cols.filter(col => col.type === 'text');
      const numberCol = cols.find(col => col.type === 'number');
      return textCols.length === 2 && numberCol;
    },
    suggestion: {
      chartType: 'bar',
      xField: textCols[0].name,
      yFields: [numberCol.name],
      seriesField: textCols[1].name,
      title: 'Comparison by two text columns',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_009',
    description: 'Single number column only',
    condition: (cols, meta) => {
      const numberCol = cols.find(col => col.type === 'number');
      return numberCol && cols.length === 1;
    },
    suggestion: {
      chartType: 'bar',
      xField: null,
      yFields: ['number'],
      title: 'Single number distribution',
      priority: 3,
      echartsHints: {}
    }
  },
  {
    id: 'rule_010',
    description: 'Single text column only',
    condition: (cols, meta) => {
      const textCol = cols.find(col => col.type === 'text');
      return textCol && cols.length === 1;
    },
    suggestion: {
      chartType: 'pie',
      xField: null,
      yFields: ['text'],
      title: 'Text distribution',
      priority: 3,
      echartsHints: {}
    }
  },
  {
    id: 'rule_011',
    description: 'One boolean + one number',
    condition: (cols, meta) => {
      const booleanCol = cols.find(col => col.type === 'boolean');
      const numberCol = cols.find(col => col.type === 'number');
      return booleanCol && numberCol && cols.length === 2;
    },
    suggestion: {
      chartType: 'bar',
      xField: 'boolean',
      yFields: ['number'],
      title: 'Comparison by boolean',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_012',
    description: 'Date + text + number (three column combo)',
    condition: (cols, meta) => {
      const dateCol = cols.find(col => col.type === 'date');
      const textCol = cols.find(col => col.type === 'text');
      const numberCol = cols.find(col => col.type === 'number');
      return dateCol && textCol && numberCol && cols.length === 3;
    },
    suggestion: {
      chartType: 'line',
      xField: 'date',
      yFields: ['number'],
      seriesField: 'text',
      title: 'Trend over time by category',
      priority: 1,
      echartsHints: {}
    }
  }
];


/* Llama 4 Scout (via DuckDucGo AI) */
const chart_rules_llama = [
  {
    id: 'rule_001',
    description: 'One date column and one number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'date').length === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => c.type === 'date').name,
      yFields: [cols.find(c => c.type === 'number').name],
      title: 'Time Series',
      priority: 1
    }
  },
  {
    id: 'rule_002',
    description: 'One date column and multiple number columns',
    condition: (cols, meta) => cols.filter(c => c.type === 'date').length === 1 && cols.filter(c => c.type === 'number').length > 1,
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => c.type === 'date').name,
      yFields: cols.filter(c => c.type === 'number').map(c => c.name),
      title: 'Multi-Line Time Series',
      priority: 1
    }
  },
  {
    id: 'rule_003',
    description: 'One low-cardinality text column and one number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount < 0.1).length === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => c.type === 'text' && c.cardinality / meta.rowCount < 0.1).name,
      yFields: [cols.find(c => c.type === 'number').name],
      title: 'Bar Chart',
      priority: 1
    }
  },
  {
    id: 'rule_004',
    description: 'One low-cardinality text column and multiple number columns',
    condition: (cols, meta) => cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount < 0.1).length === 1 && cols.filter(c => c.type === 'number').length > 1,
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => c.type === 'text' && c.cardinality / meta.rowCount < 0.1).name,
      yFields: cols.filter(c => c.type === 'number').map(c => c.name),
      title: 'Multi-Bar Chart',
      priority: 1
    }
  },
  {
    id: 'rule_005',
    description: 'Two number columns',
    condition: (cols, meta) => cols.filter(c => c.type === 'number').length === 2,
    suggestion: {
      chartType: 'scatter',
      xField: cols.find(c => c.type === 'number' && cols.indexOf(c) === 0).name,
      yFields: [cols.find(c => c.type === 'number' && cols.indexOf(c) === 1).name],
      title: 'Scatter Plot',
      priority: 1
    }
  },
  {
    id: 'rule_006',
    description: 'Three or more number columns, no text or date',
    condition: (cols, meta) => cols.filter(c => c.type === 'number').length >= 3 && cols.filter(c => c.type === 'text' || c.type === 'date').length === 0,
    suggestion: {
      chartType: 'scatter',
      xField: cols.find(c => c.type === 'number' && cols.indexOf(c) === 0).name,
      yFields: cols.filter(c => c.type === 'number' && cols.indexOf(c) > 0).map(c => c.name),
      title: 'Multi-Scatter Plot',
      priority: 1
    }
  },
  {
    id: 'rule_007',
    description: 'One text column with high cardinality and one number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount > 0.1).length === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'boxplot',
      xField: cols.find(c => c.type === 'text' && c.cardinality / meta.rowCount > 0.1).name,
      yFields: [cols.find(c => c.type === 'number').name],
      title: 'Boxplot',
      priority: 1
    }
  },
  {
    id: 'rule_008',
    description: 'Two text columns and one number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'text').length === 2 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'heatmap',
      xField: cols.find(c => c.type === 'text' && cols.indexOf(c) === 0).name,
      yFields: [cols.find(c => c.type === 'text' && cols.indexOf(c) === 1).name],
      seriesField: cols.find(c => c.type === 'number').name,
      title: 'Heatmap',
      priority: 1
    }
  },
  {
    id: 'rule_009',
    description: 'Single number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'gauge',
      yFields: [cols.find(c => c.type === 'number').name],
      title: 'Gauge',
      priority: 1
    }
  },
  {
    id: 'rule_010',
    description: 'Single text column',
    condition: (cols, meta) => cols.filter(c => c.type === 'text').length === 1,
    suggestion: {
      chartType: 'treemap',
      seriesField: cols.find(c => c.type === 'text').name,
      title: 'Treemap',
      priority: 1
    }
  },
  {
    id: 'rule_011',
    description: 'One boolean column and one number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'boolean').length === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => c.type === 'boolean').name,
      yFields: [cols.find(c => c.type === 'number').name],
      title: 'Bar Chart',
      priority: 1
    }
  },
  {
    id: 'rule_012',
    description: 'One date column, one text column, and one number column',
    condition: (cols, meta) => cols.filter(c => c.type === 'date').length === 1 && cols.filter(c => c.type === 'text').length === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'scatter',
      xField: cols.find(c => c.type === 'date').name,
      yFields: [cols.find(c => c.type === 'number').name],
      seriesField: cols.find(c => c.type === 'text').name,
      title: 'Scatter Plot',
      priority: 1
    }
  }
];


/* ChatGPT 5.2 (via UMGPT) */
const chart_rules_chatgpt = [
  // 1) One date + one number
  {
    id: "rule_001",
    description: "Applies when the result has exactly 1 date column and 1 numeric column (time series).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const dateCols = usable.filter(c => c.type === "date");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - dateCols.length - numCols.length;

      return (
        rowCount >= 2 &&
        usable.length === 2 &&
        dateCols.length === 1 &&
        numCols.length === 1 &&
        otherCount === 0 &&
        (dateCols[0].cardinality ?? 0) >= 2
      );
    },
    suggestion: {
      chartType: "line",
      xField: "__DATE_0__",
      yFields: ["__NUM_0__"],
      seriesField: null,
      title: "{{__NUM_0__}} over time",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          x: { type: "date", mode: "only" },
          y: [{ type: "number", mode: "only" }]
        },
        aggregation: { groupBy: ["__DATE_0__"], metrics: [{ field: "__NUM_0__", op: "sum" }], sortBy: "__DATE_0__" },
        xAxis: { type: "time" },
        tooltip: { trigger: "axis" },
        series: { type: "line", showSymbol: false, connectNulls: true }
      }
    }
  },

  // 2) One date + multiple numbers
  {
    id: "rule_002",
    description: "Applies when the result has exactly 1 date column and 2+ numeric columns (multi-metric time series).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const dateCols = usable.filter(c => c.type === "date");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - dateCols.length - numCols.length;

      return (
        rowCount >= 2 &&
        dateCols.length === 1 &&
        numCols.length >= 2 &&
        otherCount === 0 &&
        usable.length === 1 + numCols.length &&
        (dateCols[0].cardinality ?? 0) >= 2
      );
    },
    suggestion: {
      chartType: "line",
      xField: "__DATE_0__",
      yFields: ["__NUM_ALL__"],
      seriesField: null,
      title: "Trends over time (multiple metrics)",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          x: { type: "date", mode: "only" },
          y: [{ type: "number", mode: "all" }]
        },
        aggregation: { groupBy: ["__DATE_0__"], metrics: [{ field: "__NUM_ALL__", op: "sum" }], sortBy: "__DATE_0__" },
        xAxis: { type: "time" },
        tooltip: { trigger: "axis" },
        legend: { type: "scroll" },
        series: { type: "line", showSymbol: false, connectNulls: true }
      }
    }
  },

  // 3) One text (low cardinality) + one number
  {
    id: "rule_003",
    description: "Applies when the result has exactly 1 low-cardinality text column (<= 20 unique) and 1 numeric column.",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const textCols = usable.filter(c => c.type === "text");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - textCols.length - numCols.length;

      const isLowCard = (c) => (c.cardinality ?? Number.POSITIVE_INFINITY) <= 20;

      return (
        rowCount >= 1 &&
        usable.length === 2 &&
        textCols.length === 1 &&
        numCols.length === 1 &&
        otherCount === 0 &&
        isLowCard(textCols[0])
      );
    },
    suggestion: {
      chartType: "bar",
      xField: "__TEXT_0__",
      yFields: ["__NUM_0__"],
      seriesField: null,
      title: "{{__NUM_0__}} by {{__TEXT_0__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          x: { type: "text", mode: "only" },
          y: [{ type: "number", mode: "only" }]
        },
        aggregation: { groupBy: ["__TEXT_0__"], metrics: [{ field: "__NUM_0__", op: "sum" }], sortBy: "__NUM_0__", order: "desc" },
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", axisLabel: { interval: 0 } },
        yAxis: { type: "value" }
      }
    }
  },

  // 4) One text (low cardinality) + multiple numbers
  {
    id: "rule_004",
    description: "Applies when the result has exactly 1 low-cardinality text column (<= 20 unique) and 2+ numeric columns.",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const textCols = usable.filter(c => c.type === "text");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - textCols.length - numCols.length;

      const isLowCard = (c) => (c.cardinality ?? Number.POSITIVE_INFINITY) <= 20;

      return (
        rowCount >= 1 &&
        textCols.length === 1 &&
        numCols.length >= 2 &&
        otherCount === 0 &&
        usable.length === 1 + numCols.length &&
        isLowCard(textCols[0])
      );
    },
    suggestion: {
      chartType: "bar",
      xField: "__TEXT_0__",
      yFields: ["__NUM_ALL__"],
      seriesField: null,
      title: "Multiple metrics by {{__TEXT_0__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          x: { type: "text", mode: "only" },
          y: [{ type: "number", mode: "all" }]
        },
        aggregation: { groupBy: ["__TEXT_0__"], metrics: [{ field: "__NUM_ALL__", op: "sum" }] },
        tooltip: { trigger: "axis" },
        legend: { type: "scroll" },
        xAxis: { type: "category" },
        yAxis: { type: "value" }
      }
    }
  },

  // 5) Two numbers
  {
    id: "rule_005",
    description: "Applies when the result has exactly 2 numeric columns (good candidate for scatter/correlation).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - numCols.length;

      return rowCount >= 3 && usable.length === 2 && numCols.length === 2 && otherCount === 0;
    },
    suggestion: {
      chartType: "scatter",
      xField: "__NUM_0__",
      yFields: ["__NUM_1__"],
      seriesField: null,
      title: "{{__NUM_1__}} vs {{__NUM_0__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          // Prefer the more continuous column on X (higher cardinality)
          x: { type: "number", mode: "maxCardinality" },
          y: [{ type: "number", mode: "otherNumberThanX" }]
        },
        tooltip: { trigger: "item" },
        xAxis: { type: "value", scale: true },
        yAxis: { type: "value", scale: true },
        series: { type: "scatter", large: true, largeThreshold: 2000 }
      }
    }
  },

  // 6) Three or more numbers, no text or date
  {
    id: "rule_006",
    description: "Applies when the result contains 3+ numeric columns and no other column types (compare distributions).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - numCols.length;

      return rowCount >= 5 && numCols.length >= 3 && otherCount === 0 && usable.length === numCols.length;
    },
    suggestion: {
      chartType: "boxplot",
      xField: null,
      yFields: ["__NUM_ALL__"],
      seriesField: null,
      title: "Distribution of numeric fields",
      priority: 2,
      echartsHints: {
        fieldPicker: { y: [{ type: "number", mode: "all" }] },
        // Data prep typically needed: compute boxplot stats per numeric column.
        dataPrep: { transform: "boxplotByColumn", fields: "__NUM_ALL__" },
        tooltip: { trigger: "item" },
        xAxis: { type: "category" },
        yAxis: { type: "value", scale: true },
        series: { type: "boxplot" }
      }
    }
  },

  // 7) One text, one number, high cardinality text
  {
    id: "rule_007",
    description: "Applies when the result has exactly 1 text column with high cardinality (> 20 unique) and 1 numeric column (avoid crowded bars).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const textCols = usable.filter(c => c.type === "text");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - textCols.length - numCols.length;

      const isHighCard = (c) => (c.cardinality ?? 0) > 20;

      return (
        rowCount >= 1 &&
        usable.length === 2 &&
        textCols.length === 1 &&
        numCols.length === 1 &&
        otherCount === 0 &&
        isHighCard(textCols[0])
      );
    },
    suggestion: {
      chartType: "treemap",
      xField: "__TEXT_0__",
      yFields: ["__NUM_0__"],
      seriesField: null,
      title: "{{__NUM_0__}} by {{__TEXT_0__}} (treemap)",
      priority: 2,
      echartsHints: {
        fieldPicker: {
          x: { type: "text", mode: "only" },
          y: [{ type: "number", mode: "only" }]
        },
        aggregation: {
          groupBy: ["__TEXT_0__"],
          metrics: [{ field: "__NUM_0__", op: "sum" }],
          sortBy: "__NUM_0__",
          order: "desc",
          topN: 50,
          otherBucketLabel: "Other"
        },
        tooltip: { trigger: "item" },
        series: {
          type: "treemap",
          roam: false,
          nodeClick: false,
          label: { show: true, overflow: "truncate" }
        }
      }
    }
  },

  // 8) Two text columns + one number
  {
    id: "rule_008",
    description: "Applies when the result has exactly 2 text columns and 1 numeric column (good for a pivot-style heatmap).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const textCols = usable.filter(c => c.type === "text");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - textCols.length - numCols.length;

      if (!(rowCount >= 1 && usable.length === 3 && textCols.length === 2 && numCols.length === 1 && otherCount === 0)) {
        return false;
      }

      const c0 = textCols[0].cardinality ?? 999999;
      const c1 = textCols[1].cardinality ?? 999999;

      // Keep heatmap readable: limit overall grid size.
      return c0 <= 30 && c1 <= 30 && c0 * c1 <= 400;
    },
    suggestion: {
      chartType: "heatmap",
      xField: "__TEXT_0__",
      yFields: ["__NUM_0__"],
      seriesField: "__TEXT_1__",
      title: "{{__NUM_0__}} by {{__TEXT_0__}} × {{__TEXT_1__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          // Put the higher-cardinality text on X to better use horizontal space.
          x: { type: "text", mode: "maxCardinality" },
          series: { type: "text", mode: "otherTextThanX" },
          y: [{ type: "number", mode: "only" }]
        },
        aggregation: { groupBy: ["__TEXT_0__", "__TEXT_1__"], metrics: [{ field: "__NUM_0__", op: "sum" }] },
        tooltip: { position: "top" },
        grid: { containLabel: true },
        xAxis: { type: "category", splitArea: { show: true } },
        yAxis: { type: "category", splitArea: { show: true } },
        visualMap: { type: "continuous", calculable: true, orient: "horizontal", left: "center", bottom: 0 },
        series: { type: "heatmap", emphasis: { itemStyle: { shadowBlur: 10 } } }
      }
    }
  },

  // 9) Single number column only
  {
    id: "rule_009",
    description: "Applies when the result is a single numeric value (1 column, 1 row): show as a KPI gauge.",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - numCols.length;

      return rowCount === 1 && usable.length === 1 && numCols.length === 1 && otherCount === 0;
    },
    suggestion: {
      chartType: "gauge",
      xField: null,
      yFields: ["__NUM_0__"],
      seriesField: null,
      title: "KPI: {{__NUM_0__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: { y: [{ type: "number", mode: "only" }] },
        // Set min/max dynamically around the value (engine-side).
        dataPrep: { gaugeRange: { min: "auto(0)", max: "autoNice(>value)" } },
        tooltip: { trigger: "item" },
        series: {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          detail: { valueAnimation: true }
        }
      }
    }
  },

  // 10) Single text column only
  {
    id: "rule_010",
    description: "Applies when the result has only 1 text column: show category frequency (counts) as a pie/donut.",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const textCols = usable.filter(c => c.type === "text");
      const otherCount = usable.length - textCols.length;

      return rowCount >= 1 && usable.length === 1 && textCols.length === 1 && otherCount === 0;
    },
    suggestion: {
      chartType: "pie",
      xField: "__TEXT_0__",
      yFields: [],
      seriesField: null,
      title: "Count of records by {{__TEXT_0__}}",
      priority: 2,
      echartsHints: {
        fieldPicker: { x: { type: "text", mode: "only" } },
        aggregation: {
          groupBy: ["__TEXT_0__"],
          metrics: [{ field: "*", op: "count" }],
          sortBy: "count",
          order: "desc",
          topN: 10,
          otherBucketLabel: "Other"
        },
        tooltip: { trigger: "item" },
        legend: { type: "scroll" },
        series: { type: "pie", radius: ["40%", "70%"], avoidLabelOverlap: true }
      }
    }
  },

  // 11) One boolean + one number
  {
    id: "rule_011",
    description: "Applies when the result has exactly 1 boolean column and 1 numeric column (compare True/False).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const boolCols = usable.filter(c => c.type === "boolean");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - boolCols.length - numCols.length;

      return rowCount >= 1 && usable.length === 2 && boolCols.length === 1 && numCols.length === 1 && otherCount === 0;
    },
    suggestion: {
      chartType: "bar",
      xField: "__BOOL_0__",
      yFields: ["__NUM_0__"],
      seriesField: null,
      title: "{{__NUM_0__}} by {{__BOOL_0__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          x: { type: "boolean", mode: "only" },
          y: [{ type: "number", mode: "only" }]
        },
        aggregation: { groupBy: ["__BOOL_0__"], metrics: [{ field: "__NUM_0__", op: "avg" }] },
        tooltip: { trigger: "axis" },
        xAxis: { type: "category" },
        yAxis: { type: "value" },
        series: { type: "bar", label: { show: true, position: "top" } }
      }
    }
  },

  // 12) Date + text + number (three column combo)
  {
    id: "rule_012",
    description: "Applies when the result has exactly 1 date, 1 low-cardinality text (series), and 1 numeric column (segmented time series).",
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const usable = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const dateCols = usable.filter(c => c.type === "date");
      const textCols = usable.filter(c => c.type === "text");
      const numCols = usable.filter(c => c.type === "number");
      const otherCount = usable.length - dateCols.length - textCols.length - numCols.length;

      const isSeriesSized = (c) => (c.cardinality ?? 999999) >= 2 && (c.cardinality ?? 999999) <= 12;

      return (
        rowCount >= 2 &&
        usable.length === 3 &&
        dateCols.length === 1 &&
        textCols.length === 1 &&
        numCols.length === 1 &&
        otherCount === 0 &&
        (dateCols[0].cardinality ?? 0) >= 2 &&
        isSeriesSized(textCols[0])
      );
    },
    suggestion: {
      chartType: "line",
      xField: "__DATE_0__",
      yFields: ["__NUM_0__"],
      seriesField: "__TEXT_0__",
      title: "{{__NUM_0__}} over time by {{__TEXT_0__}}",
      priority: 1,
      echartsHints: {
        fieldPicker: {
          x: { type: "date", mode: "only" },
          series: { type: "text", mode: "only" },
          y: [{ type: "number", mode: "only" }]
        },
        aggregation: { groupBy: ["__DATE_0__", "__TEXT_0__"], metrics: [{ field: "__NUM_0__", op: "sum" }], sortBy: "__DATE_0__" },
        xAxis: { type: "time" },
        tooltip: { trigger: "axis" },
        legend: { type: "scroll" },
        series: { type: "line", showSymbol: false, connectNulls: true }
      }
    }
  }
]



/* Claude Opus 4.6 (via UMGPT) */
const chart_rules_claude_opus = [
  // Rule 1: One date + one number → Line chart
  {
    id: 'rule_001',
    description: 'Exactly one date column and one number column — time-series line chart',
    condition: (cols, meta) => {
      const dates = cols.filter(c => c.type === 'date');
      const nums = cols.filter(c => c.type === 'number');
      return dates.length === 1 && nums.length === 1 && cols.length === 2;
    },
    suggestion: {
      chartType: 'line',
      xField: (cols) => cols.find(c => c.type === 'date').name,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: (cols) =>
        cols.find(c => c.type === 'number').name + ' over ' + cols.find(c => c.type === 'date').name,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'time' },
        tooltip: { trigger: 'axis' },
        dataZoom: [{ type: 'slider', start: 0, end: 100 }]
      }
    }
  },

  // Rule 2: One date + multiple numbers → Multi-series line chart
  {
    id: 'rule_002',
    description: 'One date column and two or more number columns — multi-series line chart',
    condition: (cols, meta) => {
      const dates = cols.filter(c => c.type === 'date');
      const nums = cols.filter(c => c.type === 'number');
      return dates.length === 1 && nums.length >= 2;
    },
    suggestion: {
      chartType: 'line',
      xField: (cols) => cols.find(c => c.type === 'date').name,
      yFields: (cols) => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: null,
      title: (cols) =>
        cols.filter(c => c.type === 'number').map(c => c.name).join(', ') +
        ' over ' +
        cols.find(c => c.type === 'date').name,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'time' },
        tooltip: { trigger: 'axis' },
        legend: { show: true },
        dataZoom: [{ type: 'slider', start: 0, end: 100 }]
      }
    }
  },

  // Rule 3: One text (low cardinality) + one number → Bar chart
  {
    id: 'rule_003',
    description: 'One low-cardinality text column and one number column — vertical bar chart',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text');
      const nums = cols.filter(c => c.type === 'number');
      return (
        texts.length === 1 &&
        nums.length === 1 &&
        texts[0].cardinality <= Math.min(20, meta.rowCount * 0.5)
      );
    },
    suggestion: {
      chartType: 'bar',
      xField: (cols) => cols.find(c => c.type === 'text').name,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: (cols) =>
        cols.find(c => c.type === 'number').name +
        ' by ' +
        cols.find(c => c.type === 'text').name,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'category', axisLabel: { rotate: 30 } },
        tooltip: { trigger: 'axis' }
      }
    }
  },

  // Rule 4: One text (low cardinality) + multiple numbers → Grouped bar chart
  {
    id: 'rule_004',
    description: 'One low-cardinality text column and two or more number columns — grouped bar chart',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text');
      const nums = cols.filter(c => c.type === 'number');
      return (
        texts.length === 1 &&
        nums.length >= 2 &&
        texts[0].cardinality <= Math.min(20, meta.rowCount * 0.5)
      );
    },
    suggestion: {
      chartType: 'bar',
      xField: (cols) => cols.find(c => c.type === 'text').name,
      yFields: (cols) => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: null,
      title: (cols) =>
        cols.filter(c => c.type === 'number').map(c => c.name).join(', ') +
        ' by ' +
        cols.find(c => c.type === 'text').name,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'category', axisLabel: { rotate: 30 } },
        tooltip: { trigger: 'axis' },
        legend: { show: true }
      }
    }
  },

  // Rule 5: Two numbers → Scatter plot
  {
    id: 'rule_005',
    description: 'Exactly two number columns with no date — scatter plot',
    condition: (cols, meta) => {
      const nums = cols.filter(c => c.type === 'number');
      const dates = cols.filter(c => c.type === 'date');
      return nums.length === 2 && dates.length === 0 && cols.length === 2;
    },
    suggestion: {
      chartType: 'scatter',
      xField: (cols) => cols.filter(c => c.type === 'number')[0].name,
      yFields: (cols) => [cols.filter(c => c.type === 'number')[1].name],
      seriesField: null,
      title: (cols) => {
        const nums = cols.filter(c => c.type === 'number');
        return nums[1].name + ' vs ' + nums[0].name;
      },
      priority: 1,
      echartsHints: {
        tooltip: { trigger: 'item' }
      }
    }
  },

  // Rule 6: Three or more numbers, no text or date → Radar / Parallel
  {
    id: 'rule_006',
    description:
      'Three or more number columns with no text or date — radar chart (≤30 rows) or parallel coordinates (>30 rows)',
    condition: (cols, meta) => {
      const nums = cols.filter(c => c.type === 'number');
      const texts = cols.filter(c => c.type === 'text');
      const dates = cols.filter(c => c.type === 'date');
      return nums.length >= 3 && texts.length === 0 && dates.length === 0;
    },
    suggestion: {
      chartType: (cols, meta) => (meta.rowCount <= 30 ? 'radar' : 'parallel'),
      xField: null,
      yFields: (cols) => cols.filter(c => c.type === 'number').map(c => c.name),
      seriesField: null,
      title: (cols) =>
        'Multi-metric comparison (' +
        cols.filter(c => c.type === 'number').length +
        ' measures)',
      priority: 2,
      echartsHints: {
        radar: {
          indicator: (cols) =>
            cols.filter(c => c.type === 'number').map(c => ({ name: c.name }))
        },
        parallelAxis: (cols) =>
          cols
            .filter(c => c.type === 'number')
            .map((c, i) => ({ dim: i, name: c.name, type: 'value' })),
        tooltip: { trigger: 'item' }
      }
    }
  },

  // Rule 7: One text (high cardinality) + one number → Treemap
  {
    id: 'rule_007',
    description:
      'One high-cardinality text column and one number column — treemap for proportional view',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text');
      const nums = cols.filter(c => c.type === 'number');
      return (
        texts.length === 1 &&
        nums.length === 1 &&
        texts[0].cardinality > Math.min(20, meta.rowCount * 0.5)
      );
    },
    suggestion: {
      chartType: 'treemap',
      xField: null,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: (cols) => cols.find(c => c.type === 'text').name,
      title: (cols) =>
        cols.find(c => c.type === 'number').name +
        ' distribution across ' +
        cols.find(c => c.type === 'text').name,
      priority: 2,
      echartsHints: {
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        series: [
          {
            type: 'treemap',
            leafDepth: 1,
            label: { show: true, formatter: '{b}' },
            breadcrumb: { show: false }
          }
        ]
      }
    }
  },

  // Rule 8: Two text columns + one number → Heatmap
  {
    id: 'rule_008',
    description: 'Two text columns and one number column — heatmap with texts as axes',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text');
      const nums = cols.filter(c => c.type === 'number');
      return texts.length === 2 && nums.length === 1;
    },
    suggestion: {
      chartType: 'heatmap',
      xField: (cols) => cols.filter(c => c.type === 'text')[0].name,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: (cols) => cols.filter(c => c.type === 'text')[1].name,
      title: (cols) => {
        const texts = cols.filter(c => c.type === 'text');
        return (
          cols.find(c => c.type === 'number').name +
          ' by ' +
          texts[0].name +
          ' × ' +
          texts[1].name
        );
      },
      priority: 2,
      echartsHints: {
        xAxis: { type: 'category' },
        yAxis: { type: 'category' },
        visualMap: {
          min: 0,
          max: 'auto',
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '0%'
        },
        tooltip: { trigger: 'item' }
      }
    }
  },

  // Rule 9: Single number column only → Gauge (1 row) or Histogram (many rows)
  {
    id: 'rule_009',
    description:
      'Only one number column — gauge for a single row, histogram-style bar for multiple rows',
    condition: (cols, meta) => {
      const nums = cols.filter(c => c.type === 'number');
      return nums.length === 1 && cols.length === 1;
    },
    suggestion: {
      chartType: (cols, meta) => (meta.rowCount === 1 ? 'gauge' : 'bar'),
      xField: null,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: (cols, meta) =>
        meta.rowCount === 1
          ? cols.find(c => c.type === 'number').name + ' indicator'
          : 'Distribution of ' + cols.find(c => c.type === 'number').name,
      priority: 3,
      echartsHints: {
        gauge: {
          detail: { formatter: '{value}' },
          axisLine: { lineStyle: { width: 15 } }
        },
        histogram: {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', name: 'Bin' },
          yAxis: { type: 'value', name: 'Frequency' }
        }
      }
    }
  },

  // Rule 10: Single text column only → Pie (low cardinality) or Word Cloud (high)
  {
    id: 'rule_010',
    description:
      'Only one text column — pie chart of value counts (low cardinality) or word cloud (high cardinality)',
    condition: (cols, meta) => {
      const texts = cols.filter(c => c.type === 'text');
      return texts.length === 1 && cols.length === 1;
    },
    suggestion: {
      chartType: (cols, meta) => {
        const text = cols.find(c => c.type === 'text');
        return text.cardinality <= Math.min(20, meta.rowCount * 0.5) ? 'pie' : 'wordCloud';
      },
      xField: null,
      yFields: [],
      seriesField: (cols) => cols.find(c => c.type === 'text').name,
      title: (cols) => 'Frequency of ' + cols.find(c => c.type === 'text').name,
      priority: 3,
      echartsHints: {
        pie: {
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [
            {
              type: 'pie',
              radius: ['40%', '70%'],
              label: { show: true },
              emphasis: {
                label: { show: true, fontSize: 16, fontWeight: 'bold' }
              }
            }
          ]
        },
        wordCloud: {
          tooltip: { trigger: 'item' },
          series: [
            {
              type: 'wordCloud',
              sizeRange: [12, 60],
              rotationRange: [-45, 45],
              gridSize: 8
            }
          ]
        }
      }
    }
  },

  // Rule 11: One boolean + one number → Funnel chart
  {
    id: 'rule_011',
    description: 'One boolean column and one number column — funnel chart comparing the two groups',
    condition: (cols, meta) => {
      const bools = cols.filter(c => c.type === 'boolean');
      const nums = cols.filter(c => c.type === 'number');
      return bools.length === 1 && nums.length === 1;
    },
    suggestion: {
      chartType: 'funnel',
      xField: (cols) => cols.find(c => c.type === 'boolean').name,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: (cols) =>
        cols.find(c => c.type === 'number').name +
        ' by ' +
        cols.find(c => c.type === 'boolean').name,
      priority: 2,
      echartsHints: {
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        series: [
          {
            type: 'funnel',
            left: '10%',
            width: '80%',
            sort: 'descending',
            label: { show: true, position: 'inside' },
            gap: 2
          }
        ]
      }
    }
  },

  // Rule 12: Date + text + number → Multi-series line grouped by text
  {
    id: 'rule_012',
    description:
      'One date, one text, and one number column — multi-series line chart grouped by the text column',
    condition: (cols, meta) => {
      const dates = cols.filter(c => c.type === 'date');
      const texts = cols.filter(c => c.type === 'text');
      const nums = cols.filter(c => c.type === 'number');
      return dates.length === 1 && texts.length === 1 && nums.length === 1;
    },
    suggestion: {
      chartType: 'line',
      xField: (cols) => cols.find(c => c.type === 'date').name,
      yFields: (cols) => [cols.find(c => c.type === 'number').name],
      seriesField: (cols) => cols.find(c => c.type === 'text').name,
      title: (cols) =>
        cols.find(c => c.type === 'number').name +
        ' over ' +
        cols.find(c => c.type === 'date').name +
        ' by ' +
        cols.find(c => c.type === 'text').name,
      priority: 1,
      echartsHints: {
        xAxis: { type: 'time' },
        tooltip: { trigger: 'axis' },
        legend: { show: true, type: 'scroll' },
        dataZoom: [{ type: 'slider', start: 0, end: 100 }]
      }
    }
  }
];
</code>


### Get more heteuristc rules for specialized charts from multiple AI agents:
**Prompt:**
<code>
Continuing the same JavaScript heuristic rule format as above 
({id, description, condition, suggestion}), give me rules for 
these trickier scenarios in Apache ECharts:

1. A column named or containing 'lat' or 'latitude' AND 'lon' or 'longitude'
2. A column that appears to be a percentage (values 0-100, name contains 
   'pct', 'percent', 'rate', 'ratio')
3. A column that appears to be a KPI or single aggregate 
   (rowCount === 1, type is number)
4. Many rows (>500) with one date and one number — performance considerations
5. A column with exactly 2 unique values (binary/boolean-like)
6. Columns whose names suggest a funnel or pipeline 
   (e.g. 'stage', 'step', 'phase', 'status')
7. A numeric column where max/min ratio > 1000 (wide range — log scale?)
8. Two date columns (start/end — timeline or Gantt?)
9. Columns suggesting a hierarchy (e.g. 'category' + 'subcategory')
10. A single text column with high cardinality (>50% unique) — word cloud?
11. A column with glucose values (from CGM) in mg/dl or mmol/dl, a column for date/reading timestamp, and sometimes a column for insulin delivered.
12. A column for ticket assignee / technician name / analyst ID and a column for tiket numbers (not aggregated) or number of tickets (aggregated), and possibly columns for ticket status and customer rating / 1-5 star satisfaction score.
13. A column for date/time stamp/sleep log id and a column for sleep stage (e.g. awake, light, deep, REM), and possibly a column for HRV RMSSD (average or non-aggregated)
14. A column for study name/study ID, a column for participant ID, and numeric metrics for things like % compliance, % wear time, total device wear time, and possibly a study enrollment status.

For each, include a comment explaining the ECharts-specific configuration consideration.

</code>


**Output:**
<code>
/* Gemini 3 Pro (via UM enterprise license) */
const advanced_chart_rules_gemini = [
  // 1. Lat/Lon mapping
  {
    id: 'rule_013',
    description: 'Geospatial scatter plot for latitude and longitude coordinates',
    condition: (cols, meta) => 
      cols.some(c => /lat(itude)?/i.test(c.name)) && 
      cols.some(c => /lon(gitude)?/i.test(c.name)),
    suggestion: {
      chartType: 'scatter',
      xField: cols => cols.find(c => /lon(gitude)?/i.test(c.name)).name,
      yFields: cols => [cols.find(c => /lat(itude)?/i.test(c.name)).name],
      seriesField: null,
      title: 'Geospatial Distribution',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: ECharts requires a coordinate system map (like 'geo' or an extension like 'bmap' for Baidu / 'leaflet'). 
        // If no map extension is loaded, plotting lat/lon on standard value axes with scaled min/max acts as a basic fallback map.
        coordinateSystem: 'cartesian2d', 
        xAxis: { type: 'value', scale: true, name: 'Longitude' },
        yAxis: { type: 'value', scale: true, name: 'Latitude' }
      }
    }
  },

  // 2. Percentage or Rate
  {
    id: 'rule_014',
    description: 'Metrics representing a percentage or ratio bounded to 0-100',
    condition: (cols, meta) => 
      cols.some(c => c.type === 'number' && /pct|percent|rate|ratio/i.test(c.name)),
    suggestion: {
      chartType: 'bar', // or line if date is present
      xField: cols => {
        const cat = cols.find(c => c.type === 'text' || c.type === 'date');
        return cat ? cat.name : null;
      },
      yFields: cols => [cols.find(c => c.type === 'number' && /pct|percent|rate|ratio/i.test(c.name)).name],
      seriesField: null,
      title: cols => `${cols.find(c => /pct|percent|rate|ratio/i.test(c.name)).name} Distribution`,
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Hardcode the Y-axis max to 100 (or 1 if decimal) to prevent misleading scales, 
        // and format the axis label with a '%' sign.
        yAxis: { max: 100, axisLabel: { formatter: '{value} %' } }
      }
    }
  },

  // 3. KPI / Single Aggregate
  {
    id: 'rule_015',
    description: 'A single aggregated number to be displayed as a KPI metric',
    condition: (cols, meta) => 
      meta.rowCount === 1 && cols.some(c => c.type === 'number'),
    suggestion: {
      chartType: 'gauge', // Native fallback for a big number
      xField: null,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: cols => cols.find(c => c.type === 'number').name,
      priority: 1,
      echartsHints: {
        // ECharts Consideration: ECharts doesn't have a native "Big Number/KPI" chart type. 
        // The best approach is a Gauge chart, or using the `graphic` component to draw pure text.
        series: [{ type: 'gauge', progress: { show: true }, detail: { valueAnimation: true } }]
      }
    }
  },

  // 4. High volume time series (>500 rows)
  {
    id: 'rule_016',
    description: 'High-density time series requiring performance optimizations',
    condition: (cols, meta) => 
      meta.rowCount > 500 && 
      cols.some(c => c.type === 'date') && 
      cols.some(c => c.type === 'number'),
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: cols => `${cols.find(c => c.type === 'number').name} Trend`,
      priority: 1,
      echartsHints: {
        // ECharts Consideration: For large datasets, enable data zooming for navigation 
        // and 'lttb' (Largest Triangle Three Buckets) downsampling to keep canvas rendering ultra-fast without losing peaks.
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
        series: [{ showSymbol: false, sampling: 'lttb' }]
      }
    }
  },

  // 5. Binary / Boolean-like grouping
  {
    id: 'rule_017',
    description: 'Value breakdown by a binary/two-state category',
    condition: (cols, meta) => 
      cols.some(c => c.cardinality === 2) && 
      cols.some(c => c.type === 'number'),
    suggestion: {
      chartType: 'pie',
      xField: cols => cols.find(c => c.cardinality === 2).name,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null,
      title: cols => `${cols.find(c => c.type === 'number').name} by ${cols.find(c => c.cardinality === 2).name}`,
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Binary data is perfect for a ring/donut pie chart.
        series: [{ type: 'pie', radius: ['40%', '70%'], itemStyle: { borderRadius: 10 } }]
      }
    }
  },

  // 6. Funnel / Pipeline
  {
    id: 'rule_018',
    description: 'Process stages showing drop-off or conversion rates',
    condition: (cols, meta) => 
      cols.some(c => /stage|step|phase|status/i.test(c.name)) && 
      cols.some(c => c.type === 'number'),
    suggestion: {
      chartType: 'funnel',
      xField: null,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: cols => cols.find(c => /stage|step|phase|status/i.test(c.name)).name,
      title: 'Pipeline Conversion',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Funnel charts require `sort: 'descending'` to look correct, 
        // and mapping the stage names to the `name` property in the data objects.
        series: [{ type: 'funnel', sort: 'descending', label: { position: 'right' } }]
      }
    }
  },

  // 7. High variance / Log scale needed
  {
    id: 'rule_019',
    description: 'Numeric data with extreme outliers or exponential growth',
    condition: (cols, meta) => 
      // Note: Assuming your meta/schema sniffer calculates min/max during AlaSQL phase
      cols.some(c => c.type === 'number' && c.max && c.min && (c.max / (c.min || 1)) > 1000),
    suggestion: {
      chartType: 'line', // or bar/scatter
      xField: cols => cols.find(c => c.type !== 'number')?.name || null,
      yFields: cols => [cols.find(c => c.type === 'number' && c.max / (c.min || 1) > 1000).name],
      seriesField: null,
      title: 'Exponential / Wide Range Metrics',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Switch yAxis type to 'log' so smaller values aren't squashed into a flat line by extreme outliers.
        yAxis: { type: 'log', minorTick: { show: true } }
      }
    }
  },

  // 8. Two Dates (Gantt / Timeline)
  {
    id: 'rule_020',
    description: 'Start and End dates indicating durations or schedules',
    condition: (cols, meta) => 
      cols.filter(c => c.type === 'date').length >= 2 && 
      cols.some(c => c.type === 'text'),
    suggestion: {
      chartType: 'custom', // ECharts uses 'custom' or stacked bars for Gantt
      xField: cols => cols.find(c => c.type === 'text').name, // The task name
      yFields: cols => cols.filter(c => c.type === 'date').map(c => c.name),
      seriesField: null,
      title: 'Project / Event Timeline',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: ECharts has no native "Gantt" type. You must use a "stacked bar" hack 
        // where the first series (Start Date) is rendered completely transparent, and the second series (Duration) sits on top of it.
        xAxis: { type: 'time' },
        yAxis: { type: 'category' }
      }
    }
  },

  // 9. Hierarchy
  {
    id: 'rule_021',
    description: 'Nested hierarchical data requiring drill-down or part-to-whole view',
    condition: (cols, meta) => 
      cols.some(c => /cat(egory)?/i.test(c.name)) && 
      cols.some(c => /sub\-?cat(egory)?|type/i.test(c.name)) &&
      cols.some(c => c.type === 'number'),
    suggestion: {
      chartType: 'sunburst', // or treemap
      xField: null,
      yFields: cols => [cols.find(c => c.type === 'number').name],
      seriesField: null, // Logic needs to map category -> subcategory
      title: 'Hierarchical Breakdown',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Sunburst/Treemap requires data strictly formatted as nested JSON children trees 
        // [{name, value, children: []}]. Your heuristic engine will need an AlaSQL GROUP BY layer to transform the flat table before passing to ECharts.
        series: [{ type: 'sunburst', radius: ['15%', '80%'] }]
      }
    }
  },

  // 10. High Cardinality Text
  {
    id: 'rule_022',
    description: 'Text column with many unique values, unsuitable for standard categorical axes',
    condition: (cols, meta) => 
      cols.some(c => c.type === 'text' && (c.cardinality / meta.rowCount) > 0.5),
    suggestion: {
      chartType: 'bar',
      xField: cols => cols.find(c => c.type === 'text' && (c.cardinality / meta.rowCount) > 0.5).name,
      yFields: cols => [cols.find(c => c.type === 'number')?.name || 'Count'],
      seriesField: null,
      title: 'Top Occurrences',
      priority: 2,
      echartsHints: {
        // ECharts Consideration: A WordCloud requires the external `echarts-wordcloud` extension. 
        // Native fallback is a Bar chart, but you MUST enforce a horizontal orientation (yAxis: category) 
        // and a slider dataZoom, otherwise the axis labels will overlap into an unreadable mess.
        xAxis: { type: 'value' },
        yAxis: { type: 'category', inverse: true },
        dataZoom: [{ type: 'slider', yAxisIndex: 0, start: 0, end: 10 }] // Show only top 10% initially
      }
    }
  },

  // 11. CGM Glucose Data
  {
    id: 'rule_023',
    description: 'Continuous Glucose Monitoring data with clinical target ranges',
    condition: (cols, meta) => 
      cols.some(c => /glucose|cgm/i.test(c.name)) && 
      cols.some(c => c.type === 'date'),
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => /glucose|cgm/i.test(c.name)).name],
      seriesField: cols => cols.find(c => /insulin/i.test(c.name))?.name || null,
      title: 'Ambulatory Glucose Profile',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Use `markArea` to shade the clinical target range (e.g., 70-180 mg/dL).
        // If insulin is present, it can be mapped to a second Y-axis as a bar chart overlaid on the glucose line.
        yAxis: { name: 'mg/dL' }, // or mmol/L depending on data sniff
        series: [{ 
          type: 'line', 
          markArea: { itemStyle: { color: 'rgba(0, 255, 0, 0.1)' }, data: [[{ yAxis: 70 }, { yAxis: 180 }]] } 
        }]
      }
    }
  },

  // 12. IT / Support Ticketing
  {
    id: 'rule_024',
    description: 'Support technician performance and ticket volume',
    condition: (cols, meta) => 
      cols.some(c => /assignee|technician|analyst/i.test(c.name)) && 
      cols.some(c => /ticket/i.test(c.name)),
    suggestion: {
      chartType: 'bar',
      xField: cols => cols.find(c => /assignee|technician|analyst/i.test(c.name)).name,
      yFields: cols => [cols.find(c => /ticket/i.test(c.name)).name],
      seriesField: cols => cols.find(c => /status/i.test(c.name))?.name || null,
      title: 'Ticket Workload by Assignee',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: If a 'status' column exists, stack the bars. 
        // If 'rating' (1-5) exists, consider a dual y-axis (`yAxisIndex: 1`) plotting average rating as a line overlay.
        series: [{ stack: 'total' }]
      }
    }
  },

  // 13. Sleep Stages
  {
    id: 'rule_025',
    description: 'Hypnogram displaying discrete sleep stages over the night',
    condition: (cols, meta) => 
      cols.some(c => /sleep|stage/i.test(c.name)) && 
      cols.some(c => c.type === 'date'),
    suggestion: {
      chartType: 'line',
      xField: cols => cols.find(c => c.type === 'date').name,
      yFields: cols => [cols.find(c => /sleep|stage/i.test(c.name)).name],
      seriesField: null,
      title: 'Sleep Architecture (Hypnogram)',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: Standard lines interpolate between points, which ruins stage data. 
        // You MUST use `step: 'start'` or `step: 'end'` to create rigid, 90-degree stair-steps. 
        // Y-axis must map categorical strings ('Awake', 'REM') to numeric indices behind the scenes.
        series: [{ type: 'line', step: 'start' }],
        yAxis: { type: 'category', data: ['Deep', 'Light', 'REM', 'Awake'] }
      }
    }
  },

  // 14. Clinical / Device Study
  {
    id: 'rule_026',
    description: 'Participant device compliance and wear time in a clinical trial',
    condition: (cols, meta) => 
      cols.some(c => /study/i.test(c.name)) && 
      cols.some(c => /participant|subject/i.test(c.name)) &&
      cols.some(c => /compliance|wear/i.test(c.name)),
    suggestion: {
      chartType: 'scatter',
      xField: cols => cols.find(c => /participant|subject/i.test(c.name)).name,
      yFields: cols => cols.filter(c => /compliance|wear/i.test(c.name)).map(c => c.name),
      seriesField: cols => cols.find(c => /status/i.test(c.name))?.name || null,
      title: 'Participant Wear Compliance',
      priority: 1,
      echartsHints: {
        // ECharts Consideration: A scatter plot provides a bird's-eye view of adherence across a cohort.
        // Add a `markLine` for the study protocol minimum (e.g., 80% compliance threshold) so coordinators can instantly spot drop-outs.
        series: [{ 
          type: 'scatter', 
          markLine: { data: [{ yAxis: 80, name: 'Compliance Threshold' }], lineStyle: { color: 'red', type: 'dashed' } } 
        }]
      }
    }
  }
];



/* Mistral Small 3 (via DuckDuckGo AI) */
const advanced_chart_rules_mistral = [
  {
    id: 'rule_013',
    description: 'A column named or containing lat/lon',
    condition: (cols, meta) => {
      const latCol = cols.find(col => col.name.toLowerCase().includes('lat') || col.name.toLowerCase().includes('latitude'));
      const lonCol = cols.find(col => col.name.toLowerCase().includes('lon') || col.name.toLowerCase().includes('longitude'));
      return latCol && lonCol;
    },
    suggestion: {
      chartType: 'scatter',
      xField: 'lon',
      yFields: ['lat'],
      title: 'Geospatial scatter plot',
      priority: 1,
      echartsHints: { geo: { map: 'world' } } // Use ECharts geo component
    }
  },
  {
    id: 'rule_014',
    description: 'A column that appears to be a percentage',
    condition: (cols, meta) => {
      const pctCol = cols.find(col => {
        const pctKeywords = ['pct', 'percent', 'rate', 'ratio'];
        return pctKeywords.some(keyword => col.name.toLowerCase().includes(keyword)) && col.type === 'number';
      });
      return pctCol;
    },
    suggestion: {
      chartType: 'gauge',
      xField: null,
      yFields: ['pct'],
      title: 'Percentage gauge',
      priority: 2,
      echartsHints: { series: { type: 'gauge', min: 0, max: 100 } } // Use ECharts gauge series
    }
  },
  {
    id: 'rule_015',
    description: 'A column that appears to be a KPI or single aggregate',
    condition: (cols, meta) => {
      return meta.rowCount === 1 && cols.some(col => col.type === 'number');
    },
    suggestion: {
      chartType: 'gauge',
      xField: null,
      yFields: cols.filter(col => col.type === 'number').map(col => col.name),
      title: 'KPI gauge',
      priority: 1,
      echartsHints: { series: { type: 'gauge', min: 0, max: 100 } } // Use ECharts gauge series
    }
  },
  {
    id: 'rule_016',
    description: 'Many rows (>500) with one date and one number',
    condition: (cols, meta) => {
      const dateCol = cols.find(col => col.type === 'date');
      const numberCol = cols.find(col => col.type === 'number');
      return dateCol && numberCol && meta.rowCount > 500;
    },
    suggestion: {
      chartType: 'line',
      xField: 'date',
      yFields: ['number'],
      title: 'Trend over time (large dataset)',
      priority: 2,
      echartsHints: { animation: false } // Disable animation for performance
    }
  },
  {
    id: 'rule_017',
    description: 'A column with exactly 2 unique values (binary/boolean-like)',
    condition: (cols, meta) => {
      return cols.some(col => col.cardinality === 2);
    },
    suggestion: {
      chartType: 'pie',
      xField: null,
      yFields: cols.filter(col => col.cardinality === 2).map(col => col.name),
      title: 'Binary distribution',
      priority: 3,
      echartsHints: {} // Use ECharts pie series
    }
  },
  {
    id: 'rule_018',
    description: 'Columns suggesting a funnel or pipeline',
    condition: (cols, meta) => {
      const funnelKeywords = ['stage', 'step', 'phase', 'status'];
      const funnelCols = cols.filter(col => funnelKeywords.some(keyword => col.name.toLowerCase().includes(keyword)));
      return funnelCols.length > 1;
    },
    suggestion: {
      chartType: 'funnel',
      xField: null,
      yFields: funnelCols.map(col => col.name),
      title: 'Funnel chart',
      priority: 2,
      echartsHints: { series: { type: 'funnel' } } // Use ECharts funnel series
    }
  },
  {
    id: 'rule_019',
    description: 'A numeric column with wide range (log scale?)',
    condition: (cols, meta) => {
      const numberCol = cols.find(col => col.type === 'number');
      const data = alasql('SELECT * FROM [dlv_results]');
      const max = Math.max(...data.map(row => row[numberCol.name]));
      const min = Math.min(...data.map(row => row[numberCol.name]));
      return numberCol && max / min > 1000;
    },
    suggestion: {
      chartType: 'scatter',
      xField: numberCol.name,
      yFields: [],
      title: 'Log scale scatter plot',
      priority: 2,
      echartsHints: { xAxis: { type: 'log' }, yAxis: { type: 'log' } } // Use log scale for axes
    }
  },
  {
    id: 'rule_020',
    description: 'Two date columns (start/end — timeline or Gantt?)',
    condition: (cols, meta) => {
      const dateCols = cols.filter(col => col.type === 'date');
      return dateCols.length === 2;
    },
    suggestion: {
      chartType: 'timeline',
      xField: dateCols[0].name,
      yFields: [dateCols[1].name],
      title: 'Timeline chart',
      priority: 2,
      echartsHints: { series: { type: 'timeline' } } // Use ECharts timeline series
    }
  },
  {
    id: 'rule_021',
    description: 'Columns suggesting a hierarchy',
    condition: (cols, meta) => {
      const hierarchyKeywords = ['category', 'subcategory'];
      const hierarchyCols = cols.filter(col => hierarchyKeywords.some(keyword => col.name.toLowerCase().includes(keyword)));
      return hierarchyCols.length > 1;
    },
    suggestion: {
      chartType: 'treemap',
      xField: hierarchyCols[0].name,
      yFields: [hierarchyCols[1].name],
      title: 'Hierarchical treemap',
      priority: 2,
      echartsHints: { series: { type: 'treemap' } } // Use ECharts treemap series
    }
  },
  {
    id: 'rule_022',
    description: 'A single text column with high cardinality',
    condition: (cols, meta) => {
      const textCol = cols.find(col => col.type === 'text' && col.cardinality / meta.rowCount > 0.5);
      return textCol;
    },
    suggestion: {
      chartType: 'wordCloud',
      xField: null,
      yFields: [textCol.name],
      title: 'Word cloud',
      priority: 3,
      echartsHints: { series: { type: 'wordCloud' } } // Use ECharts wordCloud series
    }
  },
  {
    id: 'rule_023',
    description: 'A column with glucose values (from CGM) in mg/dl or mmol/dl, a column for date/reading timestamp, and sometimes a column for insulin delivered.',
    condition: (cols, meta) => {
      const glucoseCol = cols.find(col => col.name.toLowerCase().includes('glucose') && (col.name.toLowerCase().includes('mg/dl') || col.name.toLowerCase().includes('mmol/dl')));
      const dateCol = cols.find(col => col.type === 'date');
      const insulinCol = cols.find(col => col.name.toLowerCase().includes('insulin'));
      return glucoseCol && dateCol && (insulinCol || true);
    },
    suggestion: {
      chartType: 'line',
      xField: 'date',
      yFields: ['glucose'],
      seriesField: 'insulin',
      title: 'Glucose levels over time',
      priority: 1,
      echartsHints: { series: { type: 'line' } } // Use ECharts line series
    }
  },
  {
    id: 'rule_024',
    description: 'A column for ticket assignee / technician name / analyst ID and a column for tiket numbers (not aggregated) or number of tickets (aggregated), and possibly columns for ticket status and customer rating / 1-5 star satisfaction score.',
    condition: (cols, meta) => {
      const assigneeCol = cols.find(col => col.name.toLowerCase().includes('assignee') || col.name.toLowerCase().includes('technician') || col.name.toLowerCase().includes('analyst'));
      const ticketCol = cols.find(col => col.name.toLowerCase().includes('ticket') && col.type === 'number');
      const statusCol = cols.find(col => col.name.toLowerCase().includes('status'));
      const ratingCol = cols.find(col => col.name.toLowerCase().includes('rating') || col.name.toLowerCase().includes('score'));
      return assigneeCol && ticketCol && (statusCol || true) && (ratingCol || true);
    },
    suggestion: {
      chartType: 'bar',
      xField: 'assignee',
      yFields: ['ticket'],
      seriesField: 'status',
      title: 'Tickets by assignee',
      priority: 2,
      echartsHints: { series: { type: 'bar' } } // Use ECharts bar series
    }
  },
  {
    id: 'rule_025',
    description: 'A column for date/time stamp/sleep log id and a column for sleep stage (e.g. awake, light, deep, REM), and possibly a column for HRV RMSSD (average or non-aggregated)',
    condition: (cols, meta) => {
      const dateCol = cols.find(col => col.type === 'date');
      const stageCol = cols.find(col => col.name.toLowerCase().includes('stage') && col.type === 'text');
      const hrvCol = cols.find(col => col.name.toLowerCase().includes('hrv') || col.name.toLowerCase().includes('rmssd'));
      return dateCol && stageCol && (hrvCol || true);
    },
    suggestion: {
      chartType: 'line',
      xField: 'date',
      yFields: ['stage'],
      seriesField: 'hrv',
      title: 'Sleep stages over time',
      priority: 2,
      echartsHints: { series: { type: 'line' } } // Use ECharts line series
    }
  },
  {
    id: 'rule_026',
    description: 'A column for study name/study ID, a column for participant ID, and numeric metrics for things like % compliance, % wear time, total device wear time, and possibly a study enrollment status.',
    condition: (cols, meta) => {
      const studyCol = cols.find(col => col.name.toLowerCase().includes('study'));
      const participantCol = cols.find(col => col.name.toLowerCase().includes('participant'));
      const complianceCol = cols.find(col => col.name.toLowerCase().includes('% compliance') || col.name.toLowerCase().includes('% wear time'));
      const wearTimeCol = cols.find(col => col.name.toLowerCase().includes('wear time'));
      const statusCol = cols.find(col => col.name.toLowerCase().includes('status'));
      return studyCol && participantCol && complianceCol && wearTimeCol && (statusCol || true);
    },
    suggestion: {
      chartType: 'bar',
      xField: 'study',
      yFields: ['compliance', 'wearTime'],
      seriesField: 'status',
      title: 'Study metrics by participant',
      priority: 2,
      echartsHints: { series: { type: 'bar' } } // Use ECharts bar series
    }
  }
];



/* gpt-oss 120B (via DuckDuckGo AI) */
const advanced_chart_rules_gpt_oss = [
  {
    // 1. Latitude / Longitude pair → geo map or scatter on map
    id: 'rule_101',
    description: "Columns named like 'lat'/'latitude' and 'lon'/'longitude'",
    condition: (cols, meta) => {
      const lat = cols.find(c => /lat|latitude/i.test(c.name));
      const lon = cols.find(c => /lon|longitude/i.test(c.name));
      return !!lat && !!lon;
    },
    suggestion: {
      chartType: 'scatter',
      xField: cols.find(c => /lon|longitude/i.test(c.name)).name,
      yFields: [cols.find(c => /lat|latitude/i.test(c.name)).name],
      seriesField: '',
      title: 'Geospatial distribution',
      priority: 1,
      // Use coordinateSystem: 'geo' in ECharts options
      echartsHints: { geo: { map: 'world' }, series: [{ coordinateSystem: 'geo' }] }
    }
  },
  {
    // 2. Percentage column → bar/line with axis formatter "%"
    id: 'rule_102',
    description: "Column looks like a percentage (0‑100 values, name contains pct/percent/rate/ratio)",
    condition: (cols, meta) => {
      return cols.some(c =>
        /pct|percent|rate|ratio/i.test(c.name) &&
        c.type === 'number' &&
        c.min >= 0 && c.max <= 100
      );
    },
    suggestion: {
      chartType: 'bar',
      xField: '',
      yFields: [cols.find(c => /pct|percent|rate|ratio/i.test(c.name)).name],
      seriesField: '',
      title: '`{yFields[0]}` percentage',
      priority: 2,
      // axisLabel formatter to add "%"
      echartsHints: {
        yAxis: { axisLabel: { formatter: '{value} %' } },
        tooltip: { formatter: '{b}: {c} %' }
      }
    }
  },
  {
    // 3. Single‑row KPI → gauge or large metric card
    id: 'rule_103',
    description: 'Single‑row numeric result – KPI or aggregate',
    condition: (cols, meta) => meta.rowCount === 1 && cols.some(c => c.type === 'number'),
    suggestion: {
      chartType: 'gauge',
      xField: '',
      yFields: [cols.find(c => c.type === 'number').name],
      seriesField: '',
      title: '`{yFields[0]}` KPI',
      priority: 1,
      // gauge options can be customized later
      echartsHints: { series: [{ type: 'gauge', detail: { formatter: '{value}' } }] }
    }
  },
  {
    // 4. Large dataset → sampling / down‑sample for line/area
    id: 'rule_104',
    description: '>500 rows with one date and one number – consider performance',
    condition: (cols, meta) => {
      const date = cols.some(c => c.type === 'date');
      const num = cols.filter(c => c.type === 'number').length === 1;
      return meta.rowCount > 500 && date && num;
    },
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => c.type === 'date').name,
      yFields: [cols.filter(c => c.type === 'number')[0].name],
      seriesField: '',
      title: '`{xField}` trend (large dataset)',
      priority: 2,
      // enable large dataset mode
      echartsHints: { series: [{ large: true, largeThreshold: 2000 }] }
    }
  },
  {
    // 5. Binary column → stacked bar or pie
    id: 'rule_105',
    description: 'Column with exactly 2 unique values (binary‑like)',
    condition: (cols, meta) => cols.some(c => c.cardinality === 2),
    suggestion: {
      chartType: 'pie',
      xField: '',
      yFields: [cols.find(c => c.cardinality === 2).name],
      seriesField: '',
      title: '`{yFields[0]}` distribution',
      priority: 2,
      echartsHints: { legend: { orient: 'vertical' } }
    }
  },
  {
    // 6. Funnel/pipeline stages → funnel chart
    id: 'rule_106',
    description: 'Columns whose names suggest funnel stages (stage, step, phase, status)',
    condition: (cols, meta) => cols.some(c => /stage|step|phase|status/i.test(c.name)),
    suggestion: {
      chartType: 'funnel',
      xField: '',
      yFields: [cols.find(c => /stage|step|phase|status/i.test(c.name)).name],
      seriesField: '',
      title: '`{yFields[0]}` funnel',
      priority: 2,
      echartsHints: { series: [{ sort: 'descending' }] }
    }
  },
  {
    // 7. Wide numeric range → log scale recommendation
    id: 'rule_107',
    description: 'Numeric column where max/min > 1000 (wide range) – suggest log axis',
    condition: (cols, meta) => cols.some(c => c.type === 'number' && c.max / (c.min || 1) > 1000),
    suggestion: {
      chartType: 'bar',
      xField: '',
      yFields: [cols.find(c => c.type === 'number' && c.max / (c.min || 1) > 1000).name],
      seriesField: '',
      title: '`{yFields[0]}` (log scale)',
      priority: 2,
      // configure yAxis as log
      echartsHints: { yAxis: { type: 'log' } }
    }
  },
  {
    // 8. Start/End dates → Gantt‑like timeline (custom bar)
    id: 'rule_108',
    description: 'Two date columns (start/end) – suitable for timeline/Gantt',
    condition: (cols, meta) => {
      const dates = cols.filter(c => c.type === 'date');
      return dates.length >= 2;
    },
    suggestion: {
      chartType: 'custom',
      xField: '',
      yFields: [],
      seriesField: '',
      title: 'Timeline view',
      priority: 2,
      // Use graphic component or custom series to render bars between start/end
      echartsHints: {
        tooltip: { trigger: 'item' },
        series: [{ type: 'custom', renderItem: /* custom Gantt renderer */ null }]
      }
    }
  },
  {
    // 9. Hierarchical categories → treemap
    id: 'rule_109',
    description: "Columns suggesting hierarchy (e.g., 'category' + 'subcategory')",
    condition: (cols, meta) => {
      const cat = cols.find(c => /category/i.test(c.name));
      const sub = cols.find(c => /subcategory|subcat/i.test(c.name));
      return cat && sub;
    },
    suggestion: {
      chartType: 'treemap',
      xField: '',
      yFields: [],
      seriesField: '',
      title: 'Hierarchical breakdown',
      priority: 1,
      echartsHints: {
        series: [{ leafDepth: 2, roam: true }]
      }
    }
  },
  {
    // 10. High‑cardinality text → word‑cloud (custom)
    id: 'rule_110',
    description: 'Single text column with >50% unique values – word cloud',
    condition: (cols, meta) => {
      const txt = cols.find(c => c.type === 'text');
      return txt && txt.cardinality / meta.rowCount > 0.5;
    },
    suggestion: {
      chartType: 'custom',
      xField: '',
      yFields: [],
      seriesField: '',
      title: '`{txt.name}` word cloud',
      priority: 3,
      // Requires third‑party word‑cloud series or custom rendering
      echartsHints: {
        series: [{ type: 'custom', renderItem: /* word‑cloud renderer */ null }]
      }
    }
  },
  {
    // 11. CGM glucose + timestamp (+ optional insulin) → line + scatter overlay
    id: 'rule_111',
    description: 'Glucose (mg/dL or mmol/L) with timestamp, optional insulin column',
    condition: (cols, meta) => {
      const glucose = cols.find(c => /glucose|bg|glyc|cgm/i.test(c.name) && c.type === 'number');
      const time = cols.find(c => /date|time|timestamp/i.test(c.name) && c.type === 'date');
      return glucose && time;
    },
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => /date|time|timestamp/i.test(c.name)).name,
      yFields: [cols.find(c => /glucose|bg|glyc|cgm/i.test(c.name)).name],
      seriesField: '',
      title: 'Continuous Glucose Monitoring',
      priority: 1,
      echartsHints: {
        // overlay insulin as scatter if present
        series: [
          { type: 'line' },
          {
            type: 'scatter',
            data: [], // populated at runtime if insulin column exists
            encode: { x: 'timestamp', y: 'insulin' }
          }
        ]
      }
    }
  },
  {
    // 12. Ticket analytics – assignee vs ticket count, status, rating → bar + heatmap
    id: 'rule_112',
    description: 'Ticket assignee + ticket count (+ status/rating) – bar or heatmap',
    condition: (cols, meta) => {
      const assignee = cols.find(c => /assignee|technician|analyst/i.test(c.name) && c.type === 'text');
      const count = cols.find(c => /ticket.*count|num.*ticket/i.test(c.name) && c.type === 'number');
      return assignee && count;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => /assignee|technician|analyst/i.test(c.name)).name,
      yFields: [cols.find(c => /ticket.*count|num.*ticket/i.test(c.name)).name],
      seriesField: '',
      title: '`{xField}` ticket volume',
      priority: 2,
      echartsHints: {
        // if status column exists, switch to stacked bar
        tooltip: { trigger: 'axis' },
        series: [{ type: 'bar', stack: 'total' }]
      }
    }
  },
  {
    // 13. Sleep log – timestamp + stage (+ HRV) → stacked bar or line/area
    id: 'rule_113',
    description: 'Sleep stage log with timestamp, optional HRV – stacked bar timeline',
    condition: (cols, meta) => {
      const stage = cols.find(c => /stage|sleep.*stage/i.test(c.name) && c.type === 'text');
      const time = cols.find(c => /date|time|timestamp/i.test(c.name) && c.type === 'date');
      return stage && time;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => /date|time|timestamp/i.test(c.name)).name,
      yFields: [cols.find(c => /stage|sleep.*stage/i.test(c.name)).name],
      seriesField: '',
      title: 'Sleep stages over time',
      priority: 2,
      // use stacked bar, each stage a series
      echartsHints: {
        series: [{ type: 'bar', stack: 'sleep' }],
        legend: { show: true }
      }
    }
  },
  {
    // 14. Study metrics – participant ID + compliance etc. → radar or multi‑bar
    id: 'rule_114',
    description: 'Study ID + participant ID + % compliance / wear time – radar chart',
    condition: (cols, meta) => {
      const study = cols.find(c => /study.*id|study.*name/i.test(c.name));
      const participant = cols.find(c => /participant|subject|pid/i.test(c.name));
      const perc = cols.filter(c => /%|percent|compliance|wear.*time/i.test(c.name) && c.type === 'number');
      return study && participant && perc.length >= 2;
    },
    suggestion: {
      chartType: 'radar',
      xField: '',
      yFields: cols.filter(c => /%|percent|compliance|wear.*time/i.test(c.name) && c.type === 'number').map(c => c.name),
      seriesField: '',
      title: 'Participant compliance overview',
      priority: 2,
      echartsHints: {
        radar: { indicator: [] }, // indicators filled at runtime per metric
        tooltip: { trigger: 'item' }
      }
    }
  }
];



/* Llama 4 Scout (via DuckDucGo AI) */
const advanced_chart_rules_llama = [
  // 1. A column named or containing 'lat' or 'latitude' AND 'lon' or 'longitude'
  {
    id: 'rule_013',
    description: 'Latitude and Longitude columns',
    condition: (cols, meta) => {
      const latCol = cols.find(c => c.name.toLowerCase().includes('lat') || c.name.toLowerCase().includes('latitude'));
      const lonCol = cols.find(c => c.name.toLowerCase().includes('lon') || c.name.toLowerCase().includes('longitude'));
      return latCol && lonCol;
    },
    suggestion: {
      chartType: 'scatter',
      xField: 'longitude',
      yFields: ['latitude'],
      echartsHints: {
        geo: {
          type: 'map',
          map: 'china' // or other map type
        }
      },
      title: 'Geographic Scatter Plot',
      priority: 1
    }
  },

  // 2. A column that appears to be a percentage (values 0-100, name contains 'pct', 'percent', 'rate', 'ratio')
  {
    id: 'rule_014',
    description: 'Percentage column',
    condition: (cols, meta) => {
      const col = cols.find(c => (c.name.toLowerCase().includes('pct') || c.name.toLowerCase().includes('percent') || c.name.toLowerCase().includes('rate') || c.name.toLowerCase().includes('ratio')) && c.type === 'number' && c.min >= 0 && c.max <= 100);
      return col;
    },
    suggestion: {
      chartType: 'gauge',
      yFields: [cols.find(c => (c.name.toLowerCase().includes('pct') || c.name.toLowerCase().includes('percent') || c.name.toLowerCase().includes('rate') || c.name.toLowerCase().includes('ratio')) && c.type === 'number' && c.min >= 0 && c.max <= 100).name],
      title: 'Percentage Gauge',
      priority: 1
    }
  },

  // 3. A column that appears to be a KPI or single aggregate (rowCount === 1, type is number)
  {
    id: 'rule_015',
    description: 'KPI column',
    condition: (cols, meta) => meta.rowCount === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'gauge',
      yFields: [cols.find(c => c.type === 'number').name],
      title: 'KPI Gauge',
      priority: 1
    }
  },

  // 4. Many rows (>500) with one date and one number — performance considerations
  {
    id: 'rule_016',
    description: 'Large dataset with date and number columns',
    condition: (cols, meta) => meta.rowCount > 500 && cols.filter(c => c.type === 'date').length === 1 && cols.filter(c => c.type === 'number').length === 1,
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => c.type === 'date').name,
      yFields: [cols.find(c => c.type === 'number').name],
      echartsHints: {
        // Use a large dataset optimization technique, such as sampling or aggregation
      },
      title: 'Large Dataset Line Chart',
      priority: 1
    }
  },

  // 5. A column with exactly 2 unique values (binary/boolean-like)
  {
    id: 'rule_017',
    description: 'Binary column',
    condition: (cols, meta) => cols.find(c => c.cardinality === 2),
    suggestion: {
      chartType: 'pie',
      seriesField: cols.find(c => c.cardinality === 2).name,
      title: 'Binary Pie Chart',
      priority: 1
    }
  },

  // 6. Columns whose names suggest a funnel or pipeline (e.g. 'stage', 'step', 'phase', 'status')
  {
    id: 'rule_018',
    description: 'Funnel columns',
    condition: (cols, meta) => cols.find(c => ['stage', 'step', 'phase', 'status'].includes(c.name.toLowerCase())),
    suggestion: {
      chartType: 'funnel',
      seriesField: cols.find(c => ['stage', 'step', 'phase', 'status'].includes(c.name.toLowerCase())).name,
      title: 'Funnel Chart',
      priority: 1
    }
  },

  // 7. A numeric column where max/min ratio > 1000 (wide range — log scale?)
  {
    id: 'rule_019',
    description: 'Wide range numeric column',
    condition: (cols, meta) => cols.find(c => c.type === 'number' && Math.max(...c.values) / Math.min(...c.values) > 1000),
    suggestion: {
      chartType: 'line',
      yFields: [cols.find(c => c.type === 'number' && Math.max(...c.values) / Math.min(...c.values) > 1000).name],
      echartsHints: {
        yAxis: {
          type: 'log'
        }
      },
      title: 'Wide Range Line Chart',
      priority: 1
    }
  },

  // 8. Two date columns (start/end — timeline or Gantt?)
  {
    id: 'rule_020',
    description: 'Two date columns',
    condition: (cols, meta) => cols.filter(c => c.type === 'date').length === 2,
    suggestion: {
      chartType: 'timeline',
      xField: cols.find(c => c.type === 'date' && cols.indexOf(c) === 0).name,
      yFields: [cols.find(c => c.type === 'date' && cols.indexOf(c) === 1).name],
      title: 'Timeline',
      priority: 1
    }
  },

  // 9. Columns suggesting a hierarchy (e.g. 'category' + 'subcategory')
  {
    id: 'rule_021',
    description: 'Hierarchical columns',
    condition: (cols, meta) => cols.find(c => c.name.toLowerCase().includes('category')) && cols.find(c => c.name.toLowerCase().includes('subcategory')),
    suggestion: {
      chartType: 'treemap',
      seriesField: cols.find(c => c.name.toLowerCase().includes('category')).name,
      title: 'Hierarchical Treemap',
      priority: 1
    }
  },

  // 10. A single text column with high cardinality (>50% unique) — word cloud?
  {
    id: 'rule_022',
    description: 'High cardinality text column',
    condition: (cols, meta) => cols.filter(c => c.type === 'text' && c.cardinality / meta.rowCount > 0.5).length === 1,
    suggestion: {
      chartType: 'wordCloud',
      seriesField: cols.find(c => c.type === 'text' && c.cardinality / meta.rowCount > 0.5).name,
      title: 'Word Cloud',
      priority: 1
    }
  },

  // 11. A column with glucose values (from CGM) in mg/dl or mmol/dl, a column for date/reading timestamp, and sometimes a column for insulin delivered.
  {
    id: 'rule_023',
    description: 'Glucose monitoring data',
    condition: (cols, meta) => {
      const glucoseCol = cols.find(c => c.name.toLowerCase().includes('glucose') || c.name.toLowerCase().includes('cgm'));
      const dateCol = cols.find(c => c.type === 'date');
      return glucoseCol && dateCol;
    },
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => c.type === 'date').name,
      yFields: [cols.find(c => c.name.toLowerCase().includes('glucose') || c.name.toLowerCase().includes('cgm')).name],
      title: 'Glucose Monitoring Line Chart',
      priority: 1
    }
  },

  // 12. A column for ticket assignee / technician name / analyst ID and a column for ticket numbers (not aggregated) or number of tickets (aggregated), and possibly columns for ticket status and customer rating / 1-5 star satisfaction score.
  {
    id: 'rule_024',
    description: 'Ticket data',
    condition: (cols, meta) => {
      const assigneeCol = cols.find(c => c.name.toLowerCase().includes('assignee') || c.name.toLowerCase().includes('technician') || c.name.toLowerCase().includes('analyst'));
      const ticketCol = cols.find(c => c.name.toLowerCase().includes('ticket'));
      return assigneeCol && ticketCol;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => c.name.toLowerCase().includes('assignee') || c.name.toLowerCase().includes('technician') || c.name.toLowerCase().includes('analyst')).name,
      yFields: [cols.find(c => c.name.toLowerCase().includes('ticket')).name],
      title: 'Ticket Bar Chart',
      priority: 1
    }
  },

  // 13. A column for date/time stamp/sleep log id and a column for sleep stage (e.g. awake, light, deep, REM), and possibly a column for HRV RMSSD (average or non-aggregated)
  {
    id: 'rule_025',
    description: 'Sleep data',
    condition: (cols, meta) => {
      const dateCol = cols.find(c => c.type === 'date');
      const sleepStageCol = cols.find(c => ['awake', 'light', 'deep', 'REM'].includes(c.name.toLowerCase()));
      return dateCol && sleepStageCol;
    },
    suggestion: {
      chartType: 'line',
      xField: cols.find(c => c.type === 'date').name,
      yFields: [cols.find(c => ['awake', 'light', 'deep', 'REM'].includes(c.name.toLowerCase())).name],
      title: 'Sleep Line Chart',
      priority: 1
    }
  },

  // 14. A column for study name/study ID, a column for participant ID, and numeric metrics for things like % compliance, % wear time, total device wear time, and possibly a study enrollment status.
  {
    id: 'rule_026',
    description: 'Study data',
    condition: (cols, meta) => {
      const studyCol = cols.find(c => c.name.toLowerCase().includes('study'));
      const participantCol = cols.find(c => c.name.toLowerCase().includes('participant'));
      return studyCol && participantCol;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols.find(c => c.name.toLowerCase().includes('study')).name,
      yFields: cols.filter(c => c.type === 'number').map(c => c.name),
      title: 'Study Bar Chart',
      priority: 1
    }
  }
];



/* ChatGPT 5.2 (via UMGPT) */
const advanced_chart_rules_chatgpt = [
  // 1) lat/lon columns
  // ECharts consideration: For true map plotting you need a geo component + a registered map (echarts.registerMap). Otherwise fall back to x/y scatter (lon on x, lat on y).
  {
    id: 'rule_101',
    description: "Has latitude-like and longitude-like columns → plot points on a geo/map (or fallback to lon/lat scatter).",
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const has = (name, re) => re.test(lc(name));
      const latRe = /(^|[^a-z])(lat|latitude)([^a-z]|$)/;
      const lonRe = /(^|[^a-z])(lon|lng|longitude)([^a-z]|$)/;

      const candidates = cols.filter(c => (c.nullPct ?? 0) < 0.98);
      const lats = candidates.filter(c => c.type === 'number' && has(c.name, latRe));
      const lons = candidates.filter(c => c.type === 'number' && has(c.name, lonRe));
      return lats.length >= 1 && lons.length >= 1 && (meta?.rowCount ?? 0) >= 1;
    },
    suggestion: {
      chartType: 'scatter',
      xField: '{{lon}}',
      yFields: ['{{lat}}'],
      seriesField: null,
      title: 'Locations (lat/lon)',
      priority: 1,
      echartsHints: {
        pick: {
          lat: { type: 'number', nameMatches: ['lat', 'latitude'], strategy: 'bestMatch' },
          lon: { type: 'number', nameMatches: ['lon', 'lng', 'longitude'], strategy: 'bestMatch' }
        },
        preprocess: {
          type: 'geoPoints',
          lonField: '{{lon}}',
          latField: '{{lat}}',
          // if a value field exists, engine may map it to symbolSize/color
          valueFieldStrategy: 'optionalBestNumericExcludingLatLon'
        },
        option: {
          // engine should enable geo only if a map is available; else fall back to xAxis/yAxis scatter
          geo: { map: 'world', roam: true, silent: false },
          tooltip: { trigger: 'item' },
          series: [
            {
              type: 'scatter',
              coordinateSystem: 'geo',
              symbolSize: 6,
              emphasis: { scale: true }
            }
          ]
        },
        fallbackOptionIfNoMapRegistered: {
          xAxis: { type: 'value', name: '{{lon}}' },
          yAxis: { type: 'value', name: '{{lat}}' },
          series: [{ type: 'scatter' }]
        }
      }
    }
  },

  // 2) percentage-like column
  // ECharts consideration: Clamp y-axis to [0, 100] and format labels/tooltips with a %; beware of values stored as 0–1 (ratio) vs 0–100 (percent).
  {
    id: 'rule_102',
    description: "Numeric column name suggests percent/rate and values appear 0–100 → format axis/tooltip as percent and clamp to 0–100.",
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const pctNameRe = /(pct|percent|percentage|rate|ratio)/;

      const rowCount = meta?.rowCount ?? 0;
      const candidates = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.95 && pctNameRe.test(lc(c.name)));
      if (!candidates.length || rowCount < 2) return false;

      const hasUsableDimension = cols.some(c =>
        (c.type === 'date' && (c.nullPct ?? 0) < 0.95) ||
        (c.type === 'text' && (c.nullPct ?? 0) < 0.95 && (c.cardinality ?? 1e9) <= 50)
      );
      if (!hasUsableDimension) return false;

      // Prefer true range check if engine supplies fieldStats; otherwise approximate via cardinality.
      const stats = meta?.fieldStats || meta?.stats || {};
      return candidates.some(c => {
        const st = stats[c.name] || stats[lc(c.name)];
        const rangeOk = st ? (st.min >= 0 && st.max <= 100) : ((c.cardinality ?? 999) <= 101 && (c.cardinality ?? 0) >= 3);
        return rangeOk;
      });
    },
    suggestion: {
      chartType: 'line',                 // works for time or category; engine can still pick xAxis type
      xField: '{{dimension}}',           // date preferred; else low-card text
      yFields: ['{{percent}}'],
      seriesField: null,
      title: '{{percent}} (percent)',
      priority: 2,
      echartsHints: {
        pick: {
          percent: { type: 'number', nameMatches: ['pct', 'percent', 'rate', 'ratio'], strategy: 'bestMatch' },
          dimension: { type: ['date', 'text'], strategy: 'dateElseMinCardText' }
        },
        option: {
          yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: { formatter: '{value}%' }
          },
          tooltip: { trigger: 'axis' },
          series: [{ type: 'line', showSymbol: false }]
        },
        dynamic: {
          xAxisType: 'timeIfDateElseCategory',
          tooltipValueFormatter: 'appendPercentSign'
        }
      }
    }
  },

  // 3) KPI / single aggregate
  // ECharts consideration: Use gauge with pointer hidden + big animated detail for “single number” KPI; keep chart minimal (no axis ticks/labels).
  {
    id: 'rule_103',
    description: 'rowCount === 1 with a numeric field → KPI gauge (single value).',
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      if (rowCount !== 1) return false;
      const nums = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.99);
      return nums.length >= 1;
    },
    suggestion: {
      chartType: 'gauge',
      xField: null,
      yFields: ['{{number}}'],
      seriesField: null,
      title: '{{number}}',
      priority: 1,
      echartsHints: {
        pick: { number: { type: 'number', strategy: 'first' } },
        preprocess: { type: 'singleValue', field: '{{number}}' },
        option: {
          tooltip: { show: false },
          series: [
            {
              type: 'gauge',
              startAngle: 90,
              endAngle: -270,
              pointer: { show: false },
              progress: { show: true, roundCap: true, clip: true },
              axisLine: { lineStyle: { width: 18 } },
              axisTick: { show: false },
              splitLine: { show: false },
              axisLabel: { show: false },
              anchor: { show: false },
              detail: { valueAnimation: true, fontSize: 28, offsetCenter: [0, 0] }
            }
          ]
        },
        dynamic: {
          // engine should set series[0].max to a sensible bound (e.g., meta.fieldStats.max, or a goal/threshold if known)
          gaugeMaxStrategy: 'useFieldMaxElseNiceRound'
        }
      }
    }
  },

  // 4) Large time series (performance)
  // ECharts consideration: For >500 points, disable symbols/animation and enable sampling ('lttb') + inside dataZoom throttling to keep interactions smooth.
  {
    id: 'rule_104',
    description: 'One date + one number with many rows (>500) → performance-tuned time-series line.',
    condition: (cols, meta) => {
      const rowCount = meta?.rowCount ?? 0;
      const totalCols = meta?.totalCols ?? cols.length;
      const dates = cols.filter(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95);
      const nums = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.95);
      const others = cols.filter(c => !['date', 'number'].includes(c.type));
      return rowCount > 500 && totalCols === 2 && dates.length === 1 && nums.length === 1 && others.length === 0;
    },
    suggestion: {
      chartType: 'line',
      xField: '{{date}}',
      yFields: ['{{number}}'],
      seriesField: null,
      title: '{{number}} over time',
      priority: 1,
      echartsHints: {
        pick: { date: { type: 'date', strategy: 'only' }, number: { type: 'number', strategy: 'only' } },
        preprocess: { timeSort: true, timeBin: 'autoIfVeryDense' },
        option: {
          animation: false,
          xAxis: { type: 'time' },
          tooltip: { trigger: 'axis' },
          dataZoom: [{ type: 'inside', throttle: 50 }],
          series: [
            {
              type: 'line',
              showSymbol: false,
              symbol: 'none',
              sampling: 'lttb',
              lineStyle: { width: 1 }
            }
          ]
        }
      }
    }
  },

  // 5) Exactly two unique values (binary-like)
  // ECharts consideration: A donut pie is readable for 2 categories; use avoidLabelOverlap + label formatter with {d}% to show share.
  {
    id: 'rule_105',
    description: 'Single column with cardinality === 2 → donut pie showing distribution (counts).',
    condition: (cols, meta) => {
      const totalCols = meta?.totalCols ?? cols.length;
      if (totalCols !== 1) return false;
      const c = cols[0];
      return (c.nullPct ?? 0) < 0.98 && (c.cardinality ?? 0) === 2;
    },
    suggestion: {
      chartType: 'pie',
      xField: '{{binary}}',
      yFields: [],
      seriesField: null,
      title: 'Distribution of {{binary}}',
      priority: 3,
      echartsHints: {
        pick: { binary: { strategy: 'only' } },
        preprocess: { groupBy: '{{binary}}', metrics: [{ op: 'count' }] },
        option: {
          tooltip: { trigger: 'item' },
          legend: { top: 'bottom' },
          series: [
            {
              type: 'pie',
              radius: ['45%', '70%'],
              avoidLabelOverlap: true,
              label: { formatter: '{b}: {d}% ({c})' }
            }
          ]
        }
      }
    }
  },

  // 6) Funnel / pipeline naming
  // ECharts consideration: Funnel series expects sorted values; set sort:'descending' and pre-aggregate counts/sums by stage for correct shape.
  {
    id: 'rule_106',
    description: "Column names suggest funnel stages (stage/step/phase/status) → funnel chart of counts or summed metric by stage.",
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const stageRe = /(stage|step|phase|pipeline|status)/;

      const stageCols = cols.filter(c =>
        c.type === 'text' &&
        (c.nullPct ?? 0) < 0.95 &&
        stageRe.test(lc(c.name)) &&
        (c.cardinality ?? 1e9) >= 3 &&
        (c.cardinality ?? 1e9) <= 20
      );
      if (!stageCols.length) return false;

      const rowCount = meta?.rowCount ?? 0;
      return rowCount >= (stageCols[0].cardinality ?? 3);
    },
    suggestion: {
      chartType: 'funnel',
      xField: '{{stage}}',
      yFields: ['{{value}}'],      // optional; if none, engine should use count(*)
      seriesField: null,
      title: 'Pipeline by {{stage}}',
      priority: 2,
      echartsHints: {
        pick: {
          stage: { type: 'text', nameMatches: ['stage', 'step', 'phase', 'status'], strategy: 'bestMatch' },
          value: { type: 'number', nameMatches: ['count', 'total', 'amount', 'value'], strategy: 'optionalBestMatch' }
        },
        preprocess: {
          groupBy: '{{stage}}',
          metrics: [{ field: '{{value}}', op: 'sum', fallbackOpIfMissing: 'count' }],
          sortBy: { metric: 'primary', order: 'desc' }
        },
        option: {
          tooltip: { trigger: 'item' },
          series: [
            {
              type: 'funnel',
              sort: 'descending',
              gap: 2,
              label: { position: 'right' }
            }
          ]
        }
      }
    }
  },

  // 7) Wide numeric range (log scale)
  // ECharts consideration: log axis cannot display <=0 values; you must filter, clamp to epsilon, or choose a different scale if zeros/negatives exist.
  {
    id: 'rule_107',
    description: 'Numeric field has max/min ratio > 1000 (and min > 0) → use log y-axis for readability.',
    condition: (cols, meta) => {
      const stats = meta?.fieldStats || meta?.stats || null;
      if (!stats) return false;

      const wideNums = cols.filter(c => {
        if (c.type !== 'number' || (c.nullPct ?? 0) >= 0.95) return false;
        const st = stats[c.name] || stats[(c.name ?? '').toLowerCase()];
        if (!st || st.min == null || st.max == null) return false;
        return st.min > 0 && (st.max / st.min) > 1000;
      });
      if (!wideNums.length) return false;

      const hasDimension = cols.some(c =>
        (c.type === 'date' && (c.nullPct ?? 0) < 0.95) ||
        (c.type === 'text' && (c.nullPct ?? 0) < 0.95 && (c.cardinality ?? 1e9) <= 50)
      );
      return hasDimension && (meta?.rowCount ?? 0) >= 2;
    },
    suggestion: {
      chartType: 'line',
      xField: '{{dimension}}',
      yFields: ['{{wideNumber}}'],
      seriesField: null,
      title: '{{wideNumber}} (log scale)',
      priority: 1,
      echartsHints: {
        pick: {
          wideNumber: { type: 'number', strategy: 'maxRangeRatio' },
          dimension: { type: ['date', 'text'], strategy: 'dateElseMinCardText' }
        },
        option: {
          tooltip: { trigger: 'axis' },
          yAxis: { type: 'log', logBase: 10, minorTick: { show: true }, minorSplitLine: { show: true } },
          series: [{ type: 'line', showSymbol: false }]
        },
        dynamic: {
          xAxisType: 'timeIfDateElseCategory',
          nonPositiveHandling: 'filterOrClampToEpsilon'
        }
      }
    }
  },

  // 8) Two date columns (start/end)
  // ECharts consideration: A Gantt/timeline usually needs a custom series (renderItem) to draw rectangles from start→end on a time axis; this can’t be expressed as plain JSON-only config.
  {
    id: 'rule_108',
    description: 'Two date columns that look like start/end → Gantt-style timeline using custom series.',
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const dates = cols.filter(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95);
      if (dates.length < 2) return false;

      // Prefer start/end naming; else just any 2 date cols.
      const startish = dates.some(c => /(start|begin|from|open)/.test(lc(c.name)));
      const endish = dates.some(c => /(end|finish|to|close|resolved|completed|stop)/.test(lc(c.name)));
      return (startish && endish) || dates.length === 2;
    },
    suggestion: {
      chartType: 'custom',
      xField: '{{startDate}}',
      yFields: ['{{endDate}}'],
      seriesField: '{{label}}', // task/row label (text/id) if present; else engine can use row index
      title: 'Timeline (start → end)',
      priority: 1,
      echartsHints: {
        pick: {
          startDate: { type: 'date', nameMatches: ['start', 'begin', 'from'], strategy: 'bestMatchElseFirstDate' },
          endDate: { type: 'date', nameMatches: ['end', 'finish', 'to', 'close'], strategy: 'bestMatchElseSecondDate' },
          label: { type: ['text', 'number'], nameMatches: ['task', 'name', 'id', 'title'], strategy: 'optionalBestMatchElseRowIndex' }
        },
        preprocess: { type: 'ganttRows', startField: '{{startDate}}', endField: '{{endDate}}', labelField: '{{label}}' },
        option: {
          tooltip: { trigger: 'item' },
          dataZoom: [{ type: 'inside', filterMode: 'weakFilter' }, { type: 'slider', filterMode: 'weakFilter' }],
          xAxis: { type: 'time' },
          yAxis: { type: 'category' },
          series: [
            {
              type: 'custom',
              // engine should inject a real renderItem(params, api) function here to draw bars spanning start→end
              renderItem: '__INJECT_RENDER_ITEM_GANTT__',
              encode: { x: [1, 2], y: 0 }, // (label, start, end) after preprocess
              clip: true
            }
          ]
        }
      }
    }
  },

  // 9) Hierarchy (category + subcategory)
  // ECharts consideration: Treemap needs hierarchical data (children arrays). Pre-aggregate values per (category, subcategory) before building nodes.
  {
    id: 'rule_109',
    description: "Names suggest hierarchy (category + subcategory) → treemap of aggregated values or counts.",
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const cat = cols.find(c => c.type === 'text' && /(category|cat)\b/.test(lc(c.name)) && (c.nullPct ?? 0) < 0.95);
      const sub = cols.find(c => c.type === 'text' && /(subcategory|sub_category|subcat|sub\-category)\b/.test(lc(c.name)) && (c.nullPct ?? 0) < 0.95);
      return !!cat && !!sub && (meta?.rowCount ?? 0) >= 1;
    },
    suggestion: {
      chartType: 'treemap',
      xField: '{{category}}',
      yFields: ['{{value}}'],      // optional; else count(*)
      seriesField: '{{subcategory}}',
      title: '{{value}} by category hierarchy',
      priority: 2,
      echartsHints: {
        pick: {
          category: { type: 'text', nameMatches: ['category', 'cat'], strategy: 'bestMatch' },
          subcategory: { type: 'text', nameMatches: ['subcategory', 'sub_category', 'subcat'], strategy: 'bestMatch' },
          value: { type: 'number', nameMatches: ['count', 'total', 'amount', 'value'], strategy: 'optionalBestMatch' }
        },
        preprocess: {
          type: 'treemapHierarchy',
          path: ['{{category}}', '{{subcategory}}'],
          metric: { field: '{{value}}', op: 'sum', fallbackOpIfMissing: 'count' }
        },
        option: {
          tooltip: { formatter: '{b}: {c}' },
          series: [
            {
              type: 'treemap',
              roam: false,
              nodeClick: 'link',
              breadcrumb: { show: true },
              leafDepth: 1,
              label: { show: true },
              upperLabel: { show: true }
            }
          ]
        }
      }
    }
  },

  // 10) High-cardinality single text column → word cloud
  // ECharts consideration: Word cloud is NOT in core ECharts; it requires the echarts-wordcloud extension and precomputed [{name,value}] token frequencies (stopwords, tokenization).
  {
    id: 'rule_110',
    description: 'Single text column with high uniqueness and text-like name (comments/notes/etc.) → word cloud of token frequency.',
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const rowCount = meta?.rowCount ?? 0;
      const totalCols = meta?.totalCols ?? cols.length;
      if (totalCols !== 1 || rowCount < 30) return false;

      const c = cols[0];
      if (c.type !== 'text' || (c.nullPct ?? 0) >= 0.95) return false;

      const highUniq = (c.cardinality ?? 0) > 0.5 * rowCount;
      const textyName = /(comment|message|description|summary|note|notes|text|reason|feedback)/.test(lc(c.name));
      return highUniq && textyName;
    },
    suggestion: {
      chartType: 'wordCloud',
      xField: '{{text}}',
      yFields: [],
      seriesField: null,
      title: 'Common terms in {{text}}',
      priority: 3,
      echartsHints: {
        pick: { text: { type: 'text', strategy: 'only' } },
        preprocess: {
          type: 'tokenizeAndCount',
          field: '{{text}}',
          minTokenLength: 3,
          removeStopwords: true,
          limit: 200
        },
        option: {
          tooltip: { show: true },
          series: [
            {
              type: 'wordCloud',
              shape: 'circle',
              gridSize: 8,
              sizeRange: [12, 48],
              rotationRange: [0, 0]
            }
          ]
        },
        fallbackSuggestionIfNoWordCloudExtension: {
          chartType: 'bar',
          title: 'Top terms in {{text}}',
          echartsHints: { option: { xAxis: { axisLabel: { rotate: 30 } } } }
        }
      }
    }
  },

  // 11) CGM glucose (+ timestamp, + optional insulin)
  // ECharts consideration: Use markArea/markLine for target ranges and dual y-axes for insulin vs glucose; align timestamps and keep connectNulls=false to avoid misleading lines.
  {
    id: 'rule_111',
    description: 'CGM-style dataset: glucose + timestamp (+ optional insulin) → glucose time-series with target band; insulin as secondary-axis bars.',
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const glucoseRe = /(glucose|cgm|bg|blood.?glucose)/;
      const insulinRe = /(insulin|bolus|basal|units|u\b)/;

      const ts = cols.find(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95 && /(time|date|ts|timestamp|reading)/.test(lc(c.name)));
      const glucose = cols.find(c => c.type === 'number' && (c.nullPct ?? 0) < 0.95 && glucoseRe.test(lc(c.name)));
      const insulin = cols.find(c => c.type === 'number' && (c.nullPct ?? 0) < 0.98 && insulinRe.test(lc(c.name)));

      return !!ts && !!glucose && (meta?.rowCount ?? 0) >= 5;
    },
    suggestion: {
      chartType: 'line',
      xField: '{{timestamp}}',
      yFields: ['{{glucose}}', '{{insulin}}'], // insulin optional
      seriesField: null,
      title: 'Glucose over time',
      priority: 1,
      echartsHints: {
        pick: {
          timestamp: { type: 'date', nameMatches: ['timestamp', 'time', 'date', 'reading'], strategy: 'bestMatch' },
          glucose: { type: 'number', nameMatches: ['glucose', 'cgm', 'bg'], strategy: 'bestMatch' },
          insulin: { type: 'number', nameMatches: ['insulin', 'bolus', 'basal', 'units'], strategy: 'optionalBestMatch' }
        },
        preprocess: { timeSort: true },
        option: {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'time' },
          yAxis: [
            { type: 'value', name: 'Glucose' },
            { type: 'value', name: 'Insulin', min: 0 }
          ],
          dataZoom: [{ type: 'inside' }, { type: 'slider' }],
          series: [
            {
              name: 'Glucose',
              type: 'line',
              showSymbol: false,
              connectNulls: false,
              markLine: {
                silent: true,
                data: [{ yAxis: 70 }, { yAxis: 180 }]
              },
              markArea: {
                silent: true,
                itemStyle: { opacity: 0.08 },
                data: [[{ yAxis: 70 }, { yAxis: 180 }]]
              }
            },
            // engine should add this only if insulin exists:
            { name: 'Insulin', type: 'bar', yAxisIndex: 1, barWidth: 6, opacity: 0.5 }
          ]
        },
        dynamic: {
          unitsInference: 'mgdlVsMmol', // engine may adjust yAxis.name and thresholds if mmol/L detected
          insulinSeriesEnabledIfFieldPresent: true
        }
      }
    }
  },

  // 12) Ticket ops (assignee, ticket id/count, status, rating)
  // ECharts consideration: For many assignees, rotate labels and add category dataZoom; for status stacking, use stack and legend scroll; dual-axis if overlaying avg rating.
  {
    id: 'rule_112',
    description: 'Ticketing dataset: assignee + ticket id/count (+ optional status, + optional rating) → tickets by assignee (stacked by status; optional rating line).',
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const assigneeRe = /(assignee|assigned.?to|technician|tech\b|analyst|owner|resolver)/;
      const ticketIdRe = /(ticket|incident|case|request|issue).*(id|number|no|#)?/;
      const statusRe = /\bstatus\b/;
      const ratingRe = /(rating|satisfaction|csat|stars|star)/;

      const assignee = cols.find(c => c.type === 'text' && (c.nullPct ?? 0) < 0.95 && assigneeRe.test(lc(c.name)));
      if (!assignee) return false;

      const ticketId = cols.find(c =>
        (c.type === 'text' || c.type === 'number') &&
        (c.nullPct ?? 0) < 0.98 &&
        ticketIdRe.test(lc(c.name)) &&
        (meta?.rowCount ?? 0) > 0 &&
        (c.cardinality ?? 0) >= 0.5 * (meta?.rowCount ?? 0) // id-like
      );

      const ticketCount = cols.find(c => c.type === 'number' && /(ticket_count|tickets|count)/.test(lc(c.name)));
      const status = cols.find(c => c.type === 'text' && (c.nullPct ?? 0) < 0.98 && statusRe.test(lc(c.name)) && (c.cardinality ?? 1e9) <= 20);
      const rating = cols.find(c => c.type === 'number' && (c.nullPct ?? 0) < 0.98 && ratingRe.test(lc(c.name)));

      return !!(ticketId || ticketCount) && (meta?.rowCount ?? 0) >= 5 && !!(status || rating || true);
    },
    suggestion: {
      chartType: 'bar',
      xField: '{{assignee}}',
      yFields: ['{{ticketsMetric}}'],     // countDistinct(ticketId) or sum(ticketCount)
      seriesField: '{{status}}',          // optional
      title: 'Tickets by assignee',
      priority: 1,
      echartsHints: {
        pick: {
          assignee: { type: 'text', nameMatches: ['assignee', 'technician', 'analyst', 'assigned_to', 'owner'], strategy: 'bestMatch' },
          status: { type: 'text', nameMatches: ['status'], strategy: 'optionalBestMatch' },
          ticketId: { type: ['text', 'number'], nameMatches: ['ticket', 'incident', 'case', 'issue'], strategy: 'optionalIdLike' },
          ticketCount: { type: 'number', nameMatches: ['ticket_count', 'tickets', 'count'], strategy: 'optionalBestMatch' },
          rating: { type: 'number', nameMatches: ['rating', 'satisfaction', 'csat', 'stars'], strategy: 'optionalBestMatch' }
        },
        preprocess: {
          type: 'aggregateTickets',
          groupBy: ['{{assignee}}', '{{status}}'], // status omitted if missing
          metric: {
            op: 'countDistinctIfIdElseSum',
            idField: '{{ticketId}}',
            sumField: '{{ticketCount}}',
            as: 'tickets'
          },
          additionalMetrics: [{ field: '{{rating}}', op: 'avg', as: 'avg_rating', optional: true }],
          sortBy: { field: 'tickets', order: 'desc' },
          limit: 25,
          otherBucketLabel: 'Other'
        },
        option: {
          tooltip: { trigger: 'axis' },
          legend: { type: 'scroll' },
          xAxis: { type: 'category', axisLabel: { rotate: 30 } },
          yAxis: [{ type: 'value', name: 'Tickets' }, { type: 'value', name: 'Avg rating', min: 0, max: 5 }],
          dataZoom: [{ type: 'inside', xAxisIndex: 0 }],
          series: [
            { type: 'bar', stack: 'tickets' }
            // engine may append: {type:'line', yAxisIndex:1, encode:{y:'avg_rating'}, smooth:true}
          ]
        }
      }
    }
  },

  // 13) Sleep stage hypnogram (+ optional HRV RMSSD)
  // ECharts consideration: Use yAxis.type='category' plus series.step to represent discrete states; for HRV, use a second grid/panel (multi-grid) rather than mixing category + numeric on one y-axis.
  {
    id: 'rule_113',
    description: 'Sleep stages over time (awake/light/deep/REM) → hypnogram (step line on categorical y-axis); optional HRV RMSSD as second panel.',
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const stageRe = /(sleep.*stage|stage)/;
      const stage = cols.find(c =>
        c.type === 'text' &&
        (c.nullPct ?? 0) < 0.95 &&
        stageRe.test(lc(c.name)) &&
        (c.cardinality ?? 1e9) >= 2 &&
        (c.cardinality ?? 1e9) <= 8
      );
      const ts = cols.find(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95 && /(time|date|timestamp|ts|start)/.test(lc(c.name)));
      return !!stage && !!ts && (meta?.rowCount ?? 0) >= 10;
    },
    suggestion: {
      chartType: 'line',
      xField: '{{timestamp}}',
      yFields: ['{{sleepStage}}'], // text field used on categorical y-axis
      seriesField: null,
      title: 'Sleep stages over time',
      priority: 2,
      echartsHints: {
        pick: {
          timestamp: { type: 'date', nameMatches: ['timestamp', 'time', 'date', 'ts'], strategy: 'bestMatch' },
          sleepStage: { type: 'text', nameMatches: ['stage'], strategy: 'bestMatch' },
          hrv: { type: 'number', nameMatches: ['hrv', 'rmssd'], strategy: 'optionalBestMatch' }
        },
        preprocess: {
          type: 'normalizeSleepStages',
          field: '{{sleepStage}}',
          stageOrder: ['Awake', 'REM', 'Light', 'Deep'] // engine can adjust order if values differ
        },
        option: {
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'time' },
          yAxis: { type: 'category' },
          dataZoom: [{ type: 'inside' }],
          series: [
            {
              type: 'line',
              step: 'end',
              symbol: 'none',
              lineStyle: { width: 2 },
              connectNulls: false
            }
          ]
        },
        dynamic: {
          // If HRV exists, engine may create a second grid + second xAxis (shared time) and add HRV line there.
          enableSecondPanelIfHRVPresent: true
        }
      }
    }
  },

  // 14) Study/participant metrics (compliance, wear time, status)
  // ECharts consideration: Boxplot needs precomputed [min,Q1,median,Q3,max] per study (and optional outliers scatter); ECharts won’t compute quartiles unless you add a helper/transform in your engine.
  {
    id: 'rule_114',
    description: 'Study + participant + percent metrics (compliance/wear/adherence) → boxplot distribution by study (optionally with outliers).',
    condition: (cols, meta) => {
      const lc = s => (s ?? '').toString().toLowerCase();
      const rowCount = meta?.rowCount ?? 0;

      const study = cols.find(c => c.type === 'text' && (c.nullPct ?? 0) < 0.95 && /(study|study_id|studyname)/.test(lc(c.name)));
      const participant = cols.find(c => c.type === 'text' && (c.nullPct ?? 0) < 0.95 && /(participant|subject|subj|pid)/.test(lc(c.name)));
      const pctMetric = cols.find(c =>
        c.type === 'number' &&
        (c.nullPct ?? 0) < 0.95 &&
        /(compliance|wear|wear_time|adherence|pct|percent|rate)/.test(lc(c.name))
      );

      const studyCardOk = study && (study.cardinality ?? 1e9) >= 2 && (study.cardinality ?? 1e9) <= 30;
      return !!(studyCardOk && participant && pctMetric && rowCount >= 40);
    },
    suggestion: {
      chartType: 'boxplot',
      xField: '{{study}}',
      yFields: ['{{percentMetric}}'],
      seriesField: null,
      title: '{{percentMetric}} distribution by study',
      priority: 2,
      echartsHints: {
        pick: {
          study: { type: 'text', nameMatches: ['study', 'study_id', 'studyname'], strategy: 'bestMatch' },
          participant: { type: 'text', nameMatches: ['participant', 'subject', 'pid'], strategy: 'bestMatch' },
          percentMetric: { type: 'number', nameMatches: ['compliance', 'wear', 'adherence', 'pct', 'percent', 'rate'], strategy: 'bestMatch' },
          enrollmentStatus: { type: 'text', nameMatches: ['enrollment', 'status'], strategy: 'optionalBestMatch' }
        },
        preprocess: {
          type: 'boxplotByGroup',
          groupBy: '{{study}}',
          valueField: '{{percentMetric}}',
          // engine should compute: [min, q1, median, q3, max] per study and separate outliers
          outliers: true,
          sortGroupsBy: 'medianDesc'
        },
        option: {
          tooltip: { trigger: 'item' },
          xAxis: { type: 'category', axisLabel: { rotate: 20 } },
          yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
          dataZoom: [{ type: 'inside', xAxisIndex: 0 }],
          series: [
            { type: 'boxplot' }
            // engine may append outliers: {type:'scatter', name:'Outliers', symbolSize:4}
          ]
        }
      }
    }
  }
];


/* ChatGPT 5.2 Reasoning (via UMGPT) */
const advanced_chart_rules_chatgpt_2 = [
  {
    id: 'rule_101_lat_lon_scatter',
    description: 'Detect latitude/longitude columns and suggest a coordinate scatter plot (optionally upgraded to geo-map if available).',
    condition: (cols, meta) => {
      const numCols = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.8);

      const latCol = numCols.find(c => {
        const n = (c.name || '').toLowerCase();
        return n.includes('latitude') || /(^|[^a-z0-9])lat([^a-z0-9]|$)/.test(n);
      });

      const lonCol = numCols.find(c => {
        const n = (c.name || '').toLowerCase();
        return (
          n.includes('longitude') ||
          /(^|[^a-z0-9])lon([^a-z0-9]|$)/.test(n) ||
          /(^|[^a-z0-9])lng([^a-z0-9]|$)/.test(n)
        );
      });

      return meta.rowCount > 1 && !!(latCol && lonCol);
    },
    suggestion: {
      chartType: 'scatter',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Locations (Latitude/Longitude)',
      priority: 1,
      echartsHints: {
        xAxis: { type: 'value', name: 'Longitude', scale: true },
        yAxis: { type: 'value', name: 'Latitude', scale: true },
        tooltip: { trigger: 'item' },
        series: [{ type: 'scatter', symbolSize: 6, emphasis: { focus: 'series' } }],
        __fieldRoles: {
          x: ['lon', 'lng', 'longitude'],
          y: ['lat', 'latitude']
        },
        __note: 'If you have a geo basemap, consider coordinateSystem:"geo" + geo component; otherwise keep cartesian scatter.'
      }
    }
  },

  {
    id: 'rule_102_percent_like_metric',
    description: 'Detect a percentage/rate/ratio metric and format axes/labels as percent.',
    condition: (cols, meta) => {
      const numCols = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.95);

      const nameHit = numCols.some(c => {
        const n = (c.name || '').toLowerCase();
        return (
          n.includes('pct') ||
          n.includes('percent') ||
          n.includes('percentage') ||
          n.includes('rate') ||
          n.includes('ratio')
        );
      });

      const rangeHit = numCols.some(c => {
        const st = meta?.colStats?.[c.name] || meta?.colExtents?.[c.name];
        const min = st?.min ?? st?.minValue;
        const max = st?.max ?? st?.maxValue;
        return typeof min === 'number' && typeof max === 'number' && min >= 0 && max <= 100;
      });

      return nameHit || rangeHit;
    },
    suggestion: {
      chartType: 'bar',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Rate / Percent by Category',
      priority: 2,
      echartsHints: {
        tooltip: { trigger: 'axis' },
        yAxis: { axisLabel: { formatter: '{value}%' } },
        series: [{ type: 'bar', label: { show: true, formatter: '{c}%' } }],
        __measureRole: 'percent',
        __note: 'If values are in 0–1, scale to 0–100 before applying % formatting.'
      }
    }
  },

  {
    id: 'rule_103_single_row_kpi_gauge',
    description: 'Single-row result with numeric KPI(s): suggest gauge-style KPI display.',
    condition: (cols, meta) => {
      const numCols = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 1);
      return meta.rowCount === 1 && numCols.length >= 1;
    },
    suggestion: {
      chartType: 'gauge',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'KPI',
      priority: 1,
      echartsHints: {
        tooltip: { show: false },
        series: [
          {
            type: 'gauge',
            startAngle: 200,
            endAngle: -20,
            radius: '85%',
            axisLine: { lineStyle: { width: 10 } },
            splitLine: { length: 10 },
            axisTick: { length: 6 },
            axisLabel: { distance: 14 },
            detail: { valueAnimation: true, formatter: '{value}' }
          }
        ],
        __kpiMode: true,
        __note: 'If multiple numeric columns exist, consider small-multiple gauges (one per metric).'
      }
    }
  },

  {
    id: 'rule_104_large_timeseries_perf',
    description: 'Many rows with one date + one number: suggest a performant time-series line (sampling, no symbols, zoom).',
    condition: (cols, meta) => {
      const dateCols = cols.filter(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95);
      const numCols = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.95);
      return meta.rowCount > 500 && dateCols.length === 1 && numCols.length === 1;
    },
    suggestion: {
      chartType: 'line',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Trend over Time',
      priority: 1,
      echartsHints: {
        animation: false,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'time' },
        yAxis: { type: 'value', scale: true },
        dataZoom: [{ type: 'inside', throttle: 50 }, { type: 'slider' }],
        series: [
          {
            type: 'line',
            showSymbol: false,
            sampling: 'lttb',
            lineStyle: { width: 1 },
            emphasis: { focus: 'series' }
          }
        ],
        __perf: { showSymbol: false, sampling: 'lttb', animation: false }
      }
    }
  },

  {
    id: 'rule_105_binary_dimension_distribution',
    description: 'A column with exactly 2 unique values: suggest a distribution chart (pie of counts).',
    condition: (cols, meta) => {
      const binCol = cols.find(c => c.cardinality === 2 && (c.nullPct ?? 0) < 0.5);
      return meta.rowCount > 2 && !!binCol;
    },
    suggestion: {
      chartType: 'pie',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Binary Split (Count of Rows)',
      priority: 2,
      echartsHints: {
        tooltip: { trigger: 'item' },
        legend: { type: 'scroll' },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: true,
            label: { formatter: '{b}\n{d}%' }
          }
        ],
        __aggregate: { value: 'count' },
        __note: 'If a numeric measure exists, consider bar chart of avg/sum by the binary flag.'
      }
    }
  },

  {
    id: 'rule_106_funnel_pipeline_stage',
    description: 'Columns suggesting funnel/pipeline stages (stage/step/phase/status): suggest a funnel chart (count or sum by stage).',
    condition: (cols, meta) => {
      const stageCol = cols.find(c => {
        const n = (c.name || '').toLowerCase();
        const isTextish = c.type === 'text' || c.type === 'default';
        return (
          isTextish &&
          /stage|step|phase|status|pipeline|funnel/.test(n) &&
          c.cardinality >= 3 &&
          c.cardinality <= 20 &&
          (c.nullPct ?? 0) < 0.6
        );
      });
      return meta.rowCount > 1 && !!stageCol;
    },
    suggestion: {
      chartType: 'funnel',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Pipeline / Funnel by Stage',
      priority: 1,
      echartsHints: {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'funnel',
            sort: 'descending',
            gap: 2,
            label: { show: true, position: 'inside' },
            labelLine: { show: false }
          }
        ],
        __aggregate: { value: 'count', fallback: 'sumFirstNumeric' },
        __fieldRoles: { stage: ['stage', 'step', 'phase', 'status', 'pipeline'] }
      }
    }
  },

  {
    id: 'rule_107_log_scale_wide_range',
    description: 'Numeric metric spans a very wide positive range (max/min > 1000): suggest log-scale Y axis.',
    condition: (cols, meta) => {
      const numCols = cols.filter(c => c.type === 'number' && (c.nullPct ?? 0) < 0.95);

      return numCols.some(c => {
        const st = meta?.colStats?.[c.name] || meta?.colExtents?.[c.name];
        const min = st?.min ?? st?.minValue;
        const max = st?.max ?? st?.maxValue;
        return typeof min === 'number' && typeof max === 'number' && min > 0 && max / min > 1000;
      });
    },
    suggestion: {
      chartType: 'line',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Trend (Log Scale)',
      priority: 2,
      echartsHints: {
        tooltip: { trigger: 'axis' },
        yAxis: { type: 'log', minorSplitLine: { show: true } },
        series: [{ type: 'line', showSymbol: false }],
        __requiresPositiveValues: true,
        __note: 'Use log axis only when values are strictly > 0; otherwise fall back to linear + outlier handling.'
      }
    }
  },

  {
    id: 'rule_108_start_end_dates_gantt_like',
    description: 'Two date columns that look like start/end: suggest a timeline/Gantt-like visualization.',
    condition: (cols, meta) => {
      const dateCols = cols.filter(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95);
      if (meta.rowCount <= 1 || dateCols.length < 2) return false;

      const startCol = dateCols.find(c => /start|begin|from/.test((c.name || '').toLowerCase()));
      const endCol = dateCols.find(c => /end|finish|to/.test((c.name || '').toLowerCase()));

      return !!(startCol && endCol && startCol.name !== endCol.name);
    },
    suggestion: {
      chartType: 'bar',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Duration Timeline (Start → End)',
      priority: 2,
      echartsHints: {
        xAxis: { type: 'time' },
        yAxis: { type: 'category' },
        tooltip: { trigger: 'item' },
        series: [{ type: 'bar', barWidth: 12 }],
        __ganttLike: true,
        __fieldRoles: {
          start: ['start', 'begin', 'from'],
          end: ['end', 'finish', 'to'],
          task: ['task', 'name', 'title', 'id']
        },
        __note:
          'True Gantt is typically best as a custom series; alternatively compute duration=end-start and use stacked bars (offset + duration).'
      }
    }
  },

  {
    id: 'rule_109_category_subcategory_hierarchy',
    description: 'Category + subcategory columns suggest a hierarchy: use treemap (count or sum).',
    condition: (cols, meta) => {
      const textCols = cols.filter(
        c => (c.type === 'text' || c.type === 'default') && (c.nullPct ?? 0) < 0.8
      );

      const catCol = textCols.find(c => {
        const n = (c.name || '').toLowerCase();
        return /(^|[^a-z0-9])category([^a-z0-9]|$)|(^|[^a-z0-9])cat([^a-z0-9]|$)/.test(n);
      });

      const subCol = textCols.find(c => {
        const n = (c.name || '').toLowerCase();
        return /subcat|sub_category|subcategory|subtype|sub_type/.test(n);
      });

      return meta.rowCount > 1 && !!(catCol && subCol && catCol.name !== subCol.name);
    },
    suggestion: {
      chartType: 'treemap',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Hierarchy Breakdown (Category → Subcategory)',
      priority: 2,
      echartsHints: {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'treemap',
            roam: true,
            leafDepth: 2,
            breadcrumb: { show: true }
          }
        ],
        __hierarchyPath: ['category', 'subcategory'],
        __aggregate: { value: 'count', fallback: 'sumFirstNumeric' }
      }
    }
  },

  {
    id: 'rule_110_wordcloud_high_card_text',
    description: 'Single high-cardinality text column (not ID-like): suggest word cloud (requires echarts-wordcloud) or a Top-N frequency fallback.',
    condition: (cols, meta) => {
      const textCols = cols.filter(c => c.type === 'text' || c.type === 'default');
      const numCols = cols.filter(c => c.type === 'number');
      const dateCols = cols.filter(c => c.type === 'date');

      if (textCols.length !== 1 || numCols.length > 0 || dateCols.length > 0) return false;

      const t = textCols[0];
      const n = (t.name || '').toLowerCase();
      const idLike = /(^|[^a-z0-9])(id|uuid|guid|hash)([^a-z0-9]|$)/.test(n);

      return (
        !idLike &&
        meta.rowCount >= 20 &&
        typeof t.cardinality === 'number' &&
        t.cardinality >= Math.ceil(meta.rowCount * 0.5)
      );
    },
    suggestion: {
      chartType: 'wordCloud',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Top Terms (Word Cloud)',
      priority: 3,
      echartsHints: {
        series: [
          {
            type: 'wordCloud',
            shape: 'circle',
            gridSize: 8,
            sizeRange: [12, 60],
            rotationRange: [-45, 90],
            drawOutOfBound: false
          }
        ],
        __requires: 'echarts-wordcloud',
        __aggregate: { value: 'count', topN: 150 },
        __note: 'If the extension is unavailable, fall back to a bar chart of Top-N term frequencies.'
      }
    }
  },

  {
    id: 'rule_111_cgm_glucose_timeseries',
    description: 'CGM dataset (timestamp + glucose; optional insulin): suggest glucose-over-time line with clinical bands/thresholds and zoom.',
    condition: (cols, meta) => {
      const timeCol = cols.find(c => {
        const n = (c.name || '').toLowerCase();
        return c.type === 'date' && /time|date|timestamp|ts|reading|sample|logged/.test(n);
      });

      const glucoseCol = cols.find(c => {
        const n = (c.name || '').toLowerCase();
        return (
          c.type === 'number' &&
          (/(glucose|cgm)/.test(n) ||
            /(^|[^a-z0-9])bg([^a-z0-9]|$)/.test(n) ||
            /mg\/?dl|mgdl|mmol/.test(n))
        );
      });

      return meta.rowCount > 10 && !!(timeCol && glucoseCol);
    },
    suggestion: {
      chartType: 'line',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'CGM Glucose Over Time',
      priority: 1,
      echartsHints: {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'time' },
        yAxis: { type: 'value', name: 'Glucose', scale: true },
        dataZoom: [{ type: 'inside', throttle: 50 }, { type: 'slider' }],
        series: [
          {
            type: 'line',
            showSymbol: false,
            connectNulls: true,
            markLine: {
              silent: true,
              data: [
                { yAxis: 70, name: 'Low (mg/dL)' },
                { yAxis: 180, name: 'High (mg/dL)' }
              ]
            },
            markArea: {
              silent: true,
              itemStyle: { opacity: 0.08 },
              data: [
                [{ yAxis: 70 }, { yAxis: 180 }] // typical “in range” band for mg/dL
              ]
            }
          }
        ],
        __fieldRoles: {
          time: ['time', 'timestamp', 'date', 'reading', 'sample', 'logged'],
          glucose: ['glucose', 'cgm', 'bg', 'mg/dl', 'mgdl', 'mmol'],
          insulin: ['insulin', 'bolus', 'basal', 'units', 'u']
        },
        __note:
          'If insulin is present, add a secondary bar series on yAxisIndex:1 (right axis). Adjust thresholds for mmol/L if needed.'
      }
    }
  },

  {
    id: 'rule_112_tickets_by_assignee',
    description: 'Ticketing data (assignee/technician + ticket id/count; optional status + rating): suggest tickets-by-assignee bar (stack by status when available).',
    condition: (cols, meta) => {
      const textCols = cols.filter(c => c.type === 'text' || c.type === 'default');
      const numCols = cols.filter(c => c.type === 'number');

      const assigneeCol = textCols.find(c => /assignee|technician|analyst|agent|owner|resolver|assigned[_ -]?to/.test((c.name || '').toLowerCase()));
      if (!assigneeCol) return false;

      const ticketIdCol = cols.find(c => {
        const n = (c.name || '').toLowerCase();
        const looksLikeTicket = /ticket|incident|case|issue|request/.test(n);
        const highCard = typeof c.cardinality === 'number' && c.cardinality >= Math.ceil(meta.rowCount * 0.7);
        return looksLikeTicket && highCard;
      });

      const ticketCountCol = numCols.find(c => {
        const n = (c.name || '').toLowerCase();
        return /ticket|incident|case/.test(n) && /count|num|qty|total/.test(n);
      });

      return meta.rowCount >= 5 && !!(ticketIdCol || ticketCountCol);
    },
    suggestion: {
      chartType: 'bar',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Tickets by Assignee',
      priority: 1,
      echartsHints: {
        tooltip: { trigger: 'axis' },
        legend: { type: 'scroll' },
        xAxis: { type: 'category', axisLabel: { rotate: 35 } },
        yAxis: { type: 'value', name: 'Tickets' },
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
        series: [{ type: 'bar' }],
        __fieldRoles: {
          assignee: ['assignee', 'technician', 'analyst', 'agent', 'owner', 'resolver', 'assigned_to'],
          ticketId: ['ticket', 'incident', 'case', 'issue', 'request'],
          status: ['status', 'state', 'stage'],
          rating: ['rating', 'satisfaction', 'csat', 'stars']
        },
        __aggregate: {
          value: 'countTicketIdIfPresentElseSumCount',
          groupBy: 'assignee',
          stackByIfPresent: 'status',
          topN: 20
        }
      }
    }
  },

  {
    id: 'rule_113_sleep_stage_hypnogram',
    description: 'Sleep stages over time (timestamp + stage categories): suggest a step-line hypnogram (categorical Y).',
    condition: (cols, meta) => {
      const timeCol = cols.find(c => c.type === 'date' && (c.nullPct ?? 0) < 0.95);
      if (!timeCol) return false;

      const stageCol = cols.find(c => {
        const n = (c.name || '').toLowerCase();
        const textish = c.type === 'text' || c.type === 'default';
        const stageyName = /sleep.*stage|stage/.test(n);
        const okCard = typeof c.cardinality === 'number' && c.cardinality >= 3 && c.cardinality <= 8;
        return textish && stageyName && okCard && (c.nullPct ?? 0) < 0.5;
      });

      return meta.rowCount > 10 && !!stageCol;
    },
    suggestion: {
      chartType: 'line',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Sleep Stages Over Time',
      priority: 1,
      echartsHints: {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'time' },
        yAxis: { type: 'category', name: 'Stage', inverse: true },
        dataZoom: [{ type: 'inside', throttle: 50 }, { type: 'slider' }],
        series: [
          {
            type: 'line',
            step: 'middle',
            showSymbol: false,
            connectNulls: true
          }
        ],
        __fieldRoles: {
          time: ['time', 'timestamp', 'date', 'sleep_log', 'log_id'],
          stage: ['sleep_stage', 'stage', 'state'],
          hrv: ['rmssd', 'hrv']
        },
        __note:
          'If RMSSD/HRV exists, consider a second panel/axis for a numeric trend; keep the stage hypnogram categorical.'
      }
    }
  },

  {
    id: 'rule_114_study_participant_compliance_scatter',
    description: 'Study/participant dataset with compliance & wear-time metrics: suggest participant-level scatter (colored by study/status).',
    condition: (cols, meta) => {
      const textCols = cols.filter(c => c.type === 'text' || c.type === 'default');
      const numCols = cols.filter(c => c.type === 'number');

      const studyCol = textCols.find(c => /study/.test((c.name || '').toLowerCase()) && (c.nullPct ?? 0) < 0.8);
      const participantCol = textCols.find(c => {
        const n = (c.name || '').toLowerCase();
        const pidName = /participant|subject|user|pid/.test(n);
        const highCard = typeof c.cardinality === 'number' && c.cardinality >= Math.ceil(meta.rowCount * 0.5);
        return pidName && highCard && (c.nullPct ?? 0) < 0.8;
      });

      const metricCols = numCols.filter(c => {
        const n = (c.name || '').toLowerCase();
        return /compliance|adherence|wear/.test(n) || n.includes('pct') || n.includes('percent') || n.includes('rate');
      });

      return meta.rowCount >= 10 && !!studyCol && !!participantCol && metricCols.length >= 2;
    },
    suggestion: {
      chartType: 'scatter',
      xField: null,
      yFields: [],
      seriesField: null,
      title: 'Participant Metrics (Compliance vs Wear Time)',
      priority: 1,
      echartsHints: {
        tooltip: { trigger: 'item' },
        legend: { type: 'scroll' },
        xAxis: { type: 'value', name: 'Metric X', axisLabel: { formatter: '{value}%' } },
        yAxis: { type: 'value', name: 'Metric Y', axisLabel: { formatter: '{value}%' } },
        series: [{ type: 'scatter', symbolSize: 6, large: true, largeThreshold: 2000 }],
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
        __fieldRoles: {
          study: ['study', 'study_id', 'study_name'],
          participant: ['participant', 'subject', 'pid', 'user'],
          x: ['compliance', 'adherence', 'compliance_pct', 'wear_pct', 'wear_time_pct'],
          y: ['wear', 'wear_time', 'wear_time_pct', 'device_wear_time', 'compliance'],
          status: ['enrollment_status', 'status', 'state']
        },
        __note:
          'If you have total wear time (hours/minutes) plus percent metrics, consider using size encoding or a secondary axis in a separate chart.'
      }
    }
  }
];



/* Llama 4 Maverick 17B (via UMGPT) */
const advanced_charts = [
  {
    id: 'rule_lat_lon',
    description: 'Columns indicating geographic coordinates',
    condition: (cols, meta) => {
      const latCol = cols.find(col => col.name.toLowerCase().includes('lat') || col.name.toLowerCase().includes('latitude'));
      const lonCol = cols.find(col => col.name.toLowerCase().includes('lon') || col.name.toLowerCase().includes('longitude'));
      return latCol && lonCol;
    },
    suggestion: {
      chartType: 'scatter',
      xField: cols.find(col => col.name.toLowerCase().includes('lon') || col.name.toLowerCase().includes('longitude')).name,
      yFields: [cols.find(col => col.name.toLowerCase().includes('lat') || col.name.toLowerCase().includes('latitude')).name],
      seriesField: null,
      title: 'Geographic Distribution',
      priority: 1,
      echartsHints: {
        coordinateSystem: 'geo',
        geoIndex: 0,
      }
    }
  },
  {
    id: 'rule_percentage',
    description: 'Column likely representing a percentage',
    condition: (cols, meta) => {
      const pctCol = cols.find(col => (col.name.toLowerCase().includes('pct') || col.name.toLowerCase().includes('percent') || col.name.toLowerCase().includes('rate') || col.name.toLowerCase().includes('ratio')) && col.type === 'number');
      if (pctCol) {
        const data = alasql(`SELECT ${pctCol.name} FROM [dlv_results]`);
        const values = data.map(row => row[pctCol.name]);
        return values.every(val => val >= 0 && val <= 100);
      }
      return false;
    },
    suggestion: {
      chartType: 'gauge',
      xField: null,
      yFields: [cols.find(col => (col.name.toLowerCase().includes('pct') || col.name.toLowerCase().includes('percent') || col.name.toLowerCase().includes('rate') || col.name.toLowerCase().includes('ratio')) && col.type === 'number').name],
      seriesField: null,
      title: 'Percentage Gauge',
      priority: 2,
      echartsHints: {
        min: 0,
        max: 100,
      }
    }
  },
  {
    id: 'rule_kpi',
    description: 'Single numeric value, likely a KPI',
    condition: (cols, meta) => meta.rowCount === 1 && cols.some(col => col.type === 'number'),
    suggestion: {
      chartType: 'gauge',
      xField: null,
      yFields: [cols.find(col => col.type === 'number').name],
      seriesField: null,
      title: 'KPI',
      priority: 1,
      echartsHints: {
        detail: {
          formatter: '{value}'
        }
      }
    }
  },
  {
    id: 'rule_large_date_number',
    description: 'Large dataset with date and number columns',
    condition: (cols, meta) => meta.rowCount > 500 && cols.some(col => col.type === 'date') && cols.some(col => col.type === 'number'),
    suggestion: {
      chartType: 'line',
      xField: cols.find(col => col.type === 'date').name,
      yFields: [cols.find(col => col.type === 'number').name],
      seriesField: null,
      title: 'Time Series',
      priority: 2,
      echartsHints: {
        sampling: 'average',
        symbol: 'none',
      }
    }
  },
  {
    id: 'rule_binary',
    description: 'Column with binary values',
    condition: (cols, meta) => cols.some(col => col.cardinality === 2),
    suggestion: {
      chartType: 'pie',
      xField: null,
      yFields: [cols.find(col => col.cardinality === 2).name],
      seriesField: null,
      title: 'Binary Distribution',
      priority: 2,
      echartsHints: {
        roseType: 'area',
      }
    }
  },
  {
    id: 'rule_funnel',
    description: 'Columns suggesting a funnel or pipeline',
    condition: (cols, meta) => cols.some(col => ['stage', 'step', 'phase', 'status'].some(keyword => col.name.toLowerCase().includes(keyword))),
    suggestion: {
      chartType: 'funnel',
      xField: cols.find(col => ['stage', 'step', 'phase', 'status'].some(keyword => col.name.toLowerCase().includes(keyword))).name,
      yFields: [],
      seriesField: null,
      title: 'Funnel Chart',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_log_scale',
    description: 'Numeric column with a wide range',
    condition: (cols, meta) => {
      const numCol = cols.find(col => col.type === 'number');
      if (numCol) {
        const data = alasql(`SELECT ${numCol.name} FROM [dlv_results]`);
        const values = data.map(row => row[numCol.name]).filter(val => val !== null);
        const max = Math.max(...values);
        const min = Math.min(...values);
        return max / min > 1000;
      }
      return false;
    },
    suggestion: {
      chartType: 'line',
      xField: null, 
      yFields: [cols.find(col => col.type === 'number').name],
      seriesField: null,
      title: 'Log Scale Chart',
      priority: 2,
      echartsHints: {
        yAxis: {
          type: 'log'
        }
      }
    }
  },
  {
    id: 'rule_two_dates',
    description: 'Two date columns, potentially for a timeline or Gantt chart',
    condition: (cols, meta) => cols.filter(col => col.type === 'date').length === 2,
    suggestion: {
      chartType: 'bar', 
      xField: cols.find(col => col.type === 'date' && col.name.toLowerCase().includes('start')).name,
      yFields: [cols.find(col => col.type === 'date' && col.name.toLowerCase().includes('end')).name],
      seriesField: null,
      title: 'Timeline or Gantt Chart',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_hierarchy',
    description: 'Columns indicating a hierarchical structure',
    condition: (cols, meta) => {
      const categoryCol = cols.find(col => col.name.toLowerCase().includes('category'));
      const subcategoryCol = cols.find(col => col.name.toLowerCase().includes('subcategory'));
      return categoryCol && subcategoryCol;
    },
    suggestion: {
      chartType: 'treemap',
      xField: null,
      yFields: [],
      seriesField: cols.find(col => col.name.toLowerCase().includes('category')).name,
      title: 'Hierarchical Treemap',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_word_cloud',
    description: 'Single text column with high cardinality',
    condition: (cols, meta) => {
      const textCol = cols.find(col => col.type === 'text');
      return textCol && textCol.cardinality / meta.rowCount > 0.5;
    },
    suggestion: {
      chartType: 'wordCloud',
      xField: null,
      yFields: [],
      seriesField: cols.find(col => col.type === 'text').name,
      title: 'Word Cloud',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_cgm_data',
    description: 'CGM data with glucose values and timestamp',
    condition: (cols, meta) => {
      const glucoseCol = cols.find(col => (col.name.toLowerCase().includes('glucose') || col.name.toLowerCase().includes('cgm')) && col.type === 'number');
      const dateCol = cols.find(col => col.type === 'date');
      return glucoseCol && dateCol;
    },
    suggestion: {
      chartType: 'line',
      xField: cols.find(col => col.type === 'date').name,
      yFields: [cols.find(col => (col.name.toLowerCase().includes('glucose') || col.name.toLowerCase().includes('cgm')) && col.type === 'number').name],
      seriesField: null,
      title: 'CGM Glucose Levels Over Time',
      priority: 1,
      echartsHints: {
        markLine: {
          data: [
            { yAxis: 70 }, 
            { yAxis: 180 } 
          ]
        }
      }
    }
  },
  {
    id: 'rule_ticket_data',
    description: 'Ticket data with assignee and ticket information',
    condition: (cols, meta) => {
      const assigneeCol = cols.find(col => (col.name.toLowerCase().includes('assignee') || col.name.toLowerCase().includes('technician') || col.name.toLowerCase().includes('analyst')) && col.type === 'text');
      const ticketCol = cols.find(col => col.name.toLowerCase().includes('ticket') && (col.type === 'number' || col.type === 'text'));
      return assigneeCol && ticketCol;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols.find(col => (col.name.toLowerCase().includes('assignee') || col.name.toLowerCase().includes('technician') || col.name.toLowerCase().includes('analyst')) && col.type === 'text').name,
      yFields: [cols.find(col => col.name.toLowerCase().includes('ticket') && (col.type === 'number' || col.type === 'text')).name],
      seriesField: null,
      title: 'Tickets by Assignee',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_sleep_data',
    description: 'Sleep data with timestamp and sleep stage',
    condition: (cols, meta) => {
      const dateCol = cols.find(col => col.type === 'date');
      const sleepStageCol = cols.find(col => col.name.toLowerCase().includes('sleep') && col.type === 'text');
      return dateCol && sleepStageCol;
    },
    suggestion: {
      chartType: 'custom', 
      xField: cols.find(col => col.type === 'date').name,
      yFields: [cols.find(col => col.name.toLowerCase().includes('sleep') && col.type === 'text').name],
      seriesField: null,
      title: 'Sleep Stage Hypnogram',
      priority: 2,
      echartsHints: {}
    }
  },
  {
    id: 'rule_study_data',
    description: 'Study data with participant and compliance metrics',
    condition: (cols, meta) => {
      const studyCol = cols.find(col => (col.name.toLowerCase().includes('study') || col.name.toLowerCase().includes('id')) && col.type === 'text');
      const participantCol = cols.find(col => col.name.toLowerCase().includes('participant') && col.type === 'text');
      const complianceCol = cols.find(col => (col.name.toLowerCase().includes('compliance') || col.name.toLowerCase().includes('wear time')) && col.type === 'number');
      return studyCol && participantCol && complianceCol;
    },
    suggestion: {
      chartType: 'bar',
      xField: cols.find(col => col.name.toLowerCase().includes('participant') && col.type === 'text').name,
      yFields: [cols.find(col => (col.name.toLowerCase().includes('compliance') || col.name.toLowerCase().includes('wear time')) && col.type === 'number').name],
      seriesField: cols.find(col => (col.name.toLowerCase().includes('study') || col.name.toLowerCase().includes('id')) && col.type === 'text').name,
      title: 'Participant Compliance Metrics',
      priority: 2,
      echartsHints: {}
    }
  }
];


/* Claude Haiku 4.5 (via DuckDuckGo AI) */
const advanced_chart_rules_claude_haiku = [
// Rule 1: Latitude + Longitude (Geo/Map visualization)
{
  id: 'rule_geo_001',
  description: 'Detects latitude and longitude columns for geographic visualization',
  condition: (cols, meta) => {
    const hasLat = cols.some(c => /lat(itude)?/i.test(c.name));
    const hasLon = cols.some(c => /lon(gitude)?/i.test(c.name));
    return hasLat && hasLon;
  },
  suggestion: {
    chartType: 'scatter', // ECharts scatter on geo coords; alternatively use 'effectScatter'
    xField: cols.find(c => /lon(gitude)?/i.test(c.name))?.name || null,
    yFields: [cols.find(c => /lat(itude)?/i.test(c.name))?.name],
    seriesField: null,
    title: 'Geographic Distribution',
    priority: 1,
    echartsHints: {
      // Note: True geo mapping requires registering map data separately in ECharts.
      // For simple lat/lon scatter, use standard cartesian. For actual maps, 
      // you'd need geo: {}, map: 'world', and registerMap() calls.
      coordinateSystem: 'cartesian2d',
      symbolSize: 8,
      itemStyle: { opacity: 0.7 }
    }
  }
},

// Rule 2: Percentage column (0-100 range, semantic meaning)
{
  id: 'rule_pct_001',
  description: 'Detects percentage columns by name pattern and value range',
  condition: (cols, meta) => {
    return cols.some(c => {
      const isPctName = /pct|percent|rate|ratio/i.test(c.name);
      if (c.type !== 'number') return false;
      // Optional: sniff min/max from data to confirm 0-100 range
      return isPctName;
    });
  },
  suggestion: {
    chartType: 'gauge', // Gauge chart for single percentage; bar if multiple
    xField: null,
    yFields: [cols.find(c => /pct|percent|rate|ratio/i.test(c.name))?.name],
    seriesField: null,
    title: 'Percentage Metric',
    priority: 2,
    echartsHints: {
      // Gauge expects min: 0, max: 100 by default. Set axisLine, splitLine, axisTick.
      // If multiple pct columns, switch to bar with axisPointer.
      min: 0,
      max: 100,
      splitNumber: 10,
      axisLine: { lineStyle: { width: 30 } },
      progress: { itemStyle: { color: '#58c4dc' } }
    }
  }
},

// Rule 3: Single aggregate KPI (rowCount === 1, single number)
{
  id: 'rule_kpi_001',
  description: 'Detects single-row aggregates (KPI, total, summary metric)',
  condition: (cols, meta) => {
    return meta.rowCount === 1 && cols.filter(c => c.type === 'number').length >= 1;
  },
  suggestion: {
    chartType: 'gauge', // or 'statistic' if using echarts-stat; gauge is native
    xField: null,
    yFields: cols.filter(c => c.type === 'number').map(c => c.name),
    seriesField: null,
    title: 'Key Performance Indicator',
    priority: 1,
    echartsHints: {
      // For KPI display, use gauge or custom statistic series.
      // Suppress legend, axis labels. Focus on large, readable number.
      type: 'gauge',
      startAngle: 225,
      endAngle: -45,
      radius: '75%',
      center: ['50%', '50%'],
      min: 0,
      max: 100,
      splitNumber: 10,
      axisLine: { lineStyle: { width: 30, color: [[1, '#E5E7EB']] } },
      pointer: { itemStyle: { color: 'auto' } },
      axisTick: { distance: -30, splitNumber: 5 },
      splitLine: { distance: -30, length: 8, lineStyle: { color: '#fff' } },
      axisLabel: { color: 'auto', distance: 40, fontSize: 16 },
      detail: { valueAnimation: true, formatter: '{value}', color: 'auto', fontSize: 20 }
    }
  }
},

// Rule 4: Large dataset (>500 rows) with date + number (downsampling/aggregation)
{
  id: 'rule_perf_001',
  description: 'Large time-series dataset; suggests aggregation or sampling',
  condition: (cols, meta) => {
    const hasDate = cols.some(c => c.type === 'date');
    const hasNum = cols.some(c => c.type === 'number');
    return meta.rowCount > 500 && hasDate && hasNum;
  },
  suggestion: {
    chartType: 'line', // or 'bar'; line is typical for time-series
    xField: cols.find(c => c.type === 'date')?.name || null,
    yFields: cols.filter(c => c.type === 'number').map(c => c.name),
    seriesField: null,
    title: 'Time Series (Large Dataset)',
    priority: 2,
    echartsHints: {
      // ECharts performance: use sampling, data decimation, or large-mode.
      // Set sampling: 'lttb' (Largest-Triangle-Three-Buckets) or 'average'.
      // Disable smooth curves; use step or linear. Disable animations on load.
      sampling: 'lttb',
      large: true,
      largeThreshold: 2000,
      animation: false,
      lineStyle: { width: 1 },
      // Consider progressive rendering for >10k points
      progressive: 1000,
      progressiveThreshold: 3000,
      progressiveAnimation: false
    }
  }
},

// Rule 5: Binary/boolean-like column (exactly 2 unique values)
{
  id: 'rule_binary_001',
  description: 'Column with exactly 2 unique values (binary categorical)',
  condition: (cols, meta) => {
    return cols.some(c => c.cardinality === 2);
  },
  suggestion: {
    chartType: 'pie', // or bar; pie for binary split visibility
    xField: null,
    yFields: [],
    seriesField: cols.find(c => c.cardinality === 2)?.name || null,
    title: 'Binary Distribution',
    priority: 2,
    echartsHints: {
      // Pie chart with 2 slices for binary. Use contrasting colors.
      // Alternatively, use bar with 2 categories for side-by-side comparison.
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, position: 'outside' },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } }
    }
  }
},

// Rule 6: Funnel/pipeline stage columns (stage, step, phase, status)
{
  id: 'rule_funnel_001',
  description: 'Detects funnel/pipeline stage columns (stage, step, phase, status)',
  condition: (cols, meta) => {
    const stageNames = ['stage', 'step', 'phase', 'status', 'pipeline'];
    const hasStage = cols.some(c => stageNames.some(s => c.name.toLowerCase().includes(s)));
    const hasNum = cols.some(c => c.type === 'number');
    return hasStage && hasNum;
  },
  suggestion: {
    chartType: 'funnel',
    xField: cols.find(c => ['stage', 'step', 'phase', 'status', 'pipeline'].some(s => c.name.toLowerCase().includes(s)))?.name || null,
    yFields: [cols.find(c => c.type === 'number')?.name],
    seriesField: null,
    title: 'Funnel Analysis',
    priority: 1,
    echartsHints: {
      // Funnel chart: x-axis is stages (categorical), y-axis is count/value.
      // Set sort: 'descending' to show drop-off. Use label positioning for clarity.
      // Gap between levels shows conversion loss.
      type: 'funnel',
      sort: 'descending',
      gap: 2,
      label: { show: true, position: 'inside', formatter: '{b}: {c}' },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      emphasis: { label: { fontSize: 16 } }
    }
  }
},

// Rule 7: Wide numeric range (max/min > 1000) — log scale candidate
{
  id: 'rule_logscale_001',
  description: 'Numeric column with extreme range (max/min > 1000); log scale recommended',
  condition: (cols, meta) => {
    // This requires inspecting actual data; assume a helper or manual flag
    // Pseudo-code: calculate min/max from data, check ratio
    // For now, check if column name suggests exponential (e.g., 'exponent', 'log', 'order')
    return cols.some(c => {
      const isWideRange = /exponent|log|order|magnitude/i.test(c.name);
      return c.type === 'number' && isWideRange;
    });
  },
  suggestion: {
    chartType: 'scatter', // or line; scatter shows distribution clearly on log scale
    xField: cols.find(c => c.type === 'date')?.name || null,
    yFields: cols.filter(c => c.type === 'number' && /exponent|log|order|magnitude/i.test(c.name)).map(c => c.name),
    seriesField: null,
    title: 'Wide-Range Numeric Data (Log Scale)',
    priority: 2,
    echartsHints: {
      // Use yAxis type: 'log' to linearize exponential data.
      // Prevents small values from being invisible.
      yAxis: {
        type: 'log',
        logBase: 10,
        name: 'Value (log scale)'
      },
      symbolSize: 6,
      itemStyle: { opacity: 0.6 }
    }
  }
},

// Rule 8: Two date columns (start/end range — timeline or Gantt)
{
  id: 'rule_gantt_001',
  description: 'Two date columns suggesting start/end or duration (Gantt timeline)',
  condition: (cols, meta) => {
    const dateCols = cols.filter(c => c.type === 'date');
    return dateCols.length >= 2;
  },
  suggestion: {
    chartType: 'custom', // Gantt is not native; use bar with custom rendering or custom series
    xField: 'startDate', // placeholder; detect start/end by name
    yFields: [],
    seriesField: null,
    title: 'Timeline / Gantt Chart',
    priority: 1,
    echartsHints: {
      // ECharts doesn't have native Gantt. Options:
      // 1. Use custom series with renderItem to draw rectangles between dates.
      // 2. Use horizontal bar chart with stacked data.
      // 3. Use heatmap with time buckets.
      // Recommend: custom series with two date fields as start/end.
      // Set xAxis type: 'time' and use renderItem callback.
      type: 'custom',
      renderItem: 'renderGanttItem', // custom function in your code
      xAxisIndex: 0,
      yAxisIndex: 0,
      encode: { x: ['startDate', 'endDate'], y: 'taskName' }
    }
  }
},

// Rule 9: Hierarchical columns (category + subcategory)
{
  id: 'rule_hierarchy_001',
  description: 'Hierarchical text columns (category/subcategory, parent/child)',
  condition: (cols, meta) => {
    const textCols = cols.filter(c => c.type === 'text');
    const hasHierarchy = textCols.some(c => /category|parent|group|level|class/i.test(c.name)) &&
                         textCols.some(c => /sub|child|detail|item|type/i.test(c.name));
    return hasHierarchy;
  },
  suggestion: {
    chartType: 'treemap', // or sunburst; treemap for hierarchical area view
    xField: cols.find(c => /category|parent|group|level|class/i.test(c.name) && c.type === 'text')?.name || null,
    yFields: [cols.find(c => c.type === 'number')?.name || null].filter(Boolean),
    seriesField: cols.find(c => /sub|child|detail|item|type/i.test(c.name) && c.type === 'text')?.name || null,
    title: 'Hierarchical Breakdown',
    priority: 2,
    echartsHints: {
      // Treemap: parent-child hierarchy via data structure.
      // Each node has value (area) and children. Requires data transformation.
      // Sunburst is concentric rings; treemap is nested rectangles.
      type: 'treemap',
      roam: false,
      nodeClick: 'zoomToNode',
      label: { position: 'inside', formatter: '{b}' },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      levels: [
        { itemStyle: { borderColor: '#777', borderWidth: 0, gapWidth: 1 } },
        { itemStyle: { borderColor: '#555', borderWidth: 5, gapWidth: 1 }, label: { show: false } },
        { itemStyle: { borderColor: '#ddd', borderWidth: 5, gapWidth: 1 }, label: { show: false } }
      ]
    }
  }
},

// Rule 10: High-cardinality text column (>50% unique) — word cloud candidate
{
  id: 'rule_wordcloud_001',
  description: 'High-cardinality text column (>50% unique values)',
  condition: (cols, meta) => {
    return cols.some(c => {
      const uniqueRatio = c.cardinality / meta.rowCount;
      return c.type === 'text' && uniqueRatio > 0.5;
    });
  },
  suggestion: {
    chartType: 'custom', // Word cloud is not native; use custom or external library
    xField: null,
    yFields: [],
    seriesField: cols.find(c => c.type === 'text' && (c.cardinality / meta.rowCount) > 0.5)?.name || null,
    title: 'Word Cloud / High-Cardinality Distribution',
    priority: 3,
    echartsHints: {
      // ECharts doesn't have native word cloud. Options:
      // 1. Use custom series with text rendering.
      // 2. Integrate third-party library (wordcloud.js, echarts-wordcloud).
      // 3. Fall back to bar chart (top N values by frequency).
      // Recommend: bar chart of top 20-50 values sorted by frequency.
      type: 'bar',
      // Pseudo-code: aggregate by text column, sort by count desc, take top N
      data: 'aggregated top 50 by frequency',
      xAxis: { type: 'category' },
      yAxis: { type: 'value' },
      label: { show: true, position: 'right' }
    }
  }
},

// Rule 11: Glucose/CGM data (glucose column + date + optional insulin)
{
  id: 'rule_cgm_001',
  description: 'CGM glucose data with timestamp and optional insulin delivery',
  condition: (cols, meta) => {
    const hasGlucose = cols.some(c => /glucose|blood.?sugar|bg|mg.?dl|mmol/i.test(c.name) && c.type === 'number');
    const hasDate = cols.some(c => c.type === 'date');
    return hasGlucose && hasDate;
  },
  suggestion: {
    chartType: 'line',
    xField: cols.find(c => c.type === 'date')?.name || null,
    yFields: [
      cols.find(c => /glucose|blood.?sugar|bg|mg.?dl|mmol/i.test(c.name))?.name
    ].filter(Boolean),
    seriesField: cols.find(c => /insulin|bolus|basal/i.test(c.name))?.name || null,
    title: 'Glucose Levels Over Time',
    priority: 1,
    echartsHints: {
      // CGM visualization: line for glucose trend, optional bar/scatter for insulin events.
      // Add reference zones (normal, low, high) via markArea.
      // Glucose typically 70–180 mg/dL for target range.
      xAxis: { type: 'time' },
      yAxis: {
        type: 'value',
        name: 'Glucose (mg/dL)',
        min: 40,
        max: 400,
        splitLine: { show: true }
      },
      markArea: [
        {
          name: 'Normal',
          itemStyle: { color: 'rgba(0, 255, 0, 0.1)' },
          data: [[{ yAxis: 70 }, { yAxis: 180 }]]
        },
        {
          name: 'Low',
          itemStyle: { color: 'rgba(255, 0, 0, 0.1)' },
          data: [[{ yAxis: 0 }, { yAxis: 70 }]]
        },
        {
          name: 'High',
          itemStyle: { color: 'rgba(255, 165, 0, 0.1)' },
          data: [[{ yAxis: 180 }, { yAxis: 400 }]]
        }
      ],
      series: [
        {
          name: 'Glucose',
          type: 'line',
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { borderWidth: 0 }
        }
      ]
    }
  }
},

// Rule 12: Support ticket/incident data (assignee + ticket count + status + rating)
{
  id: 'rule_tickets_001',
  description: 'Support ticket data with assignee, ticket count/ID, status, and satisfaction rating',
  condition: (cols, meta) => {
    const hasAssignee = cols.some(c => /assignee|technician|analyst|owner|agent/i.test(c.name) && c.type === 'text');
    const hasTicket = cols.some(c => /ticket|incident|case|issue|id/i.test(c.name));
    const hasStatus = cols.some(c => /status|state|stage|priority/i.test(c.name));
    return hasAssignee && hasTicket && hasStatus;
  },
  suggestion: {
    chartType: 'bar',
    xField: cols.find(c => /assignee|technician|analyst|owner|agent/i.test(c.name))?.name || null,
    yFields: [
      cols.find(c => /ticket|incident|case|issue|count/i.test(c.name) && c.type === 'number')?.name
    ].filter(Boolean),
    seriesField: cols.find(c => /status|state|stage|priority/i.test(c.name))?.name || null,
    title: 'Support Ticket Distribution by Assignee',
    priority: 1,
    echartsHints: {
      // Stacked bar: assignee on x-axis, ticket count on y-axis, status as series.
      // Optional: add scatter overlay for satisfaction rating (bubble size = rating).
      // Use color coding for status (red=open, yellow=pending, green=closed).
      type: 'bar',
      stack: 'total',
      label: { show: true, position: 'insideRight' },
      itemStyle: {
        borderRadius: [8, 8, 0, 0]
      },
      color: ['#d62728', '#ff7f0e', '#2ca02c'], // red, orange, green for status
      xAxis: { type: 'category' },
      yAxis: { type: 'value', name: 'Ticket Count' }
    }
  }
},

// Rule 13: Sleep stage data (timestamp + sleep stage + optional HRV)
{
  id: 'rule_sleep_001',
  description: 'Sleep tracking data with timestamp, sleep stage, and optional HRV RMSSD',
  condition: (cols, meta) => {
    const hasDate = cols.some(c => c.type === 'date');
    const hasStage = cols.some(c => /sleep.?stage|stage|awake|light|deep|rem/i.test(c.name));
    return hasDate && hasStage;
  },
  suggestion: {
    chartType: 'custom', // Sankey or custom series for sleep hypnogram
    xField: cols.find(c => c.type === 'date')?.name || null,
    yFields: [
      cols.find(c => /hrv|rmssd|heart.?rate/i.test(c.name))?.name || null
    ].filter(Boolean),
    seriesField: cols.find(c => /sleep.?stage|stage|awake|light|deep|rem/i.test(c.name))?.name || null,
    title: 'Sleep Architecture & HRV',
    priority: 1,
    echartsHints: {
      // Sleep hypnogram: x=time, y=stage (categorical: Awake, Light, Deep, REM).
      // Use custom series or stacked area to show stage transitions.
      // Optional: secondary y-axis for HRV RMSSD as line overlay.
      // Color: Awake=red, Light=yellow, Deep=blue, REM=purple.
      type: 'custom',
      renderItem: 'renderSleepStage', // custom function to draw stage blocks
      xAxis: { type: 'time', name: 'Time' },
      yAxis: {
        type: 'category',
        data: ['Awake', 'Light', 'Deep', 'REM'],
        name: 'Sleep Stage'
      },
      color: ['#ff0000', '#ffff00', '#0000ff', '#800080'],
      // Optional secondary yAxis for HRV
      yAxis: [
        { type: 'category', data: ['Awake', 'Light', 'Deep', 'REM'] },
        { type: 'value', name: 'HRV RMSSD (ms)', position: 'right' }
      ]
    }
  }
},

// Rule 14: Clinical study data (study ID + participant ID + compliance/wear metrics)
{
  id: 'rule_study_001',
  description: 'Clinical study data with study/participant ID and compliance, wear time, enrollment metrics',
  condition: (cols, meta) => {
    const hasStudy = cols.some(c => /study|trial|protocol/i.test(c.name));
    const hasParticipant = cols.some(c => /participant|subject|patient|id/i.test(c.name));
    const hasMetric = cols.some(c => /compliance|wear.?time|enrollment|adherence/i.test(c.name) && c.type === 'number');
    return hasStudy && hasParticipant && hasMetric;
  },
  suggestion: {
    chartType: 'scatter', // or bubble chart for multi-dimensional comparison
    xField: cols.find(c => /compliance|adherence/i.test(c.name))?.name || null,
    yFields: [
      cols.find(c => /wear.?time|wear.?duration/i.test(c.name))?.name || null
    ].filter(Boolean),
    seriesField: cols.find(c => /enrollment|status|group|arm/i.test(c.name))?.name || null,
    title: 'Study Participant Compliance & Wear Time',
    priority: 1,
    echartsHints: {
      // Bubble/scatter: x=compliance%, y=wear time hours, bubble size=enrollment duration.
      // Color by enrollment status (active, completed, withdrawn).
      // Add reference lines for target compliance (e.g., 80%) and minimum wear time.
      type: 'scatter',
      symbolSize: (data) => {
        // Bubble size proportional to wear time or enrollment duration
        return Math.sqrt(data[2]) * 6; // data[2] = third dimension
      },
      xAxis: {
        type: 'value',
        name: 'Compliance (%)',
        min: 0,
        max: 100,
        markLine: {
          data: [{ yAxis: 80, name: 'Target (80%)' }]
        }
      },
      yAxis: {
        type: 'value',
        name: 'Wear Time (hours)',
        markLine: {
          data: [{ yAxis: 168, name: 'Target (1 week)' }]
        }
      },
      itemStyle: { opacity: 0.6, borderColor: '#fff', borderWidth: 1 },
      emphasis: { itemStyle: { opacity: 1, borderWidth: 2 } }
    }
  }
}


]

</code>


### Dashboard Layouts:
***Prompt:**
<code>
I have a flat table (materialized view) with the following columns and sample rows:

```
(paste from csv/excel)

```



I am building an Apache ECharts dashboard. Suggest a complete dashboard

layout as a JSON array. Each element represents one widget panel:



{

panelId: 'p1',

title: string,

chartType: string, // ECharts series type

xField: string | null,

yField: string | string[], // support multi-series

seriesField: string | null,

gridPosition: { row: number, col: number, rowSpan: number, colSpan: number },

echartsOption: {} // partial echarts option object

rationale: string // why this widget for this data

}



Rules:

- Assume a css flexbox layout for the canvas

- Lead with the most important insight

- Mix chart types for visual variety

- Include at least one KPI stat card if appropriate

- Prefer bar/line for time series, pie only if <= 6 categories

- Avoid redundancy between panels
</code>

***Output:**
<code>
const dashboard_layouts = [
  {
    "dashboardName": "Sleep Data Analysis",
    "panels": [
      {
        "panelId": "sleep_p1",
        "title": "Total Sleep Logs Recorded",
        "chartType": "gauge",
        "xField": null,
        "yField": "LogId",
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": {
          "series": [{ "type": "gauge", "progress": { "show": true } }]
        },
        "rationale": "High-level KPI count of the total dataset volume."
      },
      {
        "panelId": "sleep_p2",
        "title": "Self-Reported Data Validity",
        "chartType": "pie",
        "xField": "SelfReportedAccuracyFlag",
        "yField": "LogId",
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": {
          "series": [{ "type": "pie", "radius": ["40%", "70%"] }]
        },
        "rationale": "Binary cardinality (TRUE/FALSE) is perfect for a donut chart."
      },
      {
        "panelId": "sleep_p3",
        "title": "Onset vs. Wake Discrepancies",
        "chartType": "scatter",
        "xField": "SelfReportedToActualSleepTimeDiff",
        "yField": "SelfReportedToActualWakeTimeDiff",
        "seriesField": "ParticipantId",
        "gridPosition": { "row": 1, "col": 7, "rowSpan": 1, "colSpan": 6 },
        "echartsOption": {
          "xAxis": { "type": "value", "scale": true },
          "yAxis": { "type": "value", "scale": true },
          "series": [{ "type": "scatter" }]
        },
        "rationale": "Identifies outliers and correlation between onset and wake reporting errors."
      },
      {
        "panelId": "sleep_p4",
        "title": "Reporting Discrepancies Over Time",
        "chartType": "line",
        "xField": "SleepDate",
        "yField": ["SelfReportedToActualSleepTimeDiff", "SelfReportedToActualWakeTimeDiff"],
        "seriesField": null,
        "gridPosition": { "row": 2, "col": 1, "rowSpan": 1, "colSpan": 12 },
        "echartsOption": {
          "xAxis": { "type": "time" },
          "dataZoom": [{ "type": "inside" }, { "type": "slider" }],
          "series": [{ "type": "line" }, { "type": "line" }]
        },
        "rationale": "Time-series spanning full width to track longitudinal reporting accuracy."
      }
    ]
  },
  {
    "dashboardName": "Academic Publications",
    "panels": [
      {
        "panelId": "pub_p1",
        "title": "Total Publications",
        "chartType": "gauge",
        "xField": null,
        "yField": "PUBLCTN_ID",
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": {
          "series": [{ "type": "gauge" }]
        },
        "rationale": "KPI for total publication output."
      },
      {
        "panelId": "pub_p2",
        "title": "Publications by Journal",
        "chartType": "bar",
        "xField": "PUBLCTN_JOURNAL",
        "yField": "PUBLCTN_ID",
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 9 },
        "echartsOption": {
          "xAxis": { "type": "value" },
          "yAxis": { "type": "category", "inverse": true },
          "series": [{ "type": "bar" }]
        },
        "rationale": "Horizontal bar chart handles high-cardinality, long journal names better than standard columns."
      },
      {
        "panelId": "pub_p3",
        "title": "Publication Status",
        "chartType": "pie",
        "xField": "PUBLCTN_STATUS",
        "yField": "PUBLCTN_ID",
        "seriesField": null,
        "gridPosition": { "row": 2, "col": 1, "rowSpan": 1, "colSpan": 4 },
        "echartsOption": {
          "series": [{ "type": "pie", "radius": "60%" }]
        },
        "rationale": "Shows proportion of published vs. pending/in-review items."
      }
    ]
  },
  {
    "dashboardName": "Ecological Momentary Assessment (EMA)",
    "panels": [
      {
        "panelId": "ema_p1",
        "title": "Total Surveys Completed",
        "chartType": "gauge",
        "xField": null,
        "yField": "surveykey",
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": { "series": [{ "type": "gauge" }] },
        "rationale": "Baseline KPI for user engagement."
      },
      {
        "panelId": "ema_p2",
        "title": "Device Platform Usage",
        "chartType": "pie",
        "xField": "deviceplatform",
        "yField": "surveykey",
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": { "series": [{ "type": "pie", "radius": ["40%", "70%"] }] },
        "rationale": "Low cardinality text column (iOS/Android) suited for a donut chart."
      },
      {
        "panelId": "ema_p3",
        "title": "EMA Question 1-4 Distributions",
        "chartType": "boxplot",
        "xField": null,
        "yField": ["EMA_01", "EMA_02", "EMA_03", "EMA_04"],
        "seriesField": null,
        "gridPosition": { "row": 1, "col": 7, "rowSpan": 1, "colSpan": 6 },
        "echartsOption": {
           "xAxis": { "type": "category" },
           "series": [{ "type": "boxplot" }]
        },
        "rationale": "Boxplots efficiently summarize the spread and median of multiple Likert-scale numeric responses."
      },
      {
        "panelId": "ema_p4",
        "title": "Survey Responses Over Time",
        "chartType": "line",
        "xField": "start_datetime",
        "yField": "surveykey",
        "seriesField": "surveyname",
        "gridPosition": { "row": 2, "col": 1, "rowSpan": 1, "colSpan": 12 },
        "echartsOption": { "xAxis": { "type": "time" }, "series": [{ "type": "line" }] },
        "rationale": "Tracks completion volume per survey type longitudinally."
      }
    ]
  },
  {
    "dashboardName": "Research Team Directory",
    "panels": [
      {
        "panelId": "team_p1",
        "title": "Total Staff",
        "chartType": "gauge",
        "xField": null,
        "yField": "UniqueName",
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": { "series": [{ "type": "gauge" }] },
        "rationale": "Staff headcount."
      },
      {
        "panelId": "team_p2",
        "title": "Staff by Department",
        "chartType": "pie",
        "xField": "Department",
        "yField": "UniqueName",
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 4 },
        "echartsOption": { "series": [{ "type": "pie" }] },
        "rationale": "Distribution of team members across academic departments."
      },
      {
        "panelId": "team_p3",
        "title": "Staff by Job Title",
        "chartType": "treemap",
        "xField": null,
        "yField": "UniqueName",
        "seriesField": "Job Title",
        "gridPosition": { "row": 1, "col": 8, "rowSpan": 1, "colSpan": 5 },
        "echartsOption": { "series": [{ "type": "treemap", "roam": false }] },
        "rationale": "Treemaps handle hierarchical or moderately high-cardinality titles better than pies."
      }
    ]
  },
  {
    "dashboardName": "HR Employee Directory",
    "panels": [
      {
        "panelId": "hr_p1",
        "title": "Total Employees",
        "chartType": "gauge",
        "xField": null,
        "yField": "EmplId",
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": { "series": [{ "type": "gauge" }] },
        "rationale": "Headcount KPI."
      },
      {
        "panelId": "hr_p2",
        "title": "Distribution by Work City",
        "chartType": "pie",
        "xField": "Work_City",
        "yField": "EmplId",
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 4 },
        "echartsOption": { "series": [{ "type": "pie", "radius": ["40%","70%"] }] },
        "rationale": "Geographic distribution of the workforce."
      },
      {
        "panelId": "hr_p3",
        "title": "Headcount by Dept Description",
        "chartType": "bar",
        "xField": "Dept_Description",
        "yField": "EmplId",
        "gridPosition": { "row": 1, "col": 8, "rowSpan": 1, "colSpan": 5 },
        "echartsOption": { "xAxis": { "type": "value" }, "yAxis": { "type": "category" }, "series": [{ "type": "bar" }] },
        "rationale": "Horizontal bars for long department names."
      }
    ]
  },
  {
    "dashboardName": "Continous Glucose Monitor (CGM) AGP Data",
    "panels": [
      {
        "panelId": "tp_p1",
        "title": "Ambulatory Glucose Trend",
        "chartType": "line",
        "xField": "Local Time",
        "yField": "Value",
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 12 },
        "echartsOption": {
          "xAxis": { "type": "time" },
          "yAxis": { "type": "value", "name": "mg/dL" },
          "dataZoom": [{ "type": "inside" }, { "type": "slider" }],
          "series": [{ 
            "type": "line", 
            "showSymbol": false, 
            "markArea": { "data": [[{ "yAxis": 70 }, { "yAxis": 180 }]], "itemStyle": { "color": "rgba(0,255,0,0.1)" } } 
          }]
        },
        "rationale": "Uses the heuristic rule for CGM data to apply clinical target ranges (70-180 mg/dL) as a markArea."
      }
    ]
  },
  {
    "dashboardName": "Activity Heart Rate Zones",
    "panels": [
      {
        "panelId": "hr_p1",
        "title": "Total Active Minutes",
        "chartType": "gauge",
        "xField": null,
        "yField": "total_minutes",
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": { "series": [{ "type": "gauge" }] },
        "rationale": "KPI for aggregate physical activity."
      },
      {
        "panelId": "hr_p2",
        "title": "Minutes by Heart Zone",
        "chartType": "pie",
        "xField": "heart_zone",
        "yField": "total_minutes",
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 4 },
        "echartsOption": { "series": [{ "type": "pie", "radius": "50%" }] },
        "rationale": "Shows proportion of time spent in Fat Burn vs Cardio."
      },
      {
        "panelId": "hr_p3",
        "title": "Heart Zones Over Time",
        "chartType": "bar",
        "xField": "date_time",
        "yField": "total_minutes",
        "seriesField": "heart_zone",
        "gridPosition": { "row": 1, "col": 8, "rowSpan": 1, "colSpan": 5 },
        "echartsOption": { "xAxis": { "type": "time" }, "series": [{ "type": "bar", "stack": "total" }] },
        "rationale": "Stacked bars efficiently show total daily volume while breaking down zone intensity."
      }
    ]
  },
  {
    "dashboardName": "Continous Glucose Data (CGM) Analysis",
    "panels": [
      {
        "panelId": "fl3_p1",
        "title": "Historic Glucose Trend",
        "chartType": "line",
        "xField": "Device Timestamp",
        "yField": "Historic Glucose mg/dL",
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 12 },
        "echartsOption": {
          "xAxis": { "type": "time" },
          "yAxis": { "type": "value", "name": "mg/dL" },
          "dataZoom": [{ "type": "inside" }, { "type": "slider" }],
          "series": [{ 
            "type": "line", 
            "smooth": true,
            "markArea": { "data": [[{ "yAxis": 70 }, { "yAxis": 180 }]], "itemStyle": { "color": "rgba(0,255,0,0.1)" } } 
          }]
        },
        "rationale": "Applies standard CGM clinical heuristic overlay to raw Libre timestamp data."
      }
    ]
  },
  {
    "dashboardName": "Fitness Tracker Daily Activity",
    "panels": [
      {
        "panelId": "fb_p1",
        "title": "Daily Steps vs Distance",
        "chartType": "line",
        "xField": "Date",
        "yField": ["Steps", "Distance"],
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 6 },
        "echartsOption": {
          "xAxis": { "type": "time" },
          "yAxis": [{ "type": "value", "name": "Steps" }, { "type": "value", "name": "Distance" }],
          "series": [{ "type": "line", "yAxisIndex": 0 }, { "type": "line", "yAxisIndex": 1 }]
        },
        "rationale": "Dual-axis line chart comparing two highly correlated metrics with different units."
      },
      {
        "panelId": "fb_p2",
        "title": "Activity Intensity Distribution",
        "chartType": "bar",
        "xField": "Date",
        "yField": ["Minutes Sedentary", "Minutes Lightly Active", "Minutes Fairly Active", "Minutes Very Active"],
        "gridPosition": { "row": 1, "col": 7, "rowSpan": 1, "colSpan": 6 },
        "echartsOption": {
          "xAxis": { "type": "time" },
          "series": [{ "type": "bar", "stack": "intensity" }, { "type": "bar", "stack": "intensity" }, { "type": "bar", "stack": "intensity" }, { "type": "bar", "stack": "intensity" }]
        },
        "rationale": "Stacked bar chart perfectly represents the sum of a 24-hour period broken into discrete intensity phases."
      }
    ]
  },
  {
    "dashboardName": "Continous Glucose Monitor (CGM) Events and Glucose Analysis",
    "sourceFile": "image_625e5b.png",
    "panels": [
      {
        "panelId": "g7_p1",
        "title": "Event Type Breakdown",
        "chartType": "pie",
        "xField": "Event Type",
        "yField": "Index",
        "gridPosition": { "row": 1, "col": 1, "rowSpan": 1, "colSpan": 3 },
        "echartsOption": { "series": [{ "type": "pie", "radius": "60%" }] },
        "rationale": "Highlights the ratio of EGVs (continuous readings) to manual user events (Meals, Activity, Calibrations)."
      },
      {
        "panelId": "g7_p2",
        "title": "Glucose Value with Interventions",
        "chartType": "scatter",
        "xField": "Timestamp",
        "yField": "Glucose Value",
        "seriesField": "Event Type",
        "gridPosition": { "row": 1, "col": 4, "rowSpan": 1, "colSpan": 9 },
        "echartsOption": {
          "xAxis": { "type": "time" },
          "yAxis": { "type": "value" },
          "dataZoom": [{ "type": "inside" }, { "type": "slider" }],
          "series": [{ "type": "scatter" }]
        },
        "rationale": "Using a scatter plot colored by 'Event Type' allows clinicians to see exactly when Meals or Activities occurred relative to the glucose value at that moment."
      }
    ]
  }
]
</code>