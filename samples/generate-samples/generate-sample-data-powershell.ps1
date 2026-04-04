# This file is part of DataLaVista™
# generate_sample_data_powershell.ps1: Script for generating synthetic sample data.
# Author(s): Gabriel Mongefranco; Jeremy Gluskin; Shelley Boa.
# Created: 2026-03-28
# Last Modified: 2026-03-29
# Summary: Script for generating synthetic sample data for DataLaVista.
# Notes: See README file for documentation and full license information.
# Website: https://github.com/DepressionCenter/datalavista
# 
# Copyright © 2026 The Regents of the University of Michigan
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
# You should have received a copy of the GNU General Public License along
# with this program. If not, see <https://www.gnu.org/licenses/>.
# 

$NUM_STUDIES = 500
$NUM_PARTICIPANTS = 500
$phases = @("Phase I", "Phase II", "Phase III", "Phase IV")

Write-Host "Generating relational data in memory..."

# 1. Generate Studies
$studies = @()
$sql = "CREATE TABLE IF NOT EXISTS studies (study_id INTEGER PRIMARY KEY, title TEXT, phase TEXT, budget REAL);`n"
$sql += "CREATE TABLE IF NOT EXISTS participants (participant_id INTEGER PRIMARY KEY, name TEXT);`n"
$sql += "CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, p_id INTEGER, s_id INTEGER);`n"

for ($i = 1; $i -le $NUM_STUDIES; $i++) {
    $title = "Study-$(Get-Random -Minimum 1000 -Maximum 9999)"
    $phase = $phases | Get-Random
    $budget = [math]::Round((Get-Random -Minimum 50000.0 -Maximum 2000000.0), 2)
    
    $studies += [PSCustomObject]@{ study_id = $i; title = $title; phase = $phase; budget = $budget }
    $sql += "INSERT INTO studies VALUES ($i, '$title', '$phase', $budget);`n"
}

# 2. Generate Participants & Enrollments
$participants = @()
for ($i = 1; $i -le $NUM_PARTICIPANTS; $i++) {
    $sql += "INSERT INTO participants VALUES ($i, 'Participant_$i');`n"
    
    $enrolled = @()
    $numEnrolled = Get-Random -Minimum 1 -Maximum 5
    for ($j = 0; $j -lt $numEnrolled; $j++) {
        $randStudy = $studies | Get-Random
        $enrolled += [PSCustomObject]@{ study_id = $randStudy.study_id; title = $randStudy.title }
        $sql += "INSERT INTO enrollments (p_id, s_id) VALUES ($i, $($randStudy.study_id));`n"
    }
    
    $participants += [PSCustomObject]@{
        participant_id = $i
        name = "Participant_$i"
        enrollments = $enrolled
    }
}

# 3. Generate Researchers XML (String format to match exact requested output)
$xml = "<Researchers>`n"
for ($i = 1; $i -le 50; $i++) {
    $xml += "  <Researcher id=`"$i`"><Name>Dr_$i</Name></Researcher>`n"
}
$xml += "</Researchers>`n"

# 4. Export all files
Write-Host "Writing files to disk..."
$studies | Export-Csv -Path "studies.csv" -NoTypeInformation
$participants | ConvertTo-Json -Depth 5 | Out-File "participants.json" -Encoding utf8
$xml | Out-File "researchers.xml" -Encoding utf8
$sql | Out-File "database_schema.sql" -Encoding utf8

# 5. Graceful SQLite Check
if (Get-Command sqlite3.exe -ErrorAction SilentlyContinue) {
    Write-Host "✅ sqlite3.exe detected! Building datalavista_demo.db..." -ForegroundColor Green
    if (Test-Path "datalavista_demo.db") { Remove-Item "datalavista_demo.db" }
    
    # Run sqlite3 and pipe the SQL file into it
    cmd.exe /c "sqlite3 datalavista_demo.db < database_schema.sql"
    Write-Host "Database built successfully." -ForegroundColor Green
} else {
    Write-Host "⚠️ sqlite3.exe not found in PATH. Skipping automatic .db creation." -ForegroundColor Yellow
    Write-Host "Don't worry! Your 'database_schema.sql' file is fully generated and ready for manual use." -ForegroundColor Yellow
}

Write-Host "Done! All DataLavista demo files are ready."