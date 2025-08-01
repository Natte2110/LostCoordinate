# 🗺️ LostCoordinate – Dev Day Map Game

A web-based interactive map game where teams claim and defend geographic areas by answering ArcGIS-related questions. Built for Dev Day using Flask and the ArcGIS JavaScript SDK.

---

## 🚀 Features

- Create or join teams with unique colors and passwords
- Claim starting tiles and expand territory
- Answer ArcGIS questions to capture new tiles
- Defend your owned tiles to prevent attacks
- Real-time score tracking and map updates
- Modular frontend logic and RESTful backend

---

## 📦 Project Structure

```text
app/
├── static/
│   ├── js/             # Modular game logic (app.js, claimStartTile.js, etc.)
│   ├── css/            # Game styles
│   ├── data/           # GeoJSON layer
│   ├── favicon.ico     # Favicon and icons
├── templates/
│   ├── index.html      # Main game interface
│   ├── create_team.html# Team join/create screen
│   ├── scoreboard.html # Team score display
├── routes/             # Flask API routes
├── tasks/              # Background tasks (e.g., money updates)
```

---

## 🛠️ Requirements

- Python 3.10+
- Flask
- Dependencies listed in `requirements.txt`

Install them with:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 🧪 Running the Game Locally

1. Clone the repo:

```bash
git clone https://github.com/Natte2110/LostCoordinate
cd LostCoordinate
```

2. Initialize the database:

```bash
flask shell
>>> from app import db
>>> db.create_all()
>>> exit()
```

3. Import game data:

```bash
python import_counties.py
python load_questions.py
```

4. Start the development server:

```bash
flask run
```

5. Visit: [http://localhost:5000](http://localhost:5000)

---

## 🎮 Game Overview

- Join or create a team
- Claim your first tile
- Expand by answering questions
- Defend tiles to hold ground
- Outscore other teams to win!

---
