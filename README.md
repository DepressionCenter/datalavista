<!--
This file is part of DataLaVista
README.md
Author(s): Gabriel Mongefranco.
Created: 2026-03-10
Last Modified: 2026-03-10
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

## Description
***🕶️ Tell your expensive BI tools: "Data la vista, baby!"***

***DataLaVista*** is a lightweight, client-side reporting and dashboard toolkit. It brings the full power of SQL directly to your browser, allowing you to build high-performance visualizations without the need for expensive server-side licenses or complex backend infrastructure.

<img src="images/datalavista-screenshot-1.png" 
    alt="Screenshot of Data La Vista in action, terminating a data silo, displaying a SQL query with auto-completion dropdown menu and a dashboard designer with a table and pie chart with filters." 
    style="max-width:800px; width:100%; display:block; margin:auto;" />

While it was initially designed to dominate SharePoint List items with pure JavaScript widgets that run directly in the browser, Data La Vista is built to be a universal survivor. It aims to be framework-agnostic and designed to plug into any webpage to terminate data silos across REST services, JSON, Excel, and CSV files.

Status: alpha — SharePoint adapters first; extensible adapters at later time ruptures.

### Come with me if you want to query
Most enterprise data is trapped behind bloated frameworks or expensive BI tools. Data La Vista terminates them to free your data:

+ Zero Server Footprint: 100% JavaScript. Your browser is the engine.
+ Full SQL Support: Query your SharePoint lists and flat files as if they were a relational database.
+ Pluggable Architecture: Works in SharePoint today; works in React, Vue, or vanilla HTML tomorrow.
+ Format Agnostic: Support for JSON, REST APIs, Excel (XLSX), and CSV is built into the roadmap.


## Quick Start Guide
+ In a SharePoint Online site, create a page using a blank template and call it "Report Designer"
+ Add a single webpart for "Modern Script Editor". If not available, contact your site administrator to [install it](https://github.com/pnp/sp-dev-fx-webparts/tree/main/samples/react-script-editor)
+ Copy and paste the contents of [ReportDesigner.html](ReportDesigner.html) into this file, then save and publish
+ Refresh the Report Designer page. Click connect, write your SQL in the 1st tab (available lists and fields will show as suggestions), build your dashboard in the 2nd tab, and copy the generated configuration on the 3rd tab. Paste that code in Notepad for now
+ Create a second page using a blank template and call it "Report" (you will need a separate page for each report)
+ Copy the contents of [ReportViewer.html](ReportViewer.html) and past them into notepad. Edit the section that says ***"REPORT CONFIGURATION"*** by replacing that section with the code you generated in report designer
+ Add a single webpart for "Modern Script Editor" and paste the code, then save and publish
+ Refresh the page. It should now display your report. Any users with access to the data and the site will be able to run it.




## Documentation
+ The full documentation is not yet available, but it will be coming to: https://michmed.org/efdc-kb




## Additional Resources
+ < Links to study website, related projects, etc. >


## Contributing
***I'll be back... with a better report.***
The mission is far from over. Future updates will include:
+ Full support for SharePoint Lists out of the box
+ Advanced REST Integration: Seamlessly fetch and join data from multiple API endpoints
+ Excel/CSV Drag-and-Drop: Instant dashboards from local spreadsheets
+ The "Skynet" UI Kit: A library of aggressive, high-contrast dashboard components
+ Support for Lua, a blazing fast and easy-to-learn scripting language


The initial version was developed in one day by [(@gabrielmongefranco)](https://github.com/gabrielmongefranco), in response to frustration with his IT department delaying access to dashboard licenses in apparent infinity. Continued development is dependent on availability in between work projects. Therefore, your contributions are vital to further developing, refining, and documenting this project! Contact efdc-mobiletech@umich.edu to get in touch, or submit issues, ideas or pull requests via GitHub.


## About the Team
The [Mobile Technologies Core](https://depressioncenter.org/mobiletech) provides investigators across the University of Michigan the support and guidance needed to utilize mobile technologies and digital mental health measures in their studies. Experienced faculty and staff offer hands-on consultative services to researchers throughout the University – regardless of specialty or research focus.

Learn more at: [https://depressioncenter.org/mobiletech](https://depressioncenter.org/mobiletech).



## Contact
To get in touch, contact the individual developers in the check-in history.

If you need assistance identifying a contact person, email the EFDC's Mobile Technologies Core at: efdc-mobiletech@umich.edu.



## Credits
#### Contributors:
+ [Eisenberg Family Depression Center](https://depressioncenter.org) [(@DepressionCenter)](https://github.com/DepressionCenter)
+ [Gabriel Mongefranco](https://gabriel.mongefranco.com) [(@gabrielmongefranco)](https://github.com/gabrielmongefranco)



#### This work is based in part on the following projects, libraries and/or studies:
+ [AlaSQL.js](https://github.com/alasql/alasql) - JavaScript SQL database for browser and Node.js.
+ [Apache ECharts](https://echarts.apache.org/en/index.html) - Free, powerful charting and visualization library offering easy ways to add intuitive, interactive, and highly customizable charts to your commercial products.
+ [CodeMirror](https://codemirror.net/) -  A code editor component for the web, providing SQL syntax highlighting and autocomplete for your queries.
+ [Modern Script Editor](https://github.com/pnp/sp-dev-fx-webparts/tree/main/samples/react-script-editor) - The PnP/SPFX delivery vehicle used to deploy this "Unit" into modern SharePoint environments.
+ [Microsoft SharePoint REST API](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/get-to-know-the-sharepoint-rest-service) - The primary data uplink for retrieving SharePoint List items and Document Library metadata.


## License
### Copyright Notice
Copyright © 2026 The Regents of the University of Michigan; Gabriel Mongefranco; Eisenberg Family Depression Center


### Software and Library License Notice
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/gpl-3.0-standalone.html>.


### Documentation License Notice
Permission is granted to copy, distribute and/or modify this document 
under the terms of the GNU Free Documentation License, Version 1.3 
or any later version published by the Free Software Foundation; 
with no Invariant Sections, no Front-Cover Texts, and no Back-Cover Texts. 
You should have received a copy of the license included in the section entitled "GNU 
Free Documentation License". If not, see <https://www.gnu.org/licenses/fdl-1.3-standalone.html>



## Citation
If you find this repository, code or paper useful for your research, please cite it.

#### Citation Example:
>_Mongefranco, Gabriel (2026). DataLaVista. University of Michigan. Software. https://github.com/DepressionCenter/datalavista_  
​​​​​​​     _DOI: [pending](https://doi.org/)_


----

Copyright © 2026 The Regents of the University of Michigan; Gabriel Mongefranco; Eisenberg Family Depression Center
