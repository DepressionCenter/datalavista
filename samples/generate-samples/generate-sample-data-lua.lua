-- ============================================================
-- This file is part of DataLaVista™
-- generate-sample-data-lua.lua: Script for generating synthetic sample data.
-- Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
-- Created: 2026-03-28
-- Last Modified: 2026-03-29
-- Summary: Script for generating synthetic sample data.
-- Notes: See README file for documentation and full license information.
-- Website: https://github.com/DepressionCenter/datalavista
-- 
-- Copyright (c) 2026 The Regents of the University of Michigan
-- 
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
-- You should have received a copy of the GNU General Public License along
-- with this program. If not, see <https://www.gnu.org/licenses/>.
================================================================

local NUM_STUDIES = 500
local NUM_PARTICIPANTS = 500
local phases = {"Phase I", "Phase II", "Phase III", "Phase IV"}

math.randomseed(os.time())

-- 1. Generate Studies Data
local studies = {}
for i = 1, NUM_STUDIES do
    local phase_idx = math.random(1, #phases)
    local budget = math.random(50000, 2000000)
    table.insert(studies, {
        id = i,
        title = "Study-" .. math.random(1000, 9999),
        phase = phases[phase_idx],
        budget = budget
    })
end

-- 2. Write CSV
local f_csv = io.open("studies.csv", "w")
f_csv:write("study_id,title,phase,budget\n")
for _, s in ipairs(studies) do
    f_csv:write(string.format("%d,%s,%s,%.2f\n", s.id, s.title, s.phase, s.budget))
end
f_csv:close()

-- 3. Write JSON & Build SQL (Manual formatting without external cjson library)
local f_json = io.open("participants.json", "w")
local f_sql = io.open("database_schema.sql", "w")

f_sql:write("CREATE TABLE studies (study_id INTEGER PRIMARY KEY, title TEXT, phase TEXT, budget REAL);\n")
f_sql:write("CREATE TABLE participants (participant_id INTEGER PRIMARY KEY, name TEXT);\n")
f_sql:write("CREATE TABLE enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, p_id INTEGER, s_id INTEGER);\n")

for _, s in ipairs(studies) do
    f_sql:write(string.format("INSERT INTO studies VALUES (%d, '%s', '%s', %.2f);\n", s.id, s.title, s.phase, s.budget))
end

f_json:write("[\n")
for i = 1, NUM_PARTICIPANTS do
    f_json:write(string.format('  {\n    "participant_id": %d,\n    "name": "Participant_%d",\n    "enrollments": [\n', i, i))
    
    f_sql:write(string.format("INSERT INTO participants VALUES (%d, 'Participant_%d');\n", i, i))
    
    local num_enrolled = math.random(1, 4)
    for j = 1, num_enrolled do
        local s_idx = math.random(1, #studies)
        local study = studies[s_idx]
        
        f_json:write(string.format('      { "study_id": %d, "title": "%s" }', study.id, study.title))
        f_sql:write(string.format("INSERT INTO enrollments (p_id, s_id) VALUES (%d, %d);\n", i, study.id))
        
        if j < num_enrolled then f_json:write(",\n") else f_json:write("\n") end
    end
    
    if i < NUM_PARTICIPANTS then
        f_json:write('    ]\n  },\n')
    else
        f_json:write('    ]\n  }\n')
    end
end
f_json:write("]\n")
f_json:close()
f_sql:close()

-- 4. Write XML
local f_xml = io.open("researchers.xml", "w")
f_xml:write("<Researchers>\n")
for i = 1, 10 do
    f_xml:write(string.format('  <Researcher id="%d"><Name>Dr_%d</Name></Researcher>\n', i, i))
end
f_xml:write("</Researchers>\n")
f_xml:close()

print("Success! studies.csv, participants.json, researchers.xml, and database_schema.sql have been generated.")