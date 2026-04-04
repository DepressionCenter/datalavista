/* ============================================================
This file is part of DataLaVista™
generate-sample-data-javascript.js: Script for generating synthetic sample data.
Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
Created: 2026-03-28
Last Modified: 2026-03-29
Summary: Script for generating synthetic sample data.
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

const NUM_STUDIES = 500;
const NUM_PARTICIPANTS = 500;
const phases = ["Phase I", "Phase II", "Phase III", "Phase IV"];

// 1. Generate Data
let studies = [];
for (let i = 1; i <= NUM_STUDIES; i++) {
    studies.push({
        study_id: i,
        title: `Study-${Math.floor(Math.random() * 9000) + 1000}`,
        phase: phases[Math.floor(Math.random() * phases.length)],
        budget: (Math.random() * 1950000 + 50000).toFixed(2)
    });
}

let participants = [];
let sqlInserts = "CREATE TABLE studies (study_id INTEGER PRIMARY KEY, title TEXT, phase TEXT, budget REAL);\n" +
                 "CREATE TABLE participants (participant_id INTEGER PRIMARY KEY, name TEXT);\n" +
                 "CREATE TABLE enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, p_id INTEGER, s_id INTEGER);\n";

for (let s of studies) {
    sqlInserts += `INSERT INTO studies VALUES (${s.study_id}, '${s.title}', '${s.phase}', ${s.budget});\n`;
}

for (let i = 1; i <= NUM_PARTICIPANTS; i++) {
    let enrolled = [];
    let numEnrolled = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < numEnrolled; j++) {
        let study = studies[Math.floor(Math.random() * studies.length)];
        enrolled.push({ study_id: study.study_id, title: study.title });
        sqlInserts += `INSERT INTO enrollments (p_id, s_id) VALUES (${i}, ${study.study_id});\n`;
    }
    participants.push({ participant_id: i, name: `Participant_${i}`, enrollments: enrolled });
    sqlInserts += `INSERT INTO participants VALUES (${i}, 'Participant_${i}');\n`;
}

// 2. Format File Strings
let csvContent = "study_id,title,phase,budget\n" + studies.map(s => `${s.study_id},${s.title},${s.phase},${s.budget}`).join("\n");
let jsonContent = JSON.stringify(participants, null, 4);
let xmlContent = "<Researchers>\n" + [1,2,3,4,5].map(i => `  <Researcher id="${i}"><Name>Dr_${i}</Name></Researcher>`).join("\n") + "\n</Researchers>";

// 3. Helper function to trigger browser downloads
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 4. Trigger Downloads
downloadFile("studies.csv", csvContent, "text/csv");
downloadFile("participants.json", jsonContent, "application/json");
downloadFile("researchers.xml", xmlContent, "application/xml");
downloadFile("database_schema.sql", sqlInserts, "text/plain");

console.log("Downloads triggered for DataLavista files!");