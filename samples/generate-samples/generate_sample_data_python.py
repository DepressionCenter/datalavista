# This file is part of DataLaVista™
# generate_sample_data_python.py: Script for generating synthetic sample data.
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
import sqlite3
import json
import csv
import xml.etree.ElementTree as ET
from xml.dom import minidom
import random
import datetime

# --- Configuration ---
NUM_STUDIES = 500
NUM_PARTICIPANTS = 500
NUM_RESEARCHERS = 50

phases = ["Phase I", "Phase II", "Phase III", "Phase IV"]
statuses = ["Recruiting", "Active", "Completed", "Suspended"]
departments = ["Neurology", "Cardiology", "Oncology", "Pediatrics", "Immunology"]
locations = ["New York", "London", "Tokyo", "Berlin", "Toronto"]

def random_date(start_year, end_year):
    start = datetime.date(start_year, 1, 1)
    end = datetime.date(end_year, 12, 31)
    return (start + datetime.timedelta(days=random.randint(0, (end - start).days))).isoformat()

# --- 1. Generate Core Data ---
print("Generating synthetic relational data...")
studies = []
for i in range(1, NUM_STUDIES + 1):
    studies.append({
        "study_id": i,
        "title": f"Study {random.choice(['Alpha', 'Beta', 'Gamma', 'Delta'])}-{random.randint(1000,9999)}",
        "phase": random.choice(phases),
        "status": random.choice(statuses),
        "budget": round(random.uniform(50000.0, 2000000.0), 2),
        "start_date": random_date(2020, 2023),
        "end_date": random_date(2024, 2028),
        "primary_location": random.choice(locations)
    })

participants = []
enrollments_db = []
for i in range(1, NUM_PARTICIPANTS + 1):
    enrolled_studies = random.sample(studies, k=random.randint(1, 4))
    enrollment_data = []
    
    for study in enrolled_studies:
        enr_date = random_date(2023, 2026)
        enrollment_data.append({"study_id": study["study_id"], "study_title": study["title"], "date": enr_date})
        enrollments_db.append((i, study["study_id"], enr_date))

    participants.append({
        "participant_id": i,
        "name": f"Participant_{i}",
        "age": random.randint(18, 90),
        "risk_score": round(random.uniform(1.0, 10.0), 1),
        "enrollments": enrollment_data
    })

researchers = []
researcher_studies_db = []
for i in range(1, NUM_RESEARCHERS + 1):
    assigned_studies = random.sample(studies, k=random.randint(2, 6))
    res_studies_xml = []
    
    for study in assigned_studies:
        role = random.choice(["PI", "Co-PI"])
        res_studies_xml.append({"study_id": study["study_id"], "role": role})
        researcher_studies_db.append((i, study["study_id"], role))

    researchers.append({
        "researcher_id": i,
        "name": f"Dr. Researcher_{i}",
        "department": random.choice(departments),
        "studies": res_studies_xml
    })

# --- 2. Export CSV (Studies) ---
with open('studies.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=studies[0].keys())
    writer.writeheader()
    writer.writerows(studies)

# --- 3. Export JSON (Participants) ---
with open('participants.json', 'w') as f:
    json.dump(participants, f, indent=4)

# --- 4. Export XML (Researchers) ---
root = ET.Element("Researchers")
for r in researchers:
    res_node = ET.SubElement(root, "Researcher", id=str(r["researcher_id"]))
    ET.SubElement(res_node, "Name").text = r["name"]
    ET.SubElement(res_node, "Department").text = r["department"]
    studies_node = ET.SubElement(res_node, "AssignedStudies")
    for s in r["studies"]:
        ET.SubElement(studies_node, "Study", id=str(s["study_id"]), role=s["role"])

xmlstr = minidom.parseString(ET.tostring(root)).toprettyxml(indent="    ")
with open('researchers.xml', 'w') as f:
    f.write(xmlstr)

# --- 5. Build SQLite Database ---
db_name = 'datalavista_demo.db'
conn = sqlite3.connect(db_name)
cursor = conn.cursor()

cursor.executescript('''
    DROP TABLE IF EXISTS researcher_studies;
    DROP TABLE IF EXISTS enrollments;
    DROP TABLE IF EXISTS researchers;
    DROP TABLE IF EXISTS participants;
    DROP TABLE IF EXISTS studies;

    CREATE TABLE studies (
        study_id INTEGER PRIMARY KEY, title TEXT, phase TEXT, status TEXT, 
        budget REAL, start_date DATE, end_date DATE, primary_location TEXT
    );
    CREATE TABLE participants (
        participant_id INTEGER PRIMARY KEY, name TEXT, age INTEGER, risk_score REAL
    );
    CREATE TABLE researchers (
        researcher_id INTEGER PRIMARY KEY, name TEXT, department TEXT
    );
    CREATE TABLE enrollments (
        enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id INTEGER, study_id INTEGER, enrollment_date DATE,
        FOREIGN KEY(participant_id) REFERENCES participants(participant_id),
        FOREIGN KEY(study_id) REFERENCES studies(study_id)
    );
    CREATE TABLE researcher_studies (
        rs_id INTEGER PRIMARY KEY AUTOINCREMENT,
        researcher_id INTEGER, study_id INTEGER, role TEXT,
        FOREIGN KEY(researcher_id) REFERENCES researchers(researcher_id),
        FOREIGN KEY(study_id) REFERENCES studies(study_id)
    );
''')

# Insert DB Data
cursor.executemany("INSERT INTO studies VALUES (:study_id, :title, :phase, :status, :budget, :start_date, :end_date, :primary_location)", studies)
cursor.executemany("INSERT INTO participants (participant_id, name, age, risk_score) VALUES (?, ?, ?, ?)", [(p['participant_id'], p['name'], p['age'], p['risk_score']) for p in participants])
cursor.executemany("INSERT INTO researchers VALUES (?, ?, ?)", [(r['researcher_id'], r['name'], r['department']) for r in researchers])
cursor.executemany("INSERT INTO enrollments (participant_id, study_id, enrollment_date) VALUES (?, ?, ?)", enrollments_db)
cursor.executemany("INSERT INTO researcher_studies (researcher_id, study_id, role) VALUES (?, ?, ?)", researcher_studies_db)

conn.commit()
conn.close()

print("Success! Created studies.csv, participants.json, researchers.xml, and datalavista_demo.db.")