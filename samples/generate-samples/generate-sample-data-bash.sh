#!/bin/bash
# This file is part of DataLaVista™
# generate_sample_data_bash.sh: Script for generating synthetic sample data.
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

NUM_STUDIES=500
NUM_PARTICIPANTS=500
PHASES=("Phase I" "Phase II" "Phase III" "Phase IV")

echo "Generating studies.csv and database_schema.sql..."
# Initialize files
echo "study_id,title,phase,budget" > studies.csv
echo "CREATE TABLE IF NOT EXISTS studies (study_id INTEGER PRIMARY KEY, title TEXT, phase TEXT, budget REAL);" > database_schema.sql
echo "CREATE TABLE IF NOT EXISTS participants (participant_id INTEGER PRIMARY KEY, name TEXT);" >> database_schema.sql
echo "CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, p_id INTEGER, s_id INTEGER);" >> database_schema.sql

# Generate Studies
for i in $(seq 1 $NUM_STUDIES); do
    budget=$((RANDOM % 1950000 + 50000))
    phase=${PHASES[$RANDOM % 4]}
    title="Study-$((RANDOM % 9000 + 1000))"
    
    echo "$i,$title,$phase,$budget" >> studies.csv
    echo "INSERT INTO studies VALUES ($i, '$title', '$phase', $budget);" >> database_schema.sql
done

echo "Generating participants.json..."
echo "[" > participants.json
for i in $(seq 1 $NUM_PARTICIPANTS); do
    echo "  {" >> participants.json
    echo "    \"participant_id\": $i," >> participants.json
    echo "    \"name\": \"Participant_$i\"," >> participants.json
    echo "    \"enrollments\": [" >> participants.json
    
    echo "INSERT INTO participants VALUES ($i, 'Participant_$i');" >> database_schema.sql
    
    num_enrolled=$((RANDOM % 4 + 1))
    for j in $(seq 1 $num_enrolled); do
        study_id=$((RANDOM % NUM_STUDIES + 1))
        
        # Add to JSON array
        if [ $j -lt $num_enrolled ]; then
            echo "      { \"study_id\": $study_id }," >> participants.json
        else
            echo "      { \"study_id\": $study_id }" >> participants.json
        fi
        
        # Add to SQL enrollments table
        echo "INSERT INTO enrollments (p_id, s_id) VALUES ($i, $study_id);" >> database_schema.sql
    done
    
    echo "    ]" >> participants.json
    
    # Handle trailing comma for valid JSON
    if [ $i -lt $NUM_PARTICIPANTS ]; then
        echo "  }," >> participants.json
    else
        echo "  }" >> participants.json
    fi
done
echo "]" >> participants.json

echo "Generating researchers.xml..."
echo "<Researchers>" > researchers.xml
for i in $(seq 1 50); do
    echo "  <Researcher id=\"$i\"><Name>Dr_$i</Name></Researcher>" >> researchers.xml
done
echo "</Researchers>" >> researchers.xml

# Graceful SQLite Check
if command -v sqlite3 &> /dev/null; then
    echo "✅ sqlite3 detected in environment! Building datalavista_demo.db..."
    rm -f datalavista_demo.db
    sqlite3 datalavista_demo.db < database_schema.sql
    echo "Database built successfully."
else
    echo "⚠️ sqlite3 CLI not found in PATH. Skipping automatic .db creation."
    echo "Don't worry! Your 'database_schema.sql' file is fully generated and ready for manual use."
fi

echo "Done! All DataLavista demo files are ready."